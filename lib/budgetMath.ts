import type { Budget, Transaction } from "./types";

export type BudgetPlan = {
  label: string;
  monthlyBudgets: number[]; // this plan's budget for each of the next 3 months
  totalRecovered: number;
};

export type BudgetMathResult = {
  currentMonth: string; // "YYYY-MM"
  currentYear: string; // "YYYY"
  monthlySpend: number;
  yearlySpend: number;
  monthlyBudget: number;
  yearlyBudget: number;
  monthlyPctUsed: number;
  yearlyPctUsed: number;
  monthlyOverrun: number;
  yearlyOverrun: number;
  monthlyExceeded: boolean;
  planA: BudgetPlan;
  planB: BudgetPlan & { remainingMonths: number };
  recommendation: "Plan A" | "Plan B";
  recommendationReason: string;
};

function monthKey(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (match) return `${match[1]}-${match[2]}`;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function yearKey(dateStr: string): string {
  return monthKey(dateStr).slice(0, 4);
}

/**
 * Computes the same "Budget Recovery Roadmap" math the consultant agent is
 * asked to write about in Section 5 - but deterministically, in code. This
 * is deliberately kept separate from and independent of the consultant
 * agent's own prose so the two can be cross-checked against each other
 * (see lib/agents/budgetAuditor.ts) rather than one being derived from the
 * other.
 *
 * Assumption: "this month" / "this year" are the real calendar month/year at
 * generation time (not the most recent transaction's date) - flag if you'd
 * rather anchor this to the latest transaction date instead.
 */
export function computeBudgetMath(transactions: Transaction[], budget: Budget): BudgetMathResult {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = String(now.getFullYear());

  let monthlySpend = 0;
  let yearlySpend = 0;
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (monthKey(t.txn_date) === currentMonth) monthlySpend += amount;
    if (yearKey(t.txn_date) === currentYear) yearlySpend += amount;
  }

  const monthlyOverrun = Math.max(0, monthlySpend - budget.monthly);
  const yearlyOverrun = Math.max(0, yearlySpend - budget.yearly);
  const monthlyExceeded = monthlyOverrun > 0;

  // Plan A: absorb the whole overrun out of next month's budget.
  const planAMonth1 = Math.max(0, budget.monthly - monthlyOverrun);
  const planA: BudgetPlan = {
    label: "Plan A - full deduction from next month",
    monthlyBudgets: [planAMonth1, budget.monthly, budget.monthly],
    totalRecovered: monthlyOverrun,
  };

  // Plan B: spread the overrun evenly across the rest of the calendar year.
  const currentMonthNum = now.getMonth() + 1; // 1-12
  const remainingMonths = Math.max(1, 12 - currentMonthNum);
  const perMonthReduction = monthlyOverrun / remainingMonths;
  const planB: BudgetPlan & { remainingMonths: number } = {
    label: "Plan B - proportional reduction across remaining months",
    monthlyBudgets: [1, 2, 3].map(() => Math.max(0, budget.monthly - perMonthReduction)),
    totalRecovered: monthlyOverrun,
    remainingMonths,
  };

  // Liquidity-risk heuristic: an overrun eating more than half of a single
  // month's budget is safer to smooth out than absorb all at once.
  const severeOverrun = monthlyOverrun > budget.monthly * 0.5;
  const recommendation: "Plan A" | "Plan B" = severeOverrun ? "Plan B" : "Plan A";
  const recommendationReason = severeOverrun
    ? "The overrun exceeds 50% of a single month's budget, so spreading recovery across several months avoids a second consecutive shortfall."
    : "The overrun is small relative to the monthly budget, so a one-time deduction next month clears it without dragging down multiple months.";

  return {
    currentMonth,
    currentYear,
    monthlySpend,
    yearlySpend,
    monthlyBudget: budget.monthly,
    yearlyBudget: budget.yearly,
    monthlyPctUsed: budget.monthly > 0 ? (monthlySpend / budget.monthly) * 100 : 0,
    yearlyPctUsed: budget.yearly > 0 ? (yearlySpend / budget.yearly) * 100 : 0,
    monthlyOverrun,
    yearlyOverrun,
    monthlyExceeded,
    planA,
    planB,
    recommendation,
    recommendationReason,
  };
}
