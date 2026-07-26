import { callGemini } from "../gemini";
import type { Budget } from "../types";

/**
 * Port of the "analyser" Agent + "analysis" Task from generate_report_from_csv.py.
 *
 * Per your instruction, the handoff to the next stage (the consultant agent)
 * is plain text - no JSON, no schema, no response_mime_type. The original
 * CrewAI task's expected_output was "JSON with: cash_position,
 * behavioral_segments, liquidity_risk, fraud_networks, expense_optimization";
 * here it's deliberately changed to free-form markdown/prose covering the
 * same categories, which then gets string-interpolated into the consultant
 * agent's prompt in lib/agents/consultant.ts exactly like your reference
 * project's `context=f"..."` pattern.
 */
export async function analyzeTransactions(
  prettyTable: string,
  budgets: Budget
): Promise<string> {
  const prompt = `You are playing the role of an AI agent in a two-agent pipeline.

Agent role: Transaction Intelligence Analyst
Agent backstory: Ex-McKinsey financial strategist specializing in transaction intelligence.
Agent goal: Uncover strategic financial insights from the transaction table and budgets below:
1. Behavioral spending patterns and customer segmentation
2. Cash flow health and liquidity risk
3. Recurring expense optimization opportunities
4. Fraud and anomaly detection with contextual analysis
5. Budget performance analysis (monthly/yearly spend vs allocation)

Task: Conduct an analysis of the transaction table data:
- Net cash position trend (daily)
- Top 5 cash inflow/outflow events
- Customer segmentation by spending signature (impulse vs planned)
- Life event detection via spending habit shifts
- Subscription/cancellation patterns
- Liquidity risk scoring (days of runway)
- Fraud network analysis (common counterparties)
- Recurring expense optimization opportunities
- Payment method distribution
- Transaction status analysis
- Calculate % of monthly/yearly budget consumed using the budgets below
- Identify budget overruns by category
- Project year-end financial position
- Quantify overspend impact on annual savings goals

budgets = ${JSON.stringify(budgets)}

Transaction table:
${prettyTable}

Expected output: a clear, well-organized plain-text/markdown analysis covering cash position, behavioral segments, liquidity risk, fraud networks, and expense optimization. Do not output JSON - write it as prose and lists, the way a strategist would hand off findings to a colleague who will turn them into a client-facing report next.`;

  const raw = await callGemini(prompt);
  return raw.trim();
}
