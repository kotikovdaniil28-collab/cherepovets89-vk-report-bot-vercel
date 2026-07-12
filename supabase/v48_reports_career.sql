-- CHEREPOVETS v48: report review audit + moderator career ladder.
-- Run in the same Supabase project as the site and VK bot.
-- Safe to run repeatedly.

create table if not exists public.moderator_careers (
  site_user_id text primary key,
  email text,
  nickname text,
  vk_user_id text,
  rank text not null default 'junior_moderator'
    check (rank in ('junior_moderator', 'moderator', 'senior_moderator', 'km', 'zgm', 'gm')),
  active boolean not null default true,
  appointed_at timestamptz not null default now(),
  rank_started_at timestamptz not null default now(),
  source text not null default 'site',
  source_sheet text,
  source_row integer,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists moderator_careers_vk_user_id_key
  on public.moderator_careers (vk_user_id)
  where vk_user_id is not null and vk_user_id <> '';

create index if not exists moderator_careers_rank_idx
  on public.moderator_careers (rank, active, rank_started_at);

create table if not exists public.moderator_report_reviews (
  report_id text primary key,
  site_user_id text,
  email text,
  vk_user_id text,
  requested_status text,
  final_status text,
  xp integer not null default 0,
  verdict text not null default 'pending'
    check (verdict in ('pending', 'approved', 'rejected')),
  reason_code text,
  reason_text text,
  actor_vk_user_id text,
  actor_site_user_id text,
  source text,
  staff_peer_id text,
  staff_conversation_message_id bigint,
  staff_message_text text,
  staff_attachments text,
  notification_status text,
  notification_error text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderator_report_reviews_user_idx
  on public.moderator_report_reviews (site_user_id, created_at desc);

create index if not exists moderator_report_reviews_verdict_idx
  on public.moderator_report_reviews (verdict, created_at desc);

create table if not exists public.moderator_promotion_alerts (
  id text primary key,
  site_user_id text not null,
  vk_user_id text,
  from_rank text not null,
  to_rank text not null,
  eligibility_type text not null check (eligibility_type in ('regular', 'early')),
  days_on_rank integer not null default 0,
  approved_reports integer not null default 0,
  high_reports integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'promoted', 'postponed', 'cancelled')),
  staff_peer_id text,
  staff_conversation_message_id bigint,
  decided_by_vk_user_id text,
  decided_at timestamptz,
  remind_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists moderator_promotion_alerts_one_pending_idx
  on public.moderator_promotion_alerts (site_user_id, from_rank, to_rank)
  where status = 'pending';

create index if not exists moderator_promotion_alerts_status_idx
  on public.moderator_promotion_alerts (status, remind_after, created_at);

drop trigger if exists set_moderator_careers_updated_at on public.moderator_careers;
create trigger set_moderator_careers_updated_at
before update on public.moderator_careers
for each row execute function public.set_updated_at_now();

drop trigger if exists set_moderator_report_reviews_updated_at on public.moderator_report_reviews;
create trigger set_moderator_report_reviews_updated_at
before update on public.moderator_report_reviews
for each row execute function public.set_updated_at_now();

drop trigger if exists set_moderator_promotion_alerts_updated_at on public.moderator_promotion_alerts;
create trigger set_moderator_promotion_alerts_updated_at
before update on public.moderator_promotion_alerts
for each row execute function public.set_updated_at_now();

alter table public.moderator_careers enable row level security;
alter table public.moderator_report_reviews enable row level security;
alter table public.moderator_promotion_alerts disable row level security;

drop policy if exists "moderator_careers_read_own" on public.moderator_careers;
create policy "moderator_careers_read_own"
on public.moderator_careers for select to authenticated
using (site_user_id = auth.uid()::text);

drop policy if exists "moderator_report_reviews_read_own" on public.moderator_report_reviews;
create policy "moderator_report_reviews_read_own"
on public.moderator_report_reviews for select to authenticated
using (site_user_id = auth.uid()::text);

grant usage on schema public to authenticated, service_role;
grant select on public.moderator_careers to authenticated;
grant select on public.moderator_report_reviews to authenticated;
grant select, insert, update, delete on public.moderator_careers to service_role;
grant select, insert, update, delete on public.moderator_report_reviews to service_role;
grant select, insert, update, delete on public.moderator_promotion_alerts to service_role;

notify pgrst, 'reload schema';
