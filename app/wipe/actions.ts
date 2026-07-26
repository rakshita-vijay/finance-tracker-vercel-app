"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function wipeTransactions(password: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Not authenticated." };

  if (user.email === process.env.DEMO_EMAIL) {
    return { error: "Sorry, this is the demo account. You cannot wipe transactions from this account :(" };
  }

  // Re-verify the password before destructive action, same as the old app.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) return { error: "Incorrect password. Transactions not wiped." };

  const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/spending");
  revalidatePath("/downloads");
  return { success: "All transactions wiped!" };
}
