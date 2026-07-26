import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AuthError,
  computeMaxColumnWidths,
  fetchTransactions,
  requireUser,
  transactionsTo2DArray,
} from "@/lib/reportData";
import { generateAsciiTableWithLLM } from "@/lib/agents/tableGenerator";

// Stage 1 of 5: LLM agent ("2D Array -> PrettyTable Converter").
// Fetches this user's transactions itself (auth cookie flows automatically
// on same-origin fetches) so raw transaction rows never need to pass through
// the browser - only this stage's output (the ASCII table text) does.
export async function POST() {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const transactions = await fetchTransactions(supabase, user.id);

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found - add some transactions before generating a report." },
        { status: 400 }
      );
    }

    const csvData = transactionsTo2DArray(transactions);
    const maxWidths = computeMaxColumnWidths(csvData);
    const llmTable = await generateAsciiTableWithLLM(csvData, maxWidths);

    return NextResponse.json({ llmTable });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
