import { createClient } from "@/lib/supabase/server";
import { transactionsToCsv } from "@/lib/csv";
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

  const csv = transactionsToCsv((data ?? []) as Transaction[]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
}
