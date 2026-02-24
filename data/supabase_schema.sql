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
