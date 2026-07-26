import { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/lib/types";

export default async function ViewSpendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: budget } = await supabase
    .from("budgets")
    .select("monthly, yearly")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("s_no", { ascending: true });

  const rows = (transactions ?? []) as Transaction[];

  const totalSpent = rows
    .filter((r) => r.status === "Completed" && r.amount > 0)
    .reduce((sum, r) => sum + r.amount, 0);

  const totalRefunded = rows
    .filter((r) => r.status === "Refunded")
    .reduce((sum, r) => sum + Math.abs(r.amount), 0);

  const netSpent = totalSpent - totalRefunded;

  return (
    <div>
      <h1>📊 View Spending</h1>
      <div className="divider" />

      <h3>Current Budgets</h3>
      <div className="card">
        <div>Monthly budget = {budget?.monthly ?? 500}</div>
        <div>Yearly budget = {budget?.yearly ?? 6000}</div>
      </div>

      <div className="divider" />
      <h3>Spending Summary</h3>
      <div className="card">
        <div>Total spent (completed) = {totalSpent.toFixed(2)}</div>
        <div>Total refunded = {totalRefunded.toFixed(2)}</div>
        <div><strong>Net spent = {netSpent.toFixed(2)}</strong></div>
      </div>

      <div className="divider" />
      <h3>Transactions to Date</h3>
      {rows.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>S.NO</th>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th>AMOUNT</th>
              <th>PAYMENT METHOD</th>
              <th>STATUS</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.s_no).padStart(2, "0")}</td>
                <td>{r.txn_date}</td>
                <td>{r.description}</td>
                <td>{r.amount}</td>
                <td>{r.payment_method}</td>
                <td>{r.status}</td>
                <td>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
