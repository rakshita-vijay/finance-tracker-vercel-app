"use client";

import { useState, useTransition } from "react";
import { updateBudget } from "./actions";

export default function BudgetForm({
  initialMonthly,
  initialYearly,
}: {
  initialMonthly: number;
  initialYearly: number;
}) {
  const [type, setType] = useState<"NONE" | "monthly" | "yearly">("NONE");
  const [value, setValue] = useState(initialMonthly);
  const [result, setResult] = useState<{ monthly: number; yearly: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTypeChange(t: "NONE" | "monthly" | "yearly") {
    setType(t);
    setValue(t === "monthly" ? initialMonthly : t === "yearly" ? initialYearly : 0);
  }

  function handleSubmit() {
    if (type === "NONE") return;
    startTransition(async () => {
      const res = await updateBudget(type, value);
      if (res.success) setResult({ monthly: res.monthly!, yearly: res.yearly! });
    });
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Do you want to enter a monthly or yearly budget?</label>
        <select value={type} onChange={(e) => handleTypeChange(e.target.value as any)}>
          <option value="NONE">NONE</option>
          <option value="monthly">monthly</option>
          <option value="yearly">yearly</option>
        </select>
      </div>

      {type !== "NONE" && (
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Enter your {type} budget:</label>
          <input type="number" min={0} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </div>
      )}

      <button onClick={handleSubmit} disabled={type === "NONE" || isPending}>
        {isPending ? "Saving..." : "Save Budget"}
      </button>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="msg-success">Budget updated!</div>
          <h3>Updated Budgets</h3>
          <div>Monthly budget = {result.monthly}</div>
          <div>Yearly budget = {result.yearly}</div>
        </div>
      )}
    </div>
  );
}
