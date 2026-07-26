"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBudget(type: "monthly" | "yearly", value: number) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const monthly = type === "monthly" ? value : Math.floor(value / 12);
  const yearly = type === "yearly" ? value : Math.floor(value * 12);

  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: user.id, monthly, yearly, updated_at: new Date().toISOString() });

  if (error) return { error: error.message };

  revalidatePath("/budget");
  revalidatePath("/spending");
  return { success: true, monthly, yearly };
}
