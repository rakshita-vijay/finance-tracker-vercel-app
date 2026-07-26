"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthResult = { error?: string; success?: string };

export async function login(formData: FormData): Promise<AuthResult | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function register(formData: FormData): Promise<AuthResult | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Seed the new user's budget row so /budget and /reports work immediately.
  if (data.user) {
    await supabase.from("budgets").upsert({
      user_id: data.user.id,
      monthly: 500,
      yearly: 6000,
    });
  }

  if (!data.session) {
    return {
      success: "Registration successful! Check your email to confirm your account, then log in.",
    };
  }

  redirect("/");
}
