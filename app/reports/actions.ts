"use server";

import { createClient } from "@/lib/supabase/server";
import { generateFinancialReport } from "@/lib/aiReport";
import type { Transaction } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function generateReport() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("s_no", { ascending: true });
  if (txError) return { error: txError.message };

  if (!transactions || transactions.length === 0) {
    return { error: "No transactions found - add some transactions before generating a report." };
  }

  const { data: budget } = await supabase
    .from("budgets")
    .select("monthly, yearly")
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const content = await generateFinancialReport(
      transactions as Transaction[],
      budget ?? { monthly: 500, yearly: 6000 }
    );

    const { data: saved, error: insertError } = await supabase
      .from("reports")
      .insert({ user_id: user.id, content })
      .select("id, content, created_at")
      .single();

    if (insertError) return { error: insertError.message };

    revalidatePath("/reports");
    return { success: true, report: saved };
  } catch (e: any) {
    return { error: `Error during report generation: ${e.message ?? e}` };
  }
}

export async function deleteReport(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("reports").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/reports");
  return { success: true };
}
