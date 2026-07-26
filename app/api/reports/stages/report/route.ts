import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AuthError, fetchBudget, requireUser } from "@/lib/reportData";
import { generateFinancialBrief } from "@/lib/agents/consultant";

// Stage 4 of 5: LLM agent ("Financial Strategy Consultant"). Receives stage
// 3's raw analysis text, string-glued into its prompt as context (plain-text
// handoff, no JSON), plus the validated table for the Appendix.
export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const { analysisText, table } = (await req.json()) as {
      analysisText?: string;
      table?: string;
    };
    if (!analysisText || !table) {
      return NextResponse.json(
        { error: "Missing analysisText or table in request body." },
        { status: 400 }
      );
    }

    const budget = await fetchBudget(supabase, user.id);
    const reportMarkdown = await generateFinancialBrief(analysisText, table, budget);

    return NextResponse.json({ reportMarkdown });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
