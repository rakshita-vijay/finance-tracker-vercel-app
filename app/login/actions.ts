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

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

// Supabase Auth always needs a real-looking email, even for "username-only"
// signups - this is a syntactically valid but non-deliverable placeholder.
const PLACEHOLDER_EMAIL_DOMAIN = "users.financetracker.invalid";

function sanitizeUsername(raw: string): string {
  let u = raw.replace(/[^a-zA-Z0-9_.-]/g, "");
  if (u.length < 3) u = u.padEnd(3, "0");
  if (u.length > 32) u = u.slice(0, 32);
  return u;
}

export async function register(formData: FormData): Promise<AuthResult | undefined> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Please enter an email or username, and a password." };
  }

  const usedRealEmail = EMAIL_RE.test(identifier);
  let email: string;
  let username: string;

  if (usedRealEmail) {
    email = identifier;
    username = sanitizeUsername(identifier.split("@")[0]);
  } else {
    if (!USERNAME_RE.test(identifier)) {
      return {
        error: "Username must be 3-32 characters (letters, numbers, _ . -), or enter a valid email instead.",
      };
    }
    username = identifier;
    email = `${identifier}@${PLACEHOLDER_EMAIL_DOMAIN}`;
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    let finalUsername = username;
    let profileError: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: insertErr } = await supabase
        .from("profiles")
        .insert({ user_id: data.user.id, username: finalUsername });

      if (!insertErr) {
        profileError = null;
        break;
      }
      if (insertErr.message.toLowerCase().includes("duplicate")) {
        finalUsername = sanitizeUsername(`${username}${Math.floor(Math.random() * 10000)}`);
        profileError = insertErr.message;
        continue;
      }
      profileError = insertErr.message;
      break;
    }

    if (profileError) {
      return { error: usedRealEmail ? profileError : "That username is already taken." };
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
      success: usedRealEmail
        ? "Registration successful! Check your email to confirm your account, then log in."
        : "Registration successful! If your project has email confirmation turned on, ask the site admin to disable it for username-only signups (no real email was used, so no confirmation link can be sent).",
    };
  }

  redirect("/");
}
