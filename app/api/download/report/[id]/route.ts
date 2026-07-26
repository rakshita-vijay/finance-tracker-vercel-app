import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("reports")
    .select("content, created_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(data.content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="report_${params.id}.md"`,
    },
  });
}
