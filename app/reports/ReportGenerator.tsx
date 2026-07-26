"use client";

import { useRef, useState } from "react";
import type { Report } from "@/lib/types";

const TABLE_CONFORM_RETRY_CAP = 3;
const STAGE_RETRY_CAP = 3; // for LLM stages with no code-fallback: analyze, report, budget-crosscheck

type StageName =
  | "Formatting table (agent)"
  | "Checking table conformance"
  | "Analyzing transactions (agent)"
  | "Writing strategy brief (agent)"
  | "Cross-checking budget math (agent)"
  | "Saving report";

type StageTiming = { stage: StageName; ms: number; attempts: number };

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
): Promise<{ result: T; timing: StageTiming }> {
  const start = Date.now();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();
      return { result, timing: { stage, ms: Date.now() - start, attempts: attempt } };
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
  const [timings, setTimings] = useState<StageTiming[]>([]);
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
        const gen = await withRetries("Formatting table (agent)", 1, () =>
          postJson<{ llmTable: string }>("/api/reports/stages/table-generate")
        );
        allTimings.push(gen.timing);

        setProgress("Checking table conformance");
        const conform = await withRetries("Checking table conformance", 1, () =>
          postJson<{ ok: boolean; table?: string; codeTable: string }>(
            "/api/reports/stages/table-conform",
            { llmTable: gen.result.llmTable }
          )
        );
        allTimings.push(conform.timing);

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
      // each retried up to STAGE_RETRY_CAP times on failure. ---
      setProgress("Analyzing transactions (agent)");
      const analyze = await withRetries("Analyzing transactions (agent)", STAGE_RETRY_CAP, () =>
        postJson<{ analysisText: string }>("/api/reports/stages/analyze", { table })
      );
      allTimings.push(analyze.timing);
      setAnalysisText(analyze.result.analysisText);

      setProgress("Writing strategy brief (agent)");
      const report = await withRetries("Writing strategy brief (agent)", STAGE_RETRY_CAP, () =>
        postJson<{ reportMarkdown: string }>("/api/reports/stages/report", {
          analysisText: analyze.result.analysisText,
          table,
        })
      );
      allTimings.push(report.timing);
      setDraftReport(report.result.reportMarkdown);

      // --- Budget math cross-check: the consultant agent's own Section 5
      // numbers vs. the code-computed authoritative figures. ---
      setProgress("Cross-checking budget math (agent)");
      const crossCheck = await withRetries(
        "Cross-checking budget math (agent)",
        STAGE_RETRY_CAP,
        () =>
          postJson<{ reportMarkdown: string; discrepancies: string[] }>(
            "/api/reports/stages/budget-crosscheck",
            { reportMarkdown: report.result.reportMarkdown }
          )
      );
      allTimings.push(crossCheck.timing);
      setDiscrepancies(crossCheck.result.discrepancies);

      // --- Save ---
      setProgress("Saving report");
      const save = await withRetries("Saving report", 1, () =>
        postJson<{ report: Report }>("/api/reports/stages/save", {
          content: crossCheck.result.reportMarkdown,
          analysis: analyze.result.analysisText,
        })
      );
      allTimings.push(save.timing);

      setTimings(allTimings);
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

  return (
    <div>
      <button onClick={handleGenerate} disabled={isRunning}>
        {isRunning ? progress ?? "Generating your report..." : "Generate Report"}
      </button>

      {error && <div className="msg-error">{error}</div>}

      {usedFallbackTable && !error && (
        <div className="msg-warning" style={{ marginTop: 8 }}>
          The table-formatting agent didn&apos;t produce a conforming table after {TABLE_CONFORM_RETRY_CAP}{" "}
          attempts, so the code-generated table was used instead.
        </div>
      )}

      {/* Progressive output: each stage's result appears as soon as it's
          ready. Once the final saved report is in, these collapse away and
          only the final card (below) is shown. */}
      {validatedTable && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Transaction table</strong>
          <div className="report-body">{validatedTable}</div>
        </div>
      )}
      {analysisText && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Analyst findings</strong>
          <div className="report-body">{analysisText}</div>
        </div>
      )}
      {draftReport && !latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Draft report (before budget math cross-check)</strong>
          <div className="report-body">{draftReport}</div>
        </div>
      )}

      {latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="report-body">{latest.content}</div>
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

          {timings.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary>Stage timings</summary>
              <ul>
                {timings.map((t, i) => (
                  <li key={i}>
                    {t.stage}: {t.ms}ms{t.attempts > 1 ? ` (${t.attempts} attempts)` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
