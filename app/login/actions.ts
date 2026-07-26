"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthResult = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(formData: FormData): Promise<AuthResult | undefined> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Please enter your email/username and password." };
  }

  const supabase = createClient();

  let email = identifier;
  if (!EMAIL_RE.test(identifier)) {
    const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
      "email_for_username",
      { input_username: identifier }
    );
    if (lookupError || !resolvedEmail) {
      return { error: "No account found for that username." };
    }
    email = resolvedEmail;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function register(formData: FormData): Promise<AuthResult | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !username || !password) {
    return { error: "Please enter an email, username, and password." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return { error: "Username must be 3-32 characters (letters, numbers, _ . -)." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ user_id: data.user.id, username });

    if (profileError) {
      return {
        error: profileError.message.includes("duplicate")
          ? "That username is already taken."
          : profileError.message,
      };
    }

    // Seed the new user's budget row so /budget and /reports work immediately.
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
