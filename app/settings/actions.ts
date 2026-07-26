"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount(password: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Not authenticated." };

  if (user.email === process.env.DEMO_EMAIL) {
    return { error: "This is the demo account. You cannot delete this account :(" };
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) return { error: "Incorrect password. Account not deleted." };

  // Data rows cascade-delete via foreign keys once the auth user is removed.
  // Deleting the auth user requires the service role key, so this uses an
  // RPC function defined in supabase/schema.sql (see delete_own_account()).
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect("/login");
}
