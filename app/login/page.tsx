"use client";

import { useState, useTransition } from "react";
import { login, register } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const action = mode === "login" ? login : register;
      const result = await action(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return (
    <div>
      <h1>🔐 {mode === "login" ? "Login" : "Register"}</h1>
      <div className="card">
        <form action={handleSubmit}>
          <div className="field">
            <label>Email or Username</label>
            <input name="identifier" type="text" required />
            {mode === "register" && (
              <div className="pill" style={{ marginTop: 4 }}>
                Enter an email if you want account recovery, or just a username for a quick signup.
              </div>
            )}
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required minLength={6} />
          </div>
          {error && <div className="msg-error">{error}</div>}
          {success && <div className="msg-success">{success}</div>}
          <div className="btn-row">
            <button type="submit" disabled={isPending}>
              {isPending ? "Please wait..." : mode === "login" ? "Login" : "Register"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
                setSuccess(null);
              }}
            >
              Switch to {mode === "login" ? "Register" : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
