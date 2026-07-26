"use client";

import { useState, useTransition } from "react";
import { wipeTransactions } from "./actions";

export default function WipeForm() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setMessage(null);
    startTransition(async () => {
      const result = await wipeTransactions(password);
      if (result.error) setMessage({ type: "error", text: result.error });
      if (result.success) {
        setMessage({ type: "success", text: result.success });
        setConfirming(false);
        setPassword("");
      }
    });
  }

  if (!confirming) {
    return <button onClick={() => setConfirming(true)}>Wipe All Transactions</button>;
  }

  return (
    <div className="card">
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Please enter your password to confirm wiping all transactions</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {message && <div className={message.type === "error" ? "msg-error" : "msg-success"}>{message.text}</div>}
      <div className="btn-row">
        <button className="danger" onClick={handleConfirm} disabled={isPending}>
          {isPending ? "Wiping..." : "Confirm Wipe"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setConfirming(false);
            setPassword("");
            setMessage(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
