export type Transaction = {
  id: string;
  s_no: number;
  txn_date: string;
  description: string;
  amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
};

export type Budget = {
  monthly: number;
  yearly: number;
};

export type Report = {
  id: string;
  content: string;
  analysis?: string | null;
  created_at: string;
};

export const HEADERS = [
  "S.NO",
  "DATE",
  "DESCRIPTION",
  "AMOUNT",
  "PAYMENT METHOD",
  "STATUS",
  "NOTES",
] as const;
