-- Jugnu accounts, subscriptions and admin tools.
-- Lives in the shared Supabase project next to Ginti, so every object is prefixed jugnu_ and nothing
-- of Ginti's is touched. Plans only change through the security-definer functions below.
--
-- Plans: 'trial' (free, starts automatically on first sign-in), 'pro' (given by an admin, until a
-- date or for ever), 'none' (no AI). Alarms and routines work for everyone; only Jugnu AI needs a plan.

create table if not exists public.jugnu_profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  avatar text,
  plan text not null default 'none' check (plan in ('none', 'trial', 'pro')),
  plan_until timestamptz,            -- null with 'pro' = no end date
  plan_note text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.jugnu_plan_log (
  id bigserial primary key,
  user_id uuid not null references public.jugnu_profiles on delete cascade,
  plan text not null,
  plan_until timestamptz,
  note text,
  amount integer not null default 0,  -- rupees received for this change (UPI or cash), 0 if free
  method text check (method in ('upi', 'cash', 'free', 'other')),
  admin_id uuid references public.jugnu_profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists jugnu_plan_log_user on public.jugnu_plan_log (user_id, created_at desc);

create table if not exists public.jugnu_ai_usage (
  id bigserial primary key,
  user_id uuid not null references public.jugnu_profiles on delete cascade,
  feature text not null,
  ok boolean not null,
  model text,
  ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists jugnu_ai_usage_user on public.jugnu_ai_usage (user_id, created_at desc);

-- Emails that become admins the first time they sign in to Jugnu.
create table if not exists public.jugnu_admin_emails (email text primary key);

-- Knobs the admin can change from the app.
create table if not exists public.jugnu_settings (key text primary key, value text not null);
insert into public.jugnu_settings (key, value) values
  ('trial_days', '30'),      -- free trial length for new users (0 = no trial)
  ('daily_limit', '30')      -- AI requests per person per day, to keep costs safe
on conflict (key) do nothing;

alter table public.jugnu_profiles enable row level security;
alter table public.jugnu_plan_log enable row level security;
alter table public.jugnu_ai_usage enable row level security;
alter table public.jugnu_admin_emails enable row level security;
alter table public.jugnu_settings enable row level security;

create or replace function public.jugnu_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.jugnu_profiles where id = auth.uid()), false);
$$;

/** True while a plan gives access to Jugnu AI. */
create or replace function public.jugnu_plan_active(p public.jugnu_profiles) returns boolean
language sql immutable as $$
  select p.plan in ('trial', 'pro') and (p.plan_until is null or p.plan_until > now());
$$;

-- Users see their own rows; admins see everyone's. No direct writes: the functions do that.
drop policy if exists jugnu_profiles_read on public.jugnu_profiles;
create policy jugnu_profiles_read on public.jugnu_profiles for select using (id = auth.uid() or public.jugnu_is_admin());
drop policy if exists jugnu_plan_log_read on public.jugnu_plan_log;
create policy jugnu_plan_log_read on public.jugnu_plan_log for select using (user_id = auth.uid() or public.jugnu_is_admin());
drop policy if exists jugnu_ai_usage_read on public.jugnu_ai_usage;
create policy jugnu_ai_usage_read on public.jugnu_ai_usage for select using (user_id = auth.uid() or public.jugnu_is_admin());
drop policy if exists jugnu_settings_read on public.jugnu_settings;
create policy jugnu_settings_read on public.jugnu_settings for select using (auth.uid() is not null);

/** The signed-in user's profile, created on first call with the free trial. */
create or replace function public.jugnu_me() returns public.jugnu_profiles
language plpgsql security definer set search_path = public as $$
declare
  me public.jugnu_profiles;
  u auth.users;
  trial integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.jugnu_profiles set last_seen = now() where id = auth.uid() returning * into me;
  if found then return me; end if;
  select * into u from auth.users where id = auth.uid();
  trial := coalesce((select value::integer from public.jugnu_settings where key = 'trial_days'), 0);
  insert into public.jugnu_profiles (id, email, name, avatar, plan, plan_until, plan_note, is_admin)
  values (
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.raw_user_meta_data->>'avatar_url',
    case when trial > 0 then 'trial' else 'none' end,
    case when trial > 0 then now() + make_interval(days => trial) end,
    case when trial > 0 then trial || '-day free trial' end,
    exists (select 1 from public.jugnu_admin_emails a where lower(a.email) = lower(u.email))
  )
  returning * into me;
  insert into public.jugnu_plan_log (user_id, plan, plan_until, note) values (me.id, me.plan, me.plan_until, coalesce(me.plan_note, 'Signed up'));
  return me;
end;
$$;

/**
 * For the jugnu-ai Edge Function (service role): may this user make an AI request now?
 * Returns 'ok', 'no_plan', 'expired' or 'limit'.
 */
create or replace function public.jugnu_ai_check(p_user uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  p public.jugnu_profiles;
  used integer;
  lim integer;
begin
  select * into p from public.jugnu_profiles where id = p_user;
  if not found or p.plan = 'none' then return 'no_plan'; end if;
  if not public.jugnu_plan_active(p) then return 'expired'; end if;
  lim := coalesce((select value::integer from public.jugnu_settings where key = 'daily_limit'), 30);
  select count(*) into used from public.jugnu_ai_usage where user_id = p_user and ok and created_at > now() - interval '1 day';
  if lim > 0 and used >= lim then return 'limit'; end if;
  return 'ok';
end;
$$;

/**
 * Admin: set someone's plan.
 *  p_plan 'pro' or 'trial' with p_days > 0 = that many days from today (or from the current end date
 *  when p_extend is true); p_days = 0 with 'pro' = no end date; p_plan 'none' removes access.
 */
create or replace function public.jugnu_admin_set_plan(p_user uuid, p_plan text, p_days integer, p_extend boolean, p_note text,
                                                        p_amount integer default 0, p_method text default null)
returns public.jugnu_profiles
language plpgsql security definer set search_path = public as $$
declare
  p public.jugnu_profiles;
  base timestamptz;
  until_ timestamptz;
begin
  if not public.jugnu_is_admin() then raise exception 'admins only'; end if;
  if p_plan not in ('none', 'trial', 'pro') then raise exception 'unknown plan'; end if;
  if coalesce(p_amount, 0) < 0 then raise exception 'amount cannot be negative'; end if;
  if p_method is not null and p_method not in ('upi', 'cash', 'free', 'other') then raise exception 'unknown payment method'; end if;
  select * into p from public.jugnu_profiles where id = p_user;
  if not found then raise exception 'no such user'; end if;
  base := case when p_extend and p.plan_until is not null and p.plan_until > now() then p.plan_until else now() end;
  until_ := case
    when p_plan = 'none' then null
    when coalesce(p_days, 0) > 0 then base + make_interval(days => p_days)
    when p_plan = 'pro' then null
    else now() + interval '30 days'
  end;
  update public.jugnu_profiles
     set plan = p_plan, plan_until = until_, plan_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_user
  returning * into p;
  insert into public.jugnu_plan_log (user_id, plan, plan_until, note, amount, method, admin_id)
  values (p_user, p_plan, until_, coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Changed by admin'),
          coalesce(p_amount, 0), coalesce(p_method, case when coalesce(p_amount, 0) = 0 then 'free' end), auth.uid());
  return p;
end;
$$;

/** Admin: make someone an admin or not (you can't remove yourself). */
create or replace function public.jugnu_admin_set_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.jugnu_is_admin() then raise exception 'admins only'; end if;
  if p_user = auth.uid() and not p_admin then raise exception 'you cannot remove your own admin access'; end if;
  update public.jugnu_profiles set is_admin = p_admin where id = p_user;
end;
$$;

/** Admin: change trial_days or daily_limit. */
create or replace function public.jugnu_admin_set_setting(p_key text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.jugnu_is_admin() then raise exception 'admins only'; end if;
  if p_key not in ('trial_days', 'daily_limit') then raise exception 'unknown setting'; end if;
  if p_value !~ '^[0-9]{1,4}$' then raise exception 'must be a whole number'; end if;
  insert into public.jugnu_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;

/** Admin: users with their plan and AI use, newest first, optionally filtered by name or email. */
create or replace function public.jugnu_admin_users(p_search text default '')
returns table (id uuid, email text, name text, plan text, plan_until timestamptz, plan_note text, active boolean,
               is_admin boolean, created_at timestamptz, last_seen timestamptz, ai_calls bigint, ai_today bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jugnu_is_admin() then raise exception 'admins only'; end if;
  return query
  select p.id, p.email, p.name, p.plan, p.plan_until, p.plan_note, public.jugnu_plan_active(p),
         p.is_admin, p.created_at, p.last_seen,
         (select count(*) from public.jugnu_ai_usage a where a.user_id = p.id and a.ok),
         (select count(*) from public.jugnu_ai_usage a where a.user_id = p.id and a.ok and a.created_at > now() - interval '1 day')
  from public.jugnu_profiles p
  where coalesce(p_search, '') = '' or p.email ilike '%' || p_search || '%' or p.name ilike '%' || p_search || '%'
  order by p.created_at desc
  limit 300;
end;
$$;

/** Admin: totals for the dashboard. */
create or replace function public.jugnu_admin_stats()
returns table (users bigint, users_7d bigint, pro bigint, trials bigint, expiring_7d bigint,
               ai_today bigint, ai_30d bigint, failures_today bigint, earned_30d bigint, earned_total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.jugnu_is_admin() then raise exception 'admins only'; end if;
  return query select
    (select count(*) from public.jugnu_profiles),
    (select count(*) from public.jugnu_profiles where created_at > now() - interval '7 days'),
    (select count(*) from public.jugnu_profiles p where p.plan = 'pro' and public.jugnu_plan_active(p)),
    (select count(*) from public.jugnu_profiles p where p.plan = 'trial' and public.jugnu_plan_active(p)),
    (select count(*) from public.jugnu_profiles p where public.jugnu_plan_active(p) and p.plan_until between now() and now() + interval '7 days'),
    (select count(*) from public.jugnu_ai_usage where ok and created_at > date_trunc('day', now())),
    (select count(*) from public.jugnu_ai_usage where ok and created_at > now() - interval '30 days'),
    (select count(*) from public.jugnu_ai_usage where not ok and created_at > date_trunc('day', now())),
    (select coalesce(sum(amount), 0) from public.jugnu_plan_log where created_at > now() - interval '30 days'),
    (select coalesce(sum(amount), 0) from public.jugnu_plan_log);
end;
$$;

revoke all on function public.jugnu_ai_check(uuid) from public, anon, authenticated;
grant execute on function public.jugnu_ai_check(uuid) to service_role;
revoke all on function public.jugnu_me() from public, anon;
grant execute on function public.jugnu_me() to authenticated;
grant execute on function public.jugnu_admin_set_plan(uuid, text, integer, boolean, text, integer, text) to authenticated;
grant execute on function public.jugnu_admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.jugnu_admin_set_setting(text, text) to authenticated;
grant execute on function public.jugnu_admin_users(text) to authenticated;
grant execute on function public.jugnu_admin_stats() to authenticated;
