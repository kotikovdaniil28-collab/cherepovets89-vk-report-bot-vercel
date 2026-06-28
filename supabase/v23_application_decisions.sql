-- CHEREPOVETS VK Bot v23
-- Audit log for Google Sheets application decisions.
-- Safe to run multiple times.

create table if not exists public.vk_application_decisions (
  id text primary key,
  peer_id text,
  row_number integer not null,
  sheet_name text,
  actor_vk_user_id text not null,
  verdict text not null,
  reason text,
  previous_verdict text,
  spreadsheet_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vk_application_decisions_row_idx
  on public.vk_application_decisions (sheet_name, row_number, created_at desc);

create index if not exists vk_application_decisions_actor_idx
  on public.vk_application_decisions (actor_vk_user_id, created_at desc);

create index if not exists vk_application_decisions_created_at_idx
  on public.vk_application_decisions (created_at desc);

alter table public.vk_application_decisions disable row level security;

grant select, insert, update, delete on public.vk_application_decisions
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
