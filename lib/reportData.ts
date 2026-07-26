import type { createClient } from "./supabase/server";
import { HEADERS, type Budget, type Transaction } from "./types";

type SupabaseClient = ReturnType<typeof createClient>;

export class AuthError extends Error {
  constructor() {
    super("Not authenticated.");
  }
}

export async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError();
  return user;
}

export async function fetchTransactions(
  supabase: SupabaseClient,
  userId: string
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("s_no", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

export async function fetchBudget(
  supabase: SupabaseClient,
  userId: string
): Promise<Budget> {
  const { data } = await supabase
    .from("budgets")
    .select("monthly, yearly")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Budget | null) ?? { monthly: 500, yearly: 6000 };
}

/**
 * Reproduces the shape of `data_lines` in the original Streamlit app: a header
 * row followed by string data rows, exactly what transform_csv_to_md_table.py
 * received as `csv_data`.
 */
export function transactionsTo2DArray(rows: Transaction[]): string[][] {
  const header = [...HEADERS];
  const dataRows = rows.map((r) => [
    String(r.s_no).padStart(2, "0"),
    r.txn_date,
    r.description,
    String(r.amount),
    r.payment_method,
    r.status,
    r.notes ?? "",
  ]);
  return [header, ...dataRows];
}

/**
 * Direct port of get_max_width_of_each_column() from
 * crewai_toolkits_gem_3point5_flash/transform_csv_to_md_table.py, including
 * its original quirk of iterating over the header row itself as row 0.
 */
export function computeMaxColumnWidths(csvData: string[][]): Record<string, number> {
  const fields = csvData[0];
  const widths: Record<string, number> = {};
  for (const field of fields) widths[field] = 3;

  for (let colNo = 0; colNo < fields.length; colNo++) {
    for (let rowNo = 0; rowNo < csvData.length; rowNo++) {
      const cellData = String(csvData[rowNo][colNo]);
      const subby = fields[colNo].toLowerCase() !== "amount" ? 2 : 4;
      if (cellData.length > widths[fields[colNo]] - subby) {
        widths[fields[colNo]] = cellData.length + subby;
      }
    }
  }
  return widths;
}

/**
 * Parses a pipe-delimited ASCII table (PrettyTable-style or our own
 * transactionsToAsciiTable output) into rows of trimmed cell strings,
 * skipping separator lines made only of +/-.
 */
export function parseAsciiTableRows(table: string): string[][] {
  const rows: string[][] = [];
  for (const line of table.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^[+\-|]+$/.test(trimmed)) continue; // separator line, e.g. +----+----+
    const cells = trimmed
      .split("|")
      .slice(1, -1) // drop the empty strings before the first and after the last pipe
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

export type CellDiff = { row: number; col: number; expected: string; actual: string };

/**
 * Diffs the LLM-generated table's cell values against the ground-truth
 * (code-generated) table, ignoring header row and formatting/whitespace -
 * this is the "make sure what the LLM agent has done is right" check.
 */
export function diffTableCells(
  llmTable: string,
  codeTable: string
): { matches: boolean; diffs: CellDiff[] } {
  const llmRows = parseAsciiTableRows(llmTable).slice(1); // drop header
  const codeRows = parseAsciiTableRows(codeTable).slice(1); // drop header

  const diffs: CellDiff[] = [];

  if (llmRows.length !== codeRows.length) {
    return {
      matches: false,
      diffs: [{ row: -1, col: -1, expected: `${codeRows.length} rows`, actual: `${llmRows.length} rows` }],
    };
  }

  for (let r = 0; r < codeRows.length; r++) {
    const codeRow = codeRows[r];
    const llmRow = llmRows[r] ?? [];
    for (let c = 0; c < codeRow.length; c++) {
      const expected = (codeRow[c] ?? "").trim();
      const actual = (llmRow[c] ?? "").trim();
      if (expected !== actual) {
        diffs.push({ row: r, col: c, expected, actual });
      }
    }
  }

  return { matches: diffs.length === 0, diffs };
}
