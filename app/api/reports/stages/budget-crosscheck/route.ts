import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AuthError, fetchBudget, fetchTransactions, requireUser } from "@/lib/reportData";
import { computeBudgetMath } from "@/lib/budgetMath";
import { crossCheckBudgetMath } from "@/lib/agents/budgetAuditor";

// Stage 5 of 6: cross-checks the consultant agent's own budget-recovery
// numbers (worked out independently, in prose) against a deterministic,
// code-computed version of the same math - two independent answers,
// reconciled by a third LLM call rather than either one trusted blindly.
export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const { reportMarkdown } = (await req.json()) as { reportMarkdown?: string };
    if (!reportMarkdown) {
      return NextResponse.json({ error: "Missing reportMarkdown in request body." }, { status: 400 });
    }

    const [transactions, budget] = await Promise.all([
      fetchTransactions(supabase, user.id),
      fetchBudget(supabase, user.id),
    ]);

    const authoritative = computeBudgetMath(transactions, budget);
    const { reportMarkdown: finalReportMarkdown, discrepancies } = await crossCheckBudgetMath(
      reportMarkdown,
      authoritative
    );

    return NextResponse.json({ reportMarkdown: finalReportMarkdown, discrepancies, authoritative });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
