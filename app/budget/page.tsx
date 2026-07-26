import { createClient } from "@/lib/supabase/server";
import BudgetForm from "./BudgetForm";

export default async function ChangeBudgetPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: budget } = await supabase
    .from("budgets")
    .select("monthly, yearly")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div>
      <h1>💰 Change Budget</h1>
      <div className="divider" />
      <h3>Current Budgets</h3>
      <div className="card">
        <div>Monthly budget = {budget?.monthly ?? 500}</div>
        <div>Yearly budget = {budget?.yearly ?? 6000}</div>
      </div>
      <div className="divider" />
      <BudgetForm initialMonthly={budget?.monthly ?? 500} initialYearly={budget?.yearly ?? 6000} />
    </div>
  );
}
