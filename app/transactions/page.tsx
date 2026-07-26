"use client";

import { useState, useTransition } from "react";
import { addTransactions, type NewTransaction } from "./actions";

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Other"];
const STATUSES = ["Completed", "Pending", "Failed", "Cancelled"];

function emptyRow(): NewTransaction {
  return { date: "", description: "", amount: 0, paymentMethod: "Cash", status: "Completed", notes: "" };
}

export default function AddTransactionsPage() {
  const [count, setCount] = useState(1);
  const [rows, setRows] = useState<NewTransaction[]>([emptyRow()]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function setCountAndRows(n: number) {
    setCount(n);
    setRows((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(emptyRow());
      return next.slice(0, n);
    });
  }

  function updateRow(i: number, patch: Partial<NewTransaction>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    setMessage(null);
    startTransition(async () => {
      const result = await addTransactions(rows);
      if (result?.error) setMessage({ type: "error", text: result.error });
      if (result?.success) {
        setMessage({ type: "success", text: result.success });
        setRows(Array.from({ length: count }, emptyRow));
      }
    });
  }

  return (
    <div>
      <h1>➕ Add Transaction(s)</h1>
      <div className="divider" />

      <div className="field" style={{ maxWidth: 260 }}>
        <label>How many transactions to add?</label>
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCountAndRows(Math.min(20, Math.max(1, Number(e.target.value))))}
        />
      </div>
      <div className="divider" />

      {rows.map((row, i) => (
        <div className="card" key={i}>
          <h3>Transaction #{i + 1}</h3>
          <div className="field">
            <label>Date</label>
            <input type="date" value={row.date} onChange={(e) => updateRow(i, { date: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} />
          </div>
          <div className="field">
            <label>Amount</label>
            <input
              type="number"
              step="0.01"
              value={row.amount}
              onChange={(e) => updateRow(i, { amount: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Payment Method</label>
            <select value={row.paymentMethod} onChange={(e) => updateRow(i, { paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={row.status} onChange={(e) => updateRow(i, { status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={row.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
          </div>
        </div>
      ))}

      {message && <div className={message.type === "error" ? "msg-error" : "msg-success"}>{message.text}</div>}

      <button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
