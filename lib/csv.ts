import { HEADERS, type Transaction } from "./types";

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCsv(rows: Transaction[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.s_no).padStart(2, "0"),
        r.txn_date,
        r.description,
        String(r.amount),
        r.payment_method,
        r.status,
        r.notes ?? "",
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}
