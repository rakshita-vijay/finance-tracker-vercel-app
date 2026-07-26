"use client";

import { useState, useTransition } from "react";
import { logout, deleteAccount } from "./actions";

export default function SettingsControls({ isDemo }: { isDemo: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button onClick={() => startTransition(() => logout())} disabled={isPending}>
        ⏻ Log Out
      </button>

      <div className="divider" />

      {isDemo ? (
        <div className="msg-error">This is the demo account. You cannot delete this account :(</div>
      ) : !confirming ? (
        <button className="danger" onClick={() => setConfirming(true)}>
          ⌫ Delete Account
        </button>
      ) : (
        <div className="card">
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Enter your password to confirm account deletion</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="msg-error">{error}</div>}
          <div className="btn-row">
            <button className="danger" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Confirm Deletion"}
            </button>
            <button className="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
