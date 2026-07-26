import { transactionsToAsciiTable } from "./asciiTable";
import { callGemini } from "./gemini";
import { ensureAsciiTablesFenced } from "./markdownFix";
import type { Budget, Transaction } from "./types";

export async function generateFinancialReport(
  transactions: Transaction[],
  budget: Budget
): Promise<string> {
  const table = transactionsToAsciiTable(transactions);

  const prompt = `You are a senior financial strategy consultant (ex-McKinsey background) producing a
consultancy-style report in Markdown for a personal finance tracker user.

Analyze the following transaction table and budget, then produce a full report with these
sections, in this order:

1. Executive Summary - key strategic insights
2. Behavioral Segmentation Profiles - spending patterns, impulse vs planned, life-event signals
3. Liquidity Risk Dashboard - cash position trend, days of runway, risk scoring
4. Fraud Network Mapping - anomalies, repeated counterparties, suspicious patterns (note if none found)
5. Expense Optimization Plan & Budget Recovery Roadmap - % of monthly/yearly budget consumed,
   and if exceeded, present Plan A (full deduction from next month) and Plan B (proportional
   reduction across remaining months) with a 3-month cash flow forecast and a recommendation.

Then include an Appendix with the full transaction table reproduced as-is.

Budget: monthly = ${budget.monthly}, yearly = ${budget.yearly}

Transaction table:
${table}

Output only the Markdown report, no commentary before or after it.`;

  const raw = await callGemini(prompt);

  return ensureAsciiTablesFenced(raw.replace(/^```markdown/, "").replace(/```$/, "").trim());
}
