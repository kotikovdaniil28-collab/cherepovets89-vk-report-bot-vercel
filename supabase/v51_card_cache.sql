-- v51: кеш VK-attachment для фирменных карточек Black Russia (public/cards/*)
-- Бот один раз загружает картинку в VK и переиспользует attachment.

create table if not exists public.vk_card_cache (
  card_key text primary key,
  attachment text not null,
  updated_at timestamptz not null default now()
);

alter table public.vk_card_cache enable row level security;
