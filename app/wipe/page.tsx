import { createClient } from "@/lib/supabase/server";
import WipeForm from "./WipeForm";

export default async function WipeTransactionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDemo = user?.email === process.env.DEMO_EMAIL;

  return (
    <div>
      <h1>🗑️ Wipe Transactions</h1>
      <div className="divider" />
      {isDemo ? (
        <div className="msg-error">
          Sorry, this is the demo account. You cannot wipe transactions from this account :(
        </div>
      ) : (
        <WipeForm />
      )}
    </div>
  );
}
