-- MiniBank core schema
-- Users can only READ their own rows (RLS). Balances change ONLY through the
-- SECURITY DEFINER functions transfer_funds() and pay_bill(), which lock the
-- account rows (SELECT ... FOR UPDATE) and reject overdrafts atomically.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_number text not null unique check (account_number ~ '^[0-9]{10}$'),
  account_type text not null check (account_type in ('savings','current','domiciliary')),
  currency text not null default 'NGN' check (currency in ('NGN','USD','GBP')),
  nickname text,
  balance numeric(16,2) not null default 0 check (balance >= 0),   -- hard overdraft guard
  created_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts(user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('credit','debit')),
  category text not null check (category in ('transfer','airtime','data','electricity','cable','deposit')),
  amount numeric(16,2) not null check (amount > 0),
  balance_after numeric(16,2) not null,
  counterparty text,
  narration text,
  reference text not null,
  status text not null default 'successful' check (status in ('successful','failed','pending')),
  created_at timestamptz not null default now()
);
create index transactions_account_idx on public.transactions(account_id, created_at desc);
create index transactions_user_idx on public.transactions(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "accounts_select_own" on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.accounts, public.transactions from anon;
revoke insert, update, delete on public.accounts, public.transactions from authenticated;
revoke all on public.profiles from anon;
revoke insert, delete, update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.gen_reference(prefix text)
returns text language sql volatile set search_path = '' as $$
  select prefix || to_char(now() at time zone 'Africa/Lagos','YYMMDDHH24MISS') || upper(substr(md5(gen_random_uuid()::text),1,6));
$$;

create or replace function public.gen_account_number()
returns text language plpgsql volatile set search_path = '' as $$
declare n text;
begin
  loop
    n := '30' || lpad((floor(random()*100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.accounts where account_number = n);
  end loop;
  return n;
end $$;

-- Onboarding: profile + NGN savings + USD domiciliary with demo opening balances
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ngn uuid; usd uuid;
begin
  insert into public.profiles(id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'phone');
  insert into public.accounts(user_id, account_number, account_type, currency, nickname, balance)
  values (new.id, public.gen_account_number(), 'savings', 'NGN', 'Naira Savings', 250000) returning id into ngn;
  insert into public.accounts(user_id, account_number, account_type, currency, nickname, balance)
  values (new.id, public.gen_account_number(), 'domiciliary', 'USD', 'Dollar Domiciliary', 500) returning id into usd;
  insert into public.transactions(account_id,user_id,direction,category,amount,balance_after,counterparty,narration,reference)
  values (ngn,new.id,'credit','deposit',250000,250000,'MiniBank','Welcome bonus (demo funds)',public.gen_reference('DEP')),
         (usd,new.id,'credit','deposit',500,500,'MiniBank','Welcome bonus (demo funds)',public.gen_reference('DEP'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Name enquiry
create or replace function public.lookup_account(p_account_number text)
returns table(account_name text, currency text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query select p.full_name, a.currency from public.accounts a join public.profiles p on p.id = a.user_id
    where a.account_number = p_account_number;
end $$;

-- Atomic P2P transfer with overdraft protection
create or replace function public.transfer_funds(p_from_account uuid, p_to_account_number text, p_amount numeric, p_narration text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_src public.accounts; v_dst public.accounts;
  v_ref text := public.gen_reference('TRF');
  v_src_name text; v_dst_name text; v_dst_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if round(p_amount,2) <> p_amount then raise exception 'Amount can have at most 2 decimal places'; end if;
  if p_amount > 5000000 then raise exception 'Amount exceeds single-transfer limit'; end if;

  select id into v_dst_id from public.accounts where account_number = p_to_account_number;
  if v_dst_id is null then raise exception 'Recipient account not found'; end if;
  if v_dst_id = p_from_account then raise exception 'Cannot transfer to the same account'; end if;

  perform 1 from public.accounts where id in (p_from_account, v_dst_id) order by id for update;  -- consistent lock order
  select * into v_src from public.accounts where id = p_from_account;
  select * into v_dst from public.accounts where id = v_dst_id;

  if v_src.id is null or v_src.user_id <> v_uid then raise exception 'Source account not found'; end if;
  if v_src.currency <> v_dst.currency then raise exception 'Currency mismatch: % to % transfers are not supported', v_src.currency, v_dst.currency; end if;
  if v_src.balance < p_amount then raise exception 'Insufficient funds'; end if;

  update public.accounts set balance = balance - p_amount where id = v_src.id returning * into v_src;
  update public.accounts set balance = balance + p_amount where id = v_dst.id returning * into v_dst;
  select full_name into v_src_name from public.profiles where id = v_src.user_id;
  select full_name into v_dst_name from public.profiles where id = v_dst.user_id;

  insert into public.transactions(account_id,user_id,direction,category,amount,balance_after,counterparty,narration,reference)
  values (v_src.id, v_src.user_id, 'debit','transfer', p_amount, v_src.balance, v_dst_name || ' · ' || v_dst.account_number, nullif(trim(p_narration),''), v_ref),
         (v_dst.id, v_dst.user_id, 'credit','transfer', p_amount, v_dst.balance, v_src_name || ' · ' || v_src.account_number, nullif(trim(p_narration),''), v_ref);
  return json_build_object('reference', v_ref, 'balance', v_src.balance, 'recipient', v_dst_name);
end $$;

-- Airtime / data / utility bills (NGN only)
create or replace function public.pay_bill(p_from_account uuid, p_category text, p_biller text, p_customer_ref text, p_amount numeric)
returns json language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_src public.accounts; v_ref text := public.gen_reference('BIL');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_category not in ('airtime','data','electricity','cable') then raise exception 'Unsupported bill category'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if round(p_amount,2) <> p_amount then raise exception 'Amount can have at most 2 decimal places'; end if;
  if coalesce(trim(p_biller),'') = '' or coalesce(trim(p_customer_ref),'') = '' then raise exception 'Biller and customer reference are required'; end if;
  if p_category in ('airtime','data') and p_customer_ref !~ '^0[789][01][0-9]{8}$' then raise exception 'Enter a valid 11-digit Nigerian phone number'; end if;

  select * into v_src from public.accounts where id = p_from_account for update;
  if v_src.id is null or v_src.user_id <> v_uid then raise exception 'Source account not found'; end if;
  if v_src.currency <> 'NGN' then raise exception 'Bill payments must be made from a Naira account'; end if;
  if v_src.balance < p_amount then raise exception 'Insufficient funds'; end if;

  update public.accounts set balance = balance - p_amount where id = v_src.id returning * into v_src;
  insert into public.transactions(account_id,user_id,direction,category,amount,balance_after,counterparty,narration,reference)
  values (v_src.id, v_uid, 'debit', p_category, p_amount, v_src.balance, p_biller, p_customer_ref, v_ref);
  return json_build_object('reference', v_ref, 'balance', v_src.balance);
end $$;

revoke execute on function public.transfer_funds(uuid,text,numeric,text) from public, anon;
revoke execute on function public.pay_bill(uuid,text,text,text,numeric) from public, anon;
revoke execute on function public.lookup_account(text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.gen_account_number() from public, anon, authenticated;
revoke execute on function public.gen_reference(text) from public, anon, authenticated;
grant execute on function public.transfer_funds(uuid,text,numeric,text) to authenticated;
grant execute on function public.pay_bill(uuid,text,text,text,numeric) to authenticated;
grant execute on function public.lookup_account(text) to authenticated;

-- Realtime (postgres_changes respects RLS)
alter publication supabase_realtime add table public.accounts, public.transactions;
