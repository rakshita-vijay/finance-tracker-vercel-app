import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AuthError,
  computeMaxColumnWidths,
  diffTableCells,
  fetchTransactions,
  requireUser,
  transactionsTo2DArray,
} from "@/lib/reportData";
import { transactionsToAsciiTable } from "@/lib/asciiTable";
import { conformAsciiTableWithLLM } from "@/lib/agents/tableConformer";

// Stage 2 of 5: two checks on stage 1's output, per your instruction to
// "restore crew1 as llm agents as well, but also keep your code and make
// sure what the llm agent has done is right":
//   (a) code-generated ground-truth table (your existing transactionsToAsciiTable)
//       is diffed cell-by-cell against the LLM's table - this is the
//       correctness check.
//   (b) the LLM "conformer" agent checks formatting rules (pipes, alignment,
//       widths), same as the original conformer agent.
// Re-fetches transactions itself rather than trusting the client with them.
export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const user = await requireUser(supabase);
    const { llmTable } = (await req.json()) as { llmTable?: string };
    if (!llmTable) {
      return NextResponse.json({ error: "Missing llmTable in request body." }, { status: 400 });
    }

    const transactions = await fetchTransactions(supabase, user.id);
    const csvData = transactionsTo2DArray(transactions);
    const maxWidths = computeMaxColumnWidths(csvData);
    const codeTable = transactionsToAsciiTable(transactions);

    const { matches: cellsMatch, diffs } = diffTableCells(llmTable, codeTable);
    const { conforms, violations } = await conformAsciiTableWithLLM(llmTable, maxWidths);

    const ok = cellsMatch && conforms;

    return NextResponse.json({
      ok,
      table: ok ? llmTable : undefined,
      codeTable,
      cellsMatch,
      conforms,
      violations,
      diffs: cellsMatch ? [] : diffs,
    });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
