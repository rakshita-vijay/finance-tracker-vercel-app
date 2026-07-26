import { callGemini, stripFences } from "../gemini";
import type { BudgetMathResult } from "../budgetMath";

export type BudgetCrossCheckResult = {
  reportMarkdown: string;
  discrepancies: string[];
};

/**
 * Third LLM call in the pipeline. The consultant agent (lib/agents/consultant.ts)
 * independently works out Section 5's budget-recovery numbers itself, in
 * prose, from the raw budgets/table it's given - the same way the original
 * CrewAI agent did. Separately, lib/budgetMath.ts computes the same numbers
 * deterministically in code. This agent is handed both and asked to
 * reconcile them: flag any mismatches, and correct the report to match the
 * authoritative (code-computed) figures.
 */
export async function crossCheckBudgetMath(
  reportMarkdown: string,
  authoritative: BudgetMathResult
): Promise<BudgetCrossCheckResult> {
  const prompt = `You are playing the role of an AI agent: Budget Math Auditor.

Backstory: You are a meticulous financial controller whose only job is to verify that a report's numbers match a set of authoritative, code-calculated figures, and to quietly correct them if they don't, without changing the report's tone or structure.

Authoritative figures (calculated in code, not by an LLM - treat these as ground truth):
${JSON.stringify(authoritative, null, 2)}

Report to audit (produced by another agent - focus on its "Budget Recovery Roadmap" / Section 5):
${reportMarkdown}

Task:
1. Compare every number in Section 5 (monthly/yearly % of budget used, overrun amount, Plan A figures, Plan B figures, recommended plan) against the authoritative figures above.
2. List any discrepancies you find, in plain language, e.g. "Report said 42% of monthly budget used; authoritative figure is 51%."
3. Produce a corrected version of the FULL report markdown with Section 5's numbers fixed to match the authoritative figures wherever they differ. Keep everything else - including the rest of the report and Section 5's surrounding prose/tone - unchanged as much as possible.

Respond with ONLY a JSON object, no markdown fencing, no commentary, in exactly this shape:
{"discrepancies": ["list of plain-language discrepancies, empty array if none found"], "correctedReportMarkdown": "the full corrected report markdown, identical to the input if no discrepancies were found"}`;

  const raw = await callGemini(prompt);
  const cleaned = stripFences(raw);

  try {
    const parsed = JSON.parse(cleaned);
    const corrected = parsed.correctedReportMarkdown;
    return {
      reportMarkdown: typeof corrected === "string" && corrected.trim() ? corrected : reportMarkdown,
      discrepancies: Array.isArray(parsed.discrepancies) ? parsed.discrepancies.map(String) : [],
    };
  } catch {
    // If the auditor didn't return parseable JSON, keep the original report
    // rather than silently discarding it, but surface that the audit itself
    // couldn't run this time.
    return {
      reportMarkdown,
      discrepancies: ["Budget auditor agent did not return parseable JSON - cross-check skipped this run."],
    };
  }
}
