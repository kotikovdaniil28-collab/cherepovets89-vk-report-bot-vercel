-- CH89 VK Bot v3 SQL
-- Run in the SAME Supabase project used by the website.
-- Adds VK links, report sessions, and dynamic VK group bindings.

create table if not exists public.vk_links (
  vk_user_id text primary key,
  site_user_id text not null,
  email text not null,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vk_links_site_user_id_key
  on public.vk_links (site_user_id);

create table if not exists public.vk_report_sessions (
  session_key text primary key,
  vk_user_id text not null,
  peer_id text not null,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vk_report_sessions_updated_at_idx
  on public.vk_report_sessions (updated_at);

create table if not exists public.vk_group_bindings (
  peer_id text primary key,
  group_type text not null check (group_type in ('reports', 'staff', 'general', 'ai', 'off')),
  title text,
  set_by_vk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vk_group_bindings_type_idx
  on public.vk_group_bindings (group_type);

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vk_links_updated_at on public.vk_links;
create trigger set_vk_links_updated_at
before update on public.vk_links
for each row execute function public.set_updated_at_now();

drop trigger if exists set_vk_report_sessions_updated_at on public.vk_report_sessions;
create trigger set_vk_report_sessions_updated_at
before update on public.vk_report_sessions
for each row execute function public.set_updated_at_now();

drop trigger if exists set_vk_group_bindings_updated_at on public.vk_group_bindings;
create trigger set_vk_group_bindings_updated_at
before update on public.vk_group_bindings
for each row execute function public.set_updated_at_now();

alter table public.vk_links disable row level security;
alter table public.vk_report_sessions disable row level security;
alter table public.vk_group_bindings disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.vk_links to anon, authenticated, service_role;
grant select, insert, update, delete on public.vk_report_sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.vk_group_bindings to anon, authenticated, service_role;

notify pgrst, 'reload schema';
