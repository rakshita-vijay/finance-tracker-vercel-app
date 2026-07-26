import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthError, requireUser } from "@/lib/reportData";
// Pipeline order: table-generate -> table-conform -> analyze -> report ->
// budget-crosscheck -> save (this file).

// Stage 6 of 6: its own route, called last by the client, saving the final
// report into the `reports` table (same insert your app already did), plus
// the analyst agent's raw output alongside it as an audit trail.
export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const { content, analysis } = (await req.json()) as { content?: string; analysis?: string };
    if (!content) {
      return NextResponse.json({ error: "Missing content in request body." }, { status: 400 });
    }

    const { data: saved, error: insertError } = await supabase
      .from("reports")
      .insert({ user_id: user.id, content, analysis: analysis ?? null })
      .select("id, content, analysis, created_at")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    revalidatePath("/reports");
    return NextResponse.json({ report: saved });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
