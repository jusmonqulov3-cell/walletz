-- PulNazorat — database schema with Row Level Security (RLS)
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- categories: user-owned + shared defaults (user_id null, is_default true)
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  name        text not null,
  icon        text,
  is_default  boolean not null default false
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  raw_text    text,
  amount      numeric not null,
  category    text,
  note        text,
  currency    text not null default 'UZS',
  spent_at    timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      numeric not null,
  source      text,
  note        text,
  received_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category      text,
  monthly_limit numeric,
  period_start  date,
  created_at    timestamptz not null default now()
);

-- Helpful indexes for per-user lookups
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists incomes_user_id_idx  on public.incomes (user_id);
create index if not exists budgets_user_id_idx   on public.budgets (user_id);
create index if not exists categories_user_id_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.expenses   enable row level security;
alter table public.incomes    enable row level security;
alter table public.budgets    enable row level security;

-- categories: read own rows OR shared defaults; write only own rows
create policy "categories_select_own_or_default"
  on public.categories for select
  to authenticated
  using (user_id = auth.uid() or is_default = true);

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (user_id = auth.uid());

-- expenses: full access to own rows only
create policy "expenses_select_own"
  on public.expenses for select
  to authenticated
  using (user_id = auth.uid());

create policy "expenses_insert_own"
  on public.expenses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "expenses_update_own"
  on public.expenses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "expenses_delete_own"
  on public.expenses for delete
  to authenticated
  using (user_id = auth.uid());

-- incomes: full access to own rows only
create policy "incomes_select_own"
  on public.incomes for select
  to authenticated
  using (user_id = auth.uid());

create policy "incomes_insert_own"
  on public.incomes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "incomes_update_own"
  on public.incomes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "incomes_delete_own"
  on public.incomes for delete
  to authenticated
  using (user_id = auth.uid());

-- budgets: full access to own rows only
create policy "budgets_select_own"
  on public.budgets for select
  to authenticated
  using (user_id = auth.uid());

create policy "budgets_insert_own"
  on public.budgets for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "budgets_update_own"
  on public.budgets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budgets_delete_own"
  on public.budgets for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed default categories (shared, user_id null, is_default true)
-- ---------------------------------------------------------------------------

insert into public.categories (user_id, name, icon, is_default)
values
  (null, 'Oziq-ovqat',   '🍞', true),
  (null, 'Transport',    '🚌', true),
  (null, 'Uy',           '🏠', true),
  (null, 'Kommunal',     '💡', true),
  (null, 'Kiyim',        '👕', true),
  (null, 'Sog''liq',     '🩺', true),
  (null, 'O''yin-kulgi', '🎮', true),
  (null, 'Boshqa',       '📦', true)
on conflict do nothing;
