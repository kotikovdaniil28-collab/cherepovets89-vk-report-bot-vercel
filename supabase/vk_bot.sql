-- Run once in Supabase SQL Editor.
-- This file includes VK account links and serverless form sessions for the Vercel bot.

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

alter table public.vk_links enable row level security;

drop policy if exists "vk_links_select_own" on public.vk_links;
create policy "vk_links_select_own"
  on public.vk_links
  for select
  using (auth.uid()::text = site_user_id);

drop policy if exists "vk_links_insert_own" on public.vk_links;
create policy "vk_links_insert_own"
  on public.vk_links
  for insert
  with check (auth.uid()::text = site_user_id);

drop policy if exists "vk_links_update_own" on public.vk_links;
create policy "vk_links_update_own"
  on public.vk_links
  for update
  using (auth.uid()::text = site_user_id)
  with check (auth.uid()::text = site_user_id);

drop policy if exists "vk_links_delete_own" on public.vk_links;
create policy "vk_links_delete_own"
  on public.vk_links
  for delete
  using (auth.uid()::text = site_user_id);

create or replace function public.set_vk_links_updated_at()
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
for each row execute function public.set_vk_links_updated_at();

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

alter table public.vk_report_sessions enable row level security;

-- No public RLS policies are added for vk_report_sessions.
-- The Vercel bot uses the Supabase service role key, which bypasses RLS.

create or replace function public.set_vk_report_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vk_report_sessions_updated_at on public.vk_report_sessions;
create trigger set_vk_report_sessions_updated_at
before update on public.vk_report_sessions
for each row execute function public.set_vk_report_sessions_updated_at();
