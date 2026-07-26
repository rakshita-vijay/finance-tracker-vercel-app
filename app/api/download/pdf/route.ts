import { createClient } from "@/lib/supabase/server";
import { transactionsToAsciiTable } from "@/lib/asciiTable";
import { textToPdfBuffer } from "@/lib/pdf";
import type { Transaction } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("s_no", { ascending: true });

  const txt = transactionsToAsciiTable((data ?? []) as Transaction[]);
  const pdfBuffer = textToPdfBuffer(txt);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="pdf_of_transactions.pdf"',
    },
  });
}
