import { callGemini, stripFences } from "../gemini";
import type { Budget } from "../types";

/**
 * Port of the "rep_generator" Agent + "to_do_rep_generation" Task from
 * generate_report_from_csv.py. The analyst's raw text output is
 * string-interpolated directly into this prompt's context, exactly like:
 *   context=f"Topics from the Topic Planner:\n{planner_output}"
 * in your reference project - no parsing, no schema, just glued-in prose.
 */
export async function generateFinancialBrief(
  analysisText: string,
  prettyTable: string,
  budgets: Budget
): Promise<string> {
  const prompt = `You are playing the role of an AI agent in a two-agent pipeline.

Agent role: Financial Strategy Consultant
Agent backstory: Lead report designer for Fortune 500 financial departments.
Agent goal: Transform the analysis received from the Transaction Intelligence Analyst into actionable business intelligence:
- Executive strategy brief
- Behavioral segmentation profiles
- Liquidity risk dashboard
- Fraud prevention roadmap
- Expense optimization plan
- Budget recovery strategies (make a note of the budgets below)

Context from the Transaction Intelligence Analyst (previous stage's raw output):
${analysisText}

Task: Create a report using the Strategic Transaction Analysis above:
- Executive Summary (key strategic insights)
- Behavioral Segmentation Profiles
- Liquidity Risk Dashboard
- Fraud Network Mapping
- Expense Optimization Plan
- Budget Recovery Roadmap: % of Monthly and Yearly budget spent and best course of action to stay within budget
- Appendix: Full transaction table, reproduced exactly as given below

Format: Consultancy-style Markdown with data visualizations (describe them in text/tables where a real image isn't possible).
Use the budgets below if needed.

budgets = ${JSON.stringify(budgets)}

Section 5 (Budget Recovery Roadmap) must, if the monthly budget is exceeded:
a) Present Plan A: Full deduction from next month's budget
b) Present Plan B: Proportional reduction across remaining months
- Show a 3-month cash flow forecast under each plan
- Quantify the annual savings impact of each strategy
- Recommend the optimal path based on the liquidity risk profile

Transaction table for the Appendix (reproduce exactly, do not alter any values):
${prettyTable}

Expected output: the full report in Markdown format with the 5 sections above plus the Appendix. Output only the Markdown report, no commentary before or after it.`;

  const raw = await callGemini(prompt);
  return stripFences(raw);
}
