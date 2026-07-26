-- Run this once in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

-- Transactions -----------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  s_no int not null,
  txn_date date not null,
  description text not null,
  amount numeric not null,
  payment_method text not null,
  status text not null,
  notes text default '',
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Users manage their own transactions"
  on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists transactions_user_id_idx on public.transactions (user_id, s_no);

-- Budgets (one row per user) ----------------------------------------------
create table if not exists public.budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly numeric not null default 500,
  yearly numeric not null default 6000,
  updated_at timestamptz default now()
);

alter table public.budgets enable row level security;

create policy "Users manage their own budget"
  on public.budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reports (full history, this is what used to disappear on refresh) ------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

create policy "Users manage their own reports"
  on public.reports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists reports_user_id_idx on public.reports (user_id, created_at desc);

-- Lets a logged-in user delete their own auth account (and, via the FK
-- "on delete cascade" clauses above, all of their transactions/budget/reports)
-- without needing to expose a service-role key to the client.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
