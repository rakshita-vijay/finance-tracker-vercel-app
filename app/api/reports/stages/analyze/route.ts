import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AuthError, fetchBudget, requireUser } from "@/lib/reportData";
import { analyzeTransactions } from "@/lib/agents/analyst";

// Stage 3 of 5: LLM agent ("Transaction Intelligence Analyst"). Fetches the
// budget itself; the validated table text comes from the client since it's
// already a derived, display-bound artifact (not raw DB rows).
export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const { table } = (await req.json()) as { table?: string };
    if (!table) {
      return NextResponse.json({ error: "Missing table in request body." }, { status: 400 });
    }

    const budget = await fetchBudget(supabase, user.id);
    const analysisText = await analyzeTransactions(table, budget);

    return NextResponse.json({ analysisText });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
