import { createClient } from "@/lib/supabase/server";
import { transactionsToCsv } from "@/lib/csv";
import { transactionsToAsciiTable } from "@/lib/asciiTable";
import { textToPdfBuffer } from "@/lib/pdf";
import type { Transaction } from "@/lib/types";
import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("s_no", { ascending: true });

  const { data: budget } = await supabase
    .from("budgets")
    .select("monthly, yearly")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: latestReport } = await supabase
    .from("reports")
    .select("content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = (transactions ?? []) as Transaction[];
  const asciiTable = transactionsToAsciiTable(rows);

  const zip = new JSZip();
  zip.file("csv_transactions.csv", transactionsToCsv(rows));
  zip.file("ascii_table_of_transactions.txt", asciiTable);
  zip.file("pdf_of_transactions.pdf", textToPdfBuffer(asciiTable));
  zip.file(
    "budgets.txt",
    `monthly = ${budget?.monthly ?? 500}, yearly = ${budget?.yearly ?? 6000}`
  );
  if (latestReport?.content) {
    zip.file("md_report.md", latestReport.content);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="finance_tracker_export.zip"',
    },
  });
}
