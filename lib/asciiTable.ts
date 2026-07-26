import { HEADERS, type Transaction } from "./types";

const RIGHT_ALIGN = new Set(["AMOUNT"]);
const CENTER_ALIGN = new Set(["S.NO", "DATE", "PAYMENT METHOD", "STATUS"]);

function pad(cell: string, width: number, align: "l" | "r" | "c"): string {
  const gap = Math.max(0, width - cell.length);
  if (align === "r") return " ".repeat(gap) + cell;
  if (align === "c") {
    const left = Math.floor(gap / 2);
    const right = gap - left;
    return " ".repeat(left) + cell + " ".repeat(right);
  }
  return cell + " ".repeat(gap);
}

export function transactionsToAsciiTable(rows: Transaction[]): string {
  const dataRows = rows.map((r) => [
    String(r.s_no).padStart(2, "0"),
    r.txn_date,
    r.description,
    String(r.amount),
    r.payment_method,
    r.status,
    r.notes ?? "",
  ]);

  const widths = HEADERS.map((h, i) =>
    Math.max(h.length, ...dataRows.map((row) => row[i].length), 3) + 2
  );

  const align = (h: string): "l" | "r" | "c" =>
    RIGHT_ALIGN.has(h) ? "r" : CENTER_ALIGN.has(h) ? "c" : "l";

  const sep = "+" + widths.map((w) => "-".repeat(w)).join("+") + "+";

  const headerLine =
    "|" + HEADERS.map((h, i) => pad(h, widths[i], "c")).join("|") + "|";

  const bodyLines = dataRows.map(
    (row) =>
      "|" +
      row.map((cell, i) => pad(cell, widths[i], align(HEADERS[i]))).join("|") +
      "|"
  );

  return [sep, headerLine, sep, ...bodyLines, sep].join("\n") + "\n";
}
