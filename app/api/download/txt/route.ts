import { createClient } from "@/lib/supabase/server";
import { transactionsToAsciiTable } from "@/lib/asciiTable";
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

  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": 'attachment; filename="ascii_table_of_transactions.txt"',
    },
  });
}
