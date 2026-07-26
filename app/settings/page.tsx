import { createClient } from "@/lib/supabase/server";
import SettingsControls from "./SettingsControls";

export default async function AccountSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDemo = user?.email === process.env.DEMO_EMAIL;

  return (
    <div>
      <h1>⚙️ Account Settings</h1>
      <div className="divider" />
      <p>Logged in as: <strong>{user?.email}</strong></p>
      <div className="divider" />
      <SettingsControls isDemo={isDemo} />
    </div>
  );
}
