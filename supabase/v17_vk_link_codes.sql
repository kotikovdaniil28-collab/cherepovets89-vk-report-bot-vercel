-- CHEREPOVETS Bot v17: safe VK linking codes.
-- Run in the same Supabase project as the site and bot.

create table if not exists public.vk_link_codes (
  code text primary key,
  site_user_id text not null,
  email text not null,
  nickname text,
  status text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  used_by_vk_user_id text,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vk_link_codes_site_user_id_idx
  on public.vk_link_codes (site_user_id, created_at desc);

create index if not exists vk_link_codes_status_expires_idx
  on public.vk_link_codes (status, expires_at);

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vk_link_codes_updated_at on public.vk_link_codes;
create trigger set_vk_link_codes_updated_at
before update on public.vk_link_codes
for each row execute function public.set_updated_at_now();

alter table public.vk_link_codes enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.vk_link_codes to authenticated, service_role;
grant select, insert, update, delete on public.vk_links to service_role;
grant select on public.vk_links to authenticated;

drop policy if exists "vk_link_codes_user_select_own" on public.vk_link_codes;
create policy "vk_link_codes_user_select_own"
on public.vk_link_codes
for select
to authenticated
using (site_user_id = auth.uid()::text);

drop policy if exists "vk_link_codes_user_insert_own" on public.vk_link_codes;
create policy "vk_link_codes_user_insert_own"
on public.vk_link_codes
for insert
to authenticated
with check (site_user_id = auth.uid()::text);

drop policy if exists "vk_link_codes_user_update_own_pending" on public.vk_link_codes;
create policy "vk_link_codes_user_update_own_pending"
on public.vk_link_codes
for update
to authenticated
using (site_user_id = auth.uid()::text and status = 'pending')
with check (site_user_id = auth.uid()::text);

notify pgrst, 'reload schema';
