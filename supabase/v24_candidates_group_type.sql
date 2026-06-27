-- CHEREPOVETS VK Bot v24
-- Adds candidates group type for accepted applications.
-- Safe to run multiple times.

create table if not exists public.vk_group_bindings (
  peer_id text primary key,
  group_type text not null,
  title text,
  set_by_vk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.vk_group_bindings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%group_type%'
  loop
    execute format('alter table public.vk_group_bindings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.vk_group_bindings
  add constraint vk_group_bindings_group_type_check
  check (group_type in ('reports', 'staff', 'candidates', 'general', 'ai', 'nomod', 'off'));

notify pgrst, 'reload schema';
