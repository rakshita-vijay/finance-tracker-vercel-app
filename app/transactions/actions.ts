"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NewTransaction = {
  date: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: string;
  notes: string;
};

export async function addTransactions(rows: NewTransaction[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const errors: string[] = [];
  rows.forEach((r, i) => {
    if (!r.date) errors.push(`Transaction #${i + 1}: Date is required.`);
    if (!r.description.trim()) errors.push(`Transaction #${i + 1}: Description is required.`);
    if (!r.amount) errors.push(`Transaction #${i + 1}: Amount cannot be zero.`);
  });
  if (errors.length) return { error: errors.join(" ") };

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  let nextSNo = (count ?? 0) + 1;

  const toInsert = rows.map((r) => ({
    user_id: user.id,
    s_no: nextSNo++,
    txn_date: r.date,
    description: r.description.trim(),
    amount: r.amount,
    payment_method: r.paymentMethod,
    status: r.status,
    notes: r.notes.trim(),
  }));

  const { error } = await supabase.from("transactions").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/spending");
  revalidatePath("/downloads");
  return { success: `${rows.length} transaction(s) added!` };
}
