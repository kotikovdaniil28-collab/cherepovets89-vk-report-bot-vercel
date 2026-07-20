-- CHEREPOVETS VK Bot v25
-- Adds "link" group type (beseda "Svyaz GA - GM").
-- Safe to run multiple times.

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
  check (group_type in ('reports', 'staff', 'candidates', 'general', 'ai', 'nomod', 'link', 'off'));

notify pgrst, 'reload schema';
