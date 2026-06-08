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

-- ---------------------------------------------------------------------------
-- Telegram bot: account links + one-time connect codes
-- ---------------------------------------------------------------------------

create table if not exists public.telegram_links (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  telegram_id       bigint unique not null,
  telegram_username text,
  created_at        timestamptz not null default now()
);

create table if not exists public.telegram_codes (
  code       text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists telegram_links_user_id_idx on public.telegram_links (user_id);
create index if not exists telegram_codes_user_id_idx on public.telegram_codes (user_id);

alter table public.telegram_links enable row level security;
alter table public.telegram_codes enable row level security;

-- Users can read/insert/delete only their own rows. The webhook uses the
-- service-role key, which bypasses RLS entirely.
create policy "telegram_links_select_own"
  on public.telegram_links for select
  to authenticated
  using (user_id = auth.uid());

create policy "telegram_links_insert_own"
  on public.telegram_links for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "telegram_links_delete_own"
  on public.telegram_links for delete
  to authenticated
  using (user_id = auth.uid());

create policy "telegram_codes_select_own"
  on public.telegram_codes for select
  to authenticated
  using (user_id = auth.uid());

create policy "telegram_codes_insert_own"
  on public.telegram_codes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "telegram_codes_delete_own"
  on public.telegram_codes for delete
  to authenticated
  using (user_id = auth.uid());

-- Pending Telegram transactions awaiting inline-button confirmation. Only the
-- service-role webhook reads/writes these, so RLS is enabled with NO policies
-- (authenticated clients have no access; the service role bypasses RLS).
create table if not exists public.telegram_pending (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  telegram_id bigint not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists telegram_pending_telegram_id_idx
  on public.telegram_pending (telegram_id);

alter table public.telegram_pending enable row level security;

-- ---------------------------------------------------------------------------
-- Savings goals
-- ---------------------------------------------------------------------------

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  target_amount numeric not null,
  saved_amount  numeric not null default 0,
  target_date   date,
  created_at    timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;

create policy "goals_select_own"
  on public.goals for select
  to authenticated
  using (user_id = auth.uid());

create policy "goals_insert_own"
  on public.goals for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "goals_update_own"
  on public.goals for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goals_delete_own"
  on public.goals for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Debt tracker (qarzlar): money the user borrowed from / lent to people
-- ---------------------------------------------------------------------------

create table if not exists public.debts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  person     text not null,
  amount     numeric not null,
  -- 'borrowed' = the user took money from person; 'lent' = the user gave money.
  direction  text not null check (direction in ('borrowed', 'lent')),
  note       text,
  settled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts (user_id);

alter table public.debts enable row level security;

create policy "debts_select_own"
  on public.debts for select
  to authenticated
  using (user_id = auth.uid());

create policy "debts_insert_own"
  on public.debts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "debts_update_own"
  on public.debts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "debts_delete_own"
  on public.debts for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Investment / portfolio holdings
-- ---------------------------------------------------------------------------
-- buy_price and manual_price are in UZS per unit. Per type:
--   'kripto'   — symbol = CoinGecko id (e.g. "bitcoin", "ethereum", "pax-gold")
--   'valyuta'  — symbol = currency code (e.g. "USD", "EUR", "RUB")
--   'aksiya'   — manual_price = current UZS price per share (user-updated)
--   'jamgarma' — quantity = the UZS principal; interest_rate = annual % compounded
--                monthly over term_months. Value accrues from created_at and is
--                held at the maturity amount once the term ends.

create table if not exists public.investments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          text not null check (type in ('valyuta', 'kripto', 'aksiya', 'jamgarma')),
  name          text not null,
  symbol        text,
  quantity      numeric not null,
  buy_price     numeric,
  manual_price  numeric,
  interest_rate numeric,   -- jamgarma: annual interest rate in % (compounded monthly)
  term_months   integer,   -- jamgarma: deposit term in whole months
  created_at    timestamptz not null default now()
);

create index if not exists investments_user_id_idx on public.investments (user_id);

alter table public.investments enable row level security;

create policy "investments_select_own"
  on public.investments for select
  to authenticated
  using (user_id = auth.uid());

create policy "investments_insert_own"
  on public.investments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "investments_update_own"
  on public.investments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "investments_delete_own"
  on public.investments for delete
  to authenticated
  using (user_id = auth.uid());
