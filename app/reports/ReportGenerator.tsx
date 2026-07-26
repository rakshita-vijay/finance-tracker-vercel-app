"use client";

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import Markdown from "@/app/components/Markdown";

const TABLE_CONFORM_RETRY_CAP = 3;
const STAGE_RETRY_CAP = 3; // for LLM stages with no code-fallback: analyze, report, budget-crosscheck

type StageName =
  | "Formatting table (agent)"
  | "Checking table conformance"
  | "Analyzing transactions (agent)"
  | "Writing strategy brief (agent)"
  | "Cross-checking budget math (agent)"
  | "Saving report";

// Canonical pipeline order, irrespective of which crew each stage belongs
// to. Used both for the "(x/y)" progress pill and to render the full
// checklist (including stages that haven't started yet).
const STAGE_ORDER: { stage: StageName; icon: string }[] = [
  { stage: "Formatting table (agent)", icon: "📋" },
  { stage: "Checking table conformance", icon: "🔎" },
  { stage: "Analyzing transactions (agent)", icon: "📊" },
  { stage: "Writing strategy brief (agent)", icon: "✍️" },
  { stage: "Cross-checking budget math (agent)", icon: "🧮" },
  { stage: "Saving report", icon: "💾" },
];

// Stages 1 and 2 are the only ones that can literally re-run as separate,
// separately-timed attempts (the table generate/conform retry loop), so
// only they get "x.1, x.2, x.3" sub-numbering.
const RETRYABLE_STAGES = new Set<StageName>(["Formatting table (agent)", "Checking table conformance"]);

type StageTiming = { stage: StageName; stepLabel: string; ms: number; attempts: number };

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request to ${url} failed (${res.status})`);
  return json as T;
}

// Retries a single stage call on any thrown error (network issue, LLM
// hiccup, etc.) up to `attempts` times, timing the whole thing with Date.now().
async function withRetries<T>(
  stage: StageName,
  attempts: number,
  fn: () => Promise<T>
): Promise<{ result: T; ms: number; attempts: number }> {
  const start = Date.now();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();
      return { result, ms: Date.now() - start, attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (attempt === attempts) throw e;
    }
  }
  throw lastErr;
}

export default function ReportGenerator() {
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<StageName | null>(null);
  // Which attempt of the current stage is in flight. Only meaningful for
  // the two retryable stages; ignored (shown as plain "3", "4", ...) for
  // the rest.
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [timings, setTimings] = useState<StageTiming[]>([]);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const stageStartRef = useRef<number | null>(null);
  const [usedFallbackTable, setUsedFallbackTable] = useState(false);

  // Each stage's output is shown as soon as it lands, instead of only
  // revealing everything at the very end of a single spinner.
  const [validatedTable, setValidatedTable] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [draftReport, setDraftReport] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<string[]>([]);
  const [latest, setLatest] = useState<Report | null>(null);

  // Synchronous guard: React state (isRunning) only blocks the button after
  // a re-render, so a fast double-click could still fire handleGenerate
  // twice before that happens. This ref check is immediate.
  const runningRef = useRef(false);

  // Live per-stage timer. Fires on every `progress` (or `currentAttempt`)
  // change - i.e. every time a new stage/agent attempt starts, whichever
  // crew it belongs to - and restarts the interval from zero so each stage
  // gets its own ticking clock instead of one running total.
  useEffect(() => {
    if (!isRunning || progress === null) {
      setLiveElapsedMs(0);
      return;
    }
    stageStartRef.current = Date.now();
    setLiveElapsedMs(0);
    const id = setInterval(() => {
      if (stageStartRef.current !== null) {
        setLiveElapsedMs(Date.now() - stageStartRef.current);
      }
    }, 100);
    return () => clearInterval(id);
  }, [progress, currentAttempt, isRunning]);

  function stepLabelFor(stage: StageName, attempt: number): string {
    const num = STAGE_ORDER.findIndex((s) => s.stage === stage) + 1;
    return RETRYABLE_STAGES.has(stage) ? `${num}.${attempt}` : `${num}`;
  }

  async function handleGenerate() {
    if (runningRef.current) return;
    runningRef.current = true;

    setIsRunning(true);
    setError(null);
    setUsedFallbackTable(false);
    setTimings([]);
    setValidatedTable(null);
    setAnalysisText(null);
    setDraftReport(null);
    setDiscrepancies([]);
    setLatest(null);

    const allTimings: StageTiming[] = [];

    try {
      // --- Crew 1: table formatting. Up to 3 regenerate attempts against the
      // conformance check before falling back to the code-generated table. ---
      let table: string | null = null;
      let fellBack = false;

      for (let attempt = 1; attempt <= TABLE_CONFORM_RETRY_CAP; attempt++) {
        setProgress("Formatting table (agent)");
        setCurrentAttempt(attempt);
        const gen = await withRetries("Formatting table (agent)", 1, () =>
          postJson<{ llmTable: string }>("/api/reports/stages/table-generate")
        );
        allTimings.push({
          stage: "Formatting table (agent)",
          stepLabel: stepLabelFor("Formatting table (agent)", attempt),
          ms: gen.ms,
          attempts: gen.attempts,
        });
        setTimings([...allTimings]);

        setProgress("Checking table conformance");
        setCurrentAttempt(attempt);
        const conform = await withRetries("Checking table conformance", 1, () =>
          postJson<{ ok: boolean; table?: string; codeTable: string }>(
            "/api/reports/stages/table-conform",
            { llmTable: gen.result.llmTable }
          )
        );
        allTimings.push({
          stage: "Checking table conformance",
          stepLabel: stepLabelFor("Checking table conformance", attempt),
          ms: conform.ms,
          attempts: conform.attempts,
        });
        setTimings([...allTimings]);

        if (conform.result.ok && conform.result.table) {
          table = conform.result.table;
          break;
        }
        if (attempt === TABLE_CONFORM_RETRY_CAP) {
          table = conform.result.codeTable;
          fellBack = true;
        }
      }

      if (!table) throw new Error("Table formatting failed unexpectedly.");
      setValidatedTable(table);
      setUsedFallbackTable(fellBack);

      // --- Crew 2: analysis -> report, plain-text handoff between stages,
      // each retried up to STAGE_RETRY_CAP times internally on failure. ---
      setProgress("Analyzing transactions (agent)");
      setCurrentAttempt(1);
      const analyze = await withRetries("Analyzing transactions (agent)", STAGE_RETRY_CAP, () =>
        postJson<{ analysisText: string }>("/api/reports/stages/analyze", { table })
      );
      allTimings.push({
        stage: "Analyzing transactions (agent)",
        stepLabel: stepLabelFor("Analyzing transactions (agent)", 1),
        ms: analyze.ms,
        attempts: analyze.attempts,
      });
      setTimings([...allTimings]);
      setAnalysisText(analyze.result.analysisText);

      setProgress("Writing strategy brief (agent)");
      setCurrentAttempt(1);
      const report = await withRetries("Writing strategy brief (agent)", STAGE_RETRY_CAP, () =>
        postJson<{ reportMarkdown: string }>("/api/reports/stages/report", {
          analysisText: analyze.result.analysisText,
          table,
        })
      );
      allTimings.push({
        stage: "Writing strategy brief (agent)",
        stepLabel: stepLabelFor("Writing strategy brief (agent)", 1),
        ms: report.ms,
        attempts: report.attempts,
      });
      setTimings([...allTimings]);
      setDraftReport(report.result.reportMarkdown);

      // --- Budget math cross-check: the consultant agent's own Section 5
      // numbers vs. the code-computed authoritative figures. ---
      setProgress("Cross-checking budget math (agent)");
      setCurrentAttempt(1);
      const crossCheck = await withRetries(
        "Cross-checking budget math (agent)",
        STAGE_RETRY_CAP,
        () =>
          postJson<{ reportMarkdown: string; discrepancies: string[] }>(
            "/api/reports/stages/budget-crosscheck",
            { reportMarkdown: report.result.reportMarkdown }
          )
      );
      allTimings.push({
        stage: "Cross-checking budget math (agent)",
        stepLabel: stepLabelFor("Cross-checking budget math (agent)", 1),
        ms: crossCheck.ms,
        attempts: crossCheck.attempts,
      });
      setTimings([...allTimings]);
      setDiscrepancies(crossCheck.result.discrepancies);

      // --- Save ---
      setProgress("Saving report");
      setCurrentAttempt(1);
      const save = await withRetries("Saving report", 1, () =>
        postJson<{ report: Report }>("/api/reports/stages/save", {
          content: crossCheck.result.reportMarkdown,
          analysis: analyze.result.analysisText,
        })
      );
      allTimings.push({
        stage: "Saving report",
        stepLabel: stepLabelFor("Saving report", 1),
        ms: save.ms,
        attempts: save.attempts,
      });
      setTimings([...allTimings]);
      setLatest(save.result.report);
    } catch (e: any) {
      setTimings(allTimings);
      setError(e.message ?? String(e));
    } finally {
      setProgress(null);
      setIsRunning(false);
      runningRef.current = false;
    }
  }

  const currentStageIndex = progress ? STAGE_ORDER.findIndex((s) => s.stage === progress) : -1;
  const currentStageMeta = currentStageIndex >= 0 ? STAGE_ORDER[currentStageIndex] : null;

  return (
    <div>
      <button onClick={handleGenerate} disabled={isRunning}>
        {isRunning
          ? currentStageMeta
            ? `${currentStageMeta.icon} ${currentStageMeta.stage} (${currentStageIndex + 1}/${STAGE_ORDER.length})...`
            : "Generating your report..."
          : "Generate Report"}
      </button>

      {error && <div className="msg-error">{error}</div>}

      {usedFallbackTable && !error && (
        <div className="msg-warning" style={{ marginTop: 8 }}>
          The table-formatting agent didn&apos;t produce a conforming table after {TABLE_CONFORM_RETRY_CAP}{" "}
          attempts, so the code-generated table was used instead.
        </div>
      )}

      {/* Live per-stage timer: the checklist below lists every stage flatly
          in the order it actually runs - Crew 1 and Crew 2 stages interleave
          here, not grouped by crew. Retried stages (the table generate/conform
          loop) get their own x.1, x.2, x.3 rows instead of overwriting each
          other. Stages that haven't started yet show as pending, so the full
          pipeline shape is always visible. This panel stays up after the run
          as a recap. The live "current stage (x/6)..." text itself is shown
          on the Generate Report button (above) instead of a separate pill,
          so the two never show the same thing twice. */}
      {(isRunning || timings.length > 0) && (
        <div style={{ marginTop: 16 }}>
          <ul className="card stage-list" style={{ padding: 0 }}>
            {STAGE_ORDER.map(({ stage, icon }, idx) => {
              const num = idx + 1;
              const completed = timings.filter((t) => t.stage === stage);
              const rows = completed.map((t) => (
                <li className="stage-row done" key={`${stage}-${t.stepLabel}`}>
                  <span className="stage-icon">✅</span>
                  <span className="stage-label">
                    {t.stepLabel} {stage}
                  </span>
                  <span className="stage-time">{formatMs(t.ms)}</span>
                </li>
              ));

              if (isRunning && progress === stage) {
                rows.push(
                  <li className="stage-row active" key={`${stage}-active`}>
                    <span className="stage-icon">⏳</span>
                    <span className="stage-label">
                      {stepLabelFor(stage, currentAttempt)} {stage}
                    </span>
                    <span className="stage-time">{formatMs(liveElapsedMs)}</span>
                  </li>
                );
              } else if (isRunning && completed.length === 0) {
                rows.push(
                  <li className="stage-row pending" key={`${stage}-pending`}>
                    <span className="stage-icon">○</span>
                    <span className="stage-label">
                      {num} {stage}
                    </span>
                    <span className="stage-time" />
                  </li>
                );
              }
              return rows;
            })}
          </ul>
        </div>
      )}

      {/* Progressive output: each stage's result appears as soon as it's
          ready. Once the final saved report is in, these collapse away and
          only the final card (below) is shown. */}
      {validatedTable && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Transaction table</strong>
          <div className="report-body mono-table">{validatedTable}</div>
        </div>
      )}
      {analysisText && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Analyst findings</strong>
          <Markdown content={analysisText} />
        </div>
      )}
      {draftReport && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Draft report (before budget math cross-check)</strong>
          <Markdown content={draftReport} />
        </div>
      )}

      {latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <Markdown content={latest.content} />
          <a href={`/api/download/report/${latest.id}`} download>
            <button style={{ marginTop: 12 }}>Download Report (.md)</button>
          </a>

          {discrepancies.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary>
                Budget math cross-check found {discrepancies.length} discrepanc{discrepancies.length === 1 ? "y" : "ies"}{" "}
                - corrected
              </summary>
              <ul>
                {discrepancies.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
