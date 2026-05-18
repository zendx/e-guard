-- Swave application schema for Supabase

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  address text not null default '',
  country text not null default '',
  state text not null default '',
  password_hash text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  pro_interest boolean not null default false,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  created_at timestamptz not null default now()
);

alter table public.app_users add column if not exists address text not null default '';
alter table public.app_users add column if not exists country text not null default '';
alter table public.app_users add column if not exists state text not null default '';

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions(expires_at);

create table if not exists public.user_metrics (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  usage_count integer not null default 0,
  copy_clicks integer not null default 0,
  post_clicks integer not null default 0,
  usage_limit_override integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_metrics add column if not exists usage_limit_override integer;

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('free_usage_limit', '10')
on conflict (key) do nothing;

create table if not exists public.app_rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  title text not null,
  message text not null,
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.account_delete_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  user_email text not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_broadcast_idx on public.notifications(is_broadcast);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notification_reads_user_id_idx on public.notification_reads(user_id);
create index if not exists account_delete_requests_user_id_idx on public.account_delete_requests(user_id);
create index if not exists account_delete_requests_status_idx on public.account_delete_requests(status);
create index if not exists app_rate_limits_reset_at_idx on public.app_rate_limits(reset_at);

create or replace function public.check_app_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (
  ok boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_count integer;
  v_limit integer := greatest(1, p_limit);
  v_window_ms integer := greatest(1000, p_window_ms);
begin
  delete from public.app_rate_limits
  where reset_at < v_now - interval '1 hour';

  insert into public.app_rate_limits as rl (key, count, reset_at, updated_at)
  values (
    p_key,
    1,
    v_now + (v_window_ms * interval '1 millisecond'),
    v_now
  )
  on conflict (key) do update
  set
    count = case
      when rl.reset_at <= v_now then 1
      else rl.count + 1
    end,
    reset_at = case
      when rl.reset_at <= v_now then v_now + (v_window_ms * interval '1 millisecond')
      else rl.reset_at
    end,
    updated_at = v_now
  returning rl.count, rl.reset_at
  into v_count, v_reset_at;

  ok := v_count <= v_limit;
  remaining := greatest(0, v_limit - v_count);
  reset_at := v_reset_at;
  return next;
end;
$$;

create or replace function public.track_user_action_atomic(
  p_user_id uuid,
  p_action text
)
returns table (
  user_id uuid,
  usage_count integer,
  copy_clicks integer,
  post_clicks integer,
  usage_limit_override integer,
  global_free_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global_limit integer;
  v_effective_limit integer;
begin
  if p_action not in ('copy', 'post') then
    raise exception 'Invalid action: %', p_action;
  end if;

  select greatest(
    1,
    least(
      1000,
      case when value ~ '^[0-9]+$' then value::integer else 10 end
    )
  )
  into v_global_limit
  from public.app_settings
  where key = 'free_usage_limit';

  v_global_limit := coalesce(v_global_limit, 10);

  insert into public.user_metrics (
    user_id,
    usage_count,
    copy_clicks,
    post_clicks,
    usage_limit_override
  )
  values (p_user_id, 0, 0, 0, null)
  on conflict (user_id) do nothing;

  select coalesce(usage_limit_override, v_global_limit)
  into v_effective_limit
  from public.user_metrics
  where user_metrics.user_id = p_user_id;

  update public.user_metrics
  set
    usage_count = user_metrics.usage_count + 1,
    copy_clicks = user_metrics.copy_clicks + case when p_action = 'copy' then 1 else 0 end,
    post_clicks = user_metrics.post_clicks + case when p_action = 'post' then 1 else 0 end
  where user_metrics.user_id = p_user_id
    and user_metrics.usage_count < v_effective_limit;

  return query
  select
    m.user_id,
    m.usage_count,
    m.copy_clicks,
    m.post_clicks,
    m.usage_limit_override,
    v_global_limit
  from public.user_metrics m
  where m.user_id = p_user_id;
end;
$$;

-- optional trigger for updated_at maintenance on user_metrics
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_metrics_updated_at on public.user_metrics;
create trigger user_metrics_updated_at
before update on public.user_metrics
for each row
execute function public.update_updated_at_column();

drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at
before update on public.app_settings
for each row
execute function public.update_updated_at_column();

-- The app uses a server-only Supabase service role key from Next.js API routes.
-- Disable RLS on these private app tables unless you want to manage explicit policies.
alter table public.app_users disable row level security;
alter table public.app_sessions disable row level security;
alter table public.user_metrics disable row level security;
alter table public.notifications disable row level security;
alter table public.notification_reads disable row level security;
alter table public.account_delete_requests disable row level security;
alter table public.app_settings disable row level security;
alter table public.app_rate_limits disable row level security;
