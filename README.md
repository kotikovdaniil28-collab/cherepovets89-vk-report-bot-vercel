# CH89 VK Report Bot v3 — Vercel + Supabase + DeepSeek

Версия под VK Callback API и Vercel Functions.

## Что добавлено в v3

- Владелец определяется через `OWNER_VK_ID`.
- В этой сборке владельцем уже указан VK ID `628466808`.
- Привязка групп прямо из VK:
  - `/group type reports` — текущая беседа принимает отчёты.
  - `/group type staff` — текущая беседа получает заявки из таблиц.
  - `/group type ai` — текущая беседа разрешена для AI-общения.
- DeepSeek AI-команды для модерации.
- Больше модерских команд: отчёты на проверке, принятие/отклонение, статистика, XP, заявки.
- Уведомления о новых заявках идут в staff-группу, а не куда попало.
- После сдачи отчёта бот пытается удалить сообщения формы и оставить только итог.

## Файлы

```text
api/vk.js                          # VK Callback API webhook
api/table-webhook.js               # Supabase Database Webhook receiver
supabase/vk_bot_v3_ai_staff.sql    # SQL для vk_links, vk_report_sessions, vk_group_bindings
.env.example                       # пример переменных окружения
vercel.json
package.json
```

## 1. Supabase

Выполни в той же базе, где работает сайт:

```sql
-- supabase/vk_bot_v3_ai_staff.sql
```

Для твоей новой базы:

```text
https://hcefoztytkfskmdchqos.supabase.co
```

Боту нужен `service_role` key от этого же проекта. Его нельзя вставлять в сайт и нельзя коммитить в GitHub.

## 2. Vercel Environment Variables

Vercel → Project → Settings → Environment Variables:

```env
VK_GROUP_TOKEN=...
VK_CALLBACK_CONFIRMATION=...
VK_CALLBACK_SECRET=...
VK_API_VERSION=5.199

SUPABASE_URL=https://hcefoztytkfskmdchqos.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

OWNER_VK_ID=628466808

DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

TABLE_WEBHOOK_SECRET=любой_секрет
CLEANUP_MESSAGES_AFTER_REPORT=true
```

`REPORTS_PEER_ID`, `STAFF_PEER_ID`, `NOTIFY_PEER_ID` можно оставить пустыми, если используешь команды `/group type ...`.

После изменения переменных всегда делай Redeploy.

## 3. Настройка групп

Добавь бота в нужные беседы.

В беседе, где модеры будут сдавать отчёты:

```text
/group type reports
```

В staff-беседе, куда должны приходить новые заявки:

```text
/group type staff
```

Проверить текущую беседу:

```text
/group info
```

Список всех привязок:

```text
/groups
```

Очистить тип текущей беседы:

```text
/group clear
```

Эти команды доступны только `OWNER_VK_ID`.

## 4. VK Callback API

В VK → Управление сообществом → Работа с API → Callback API:

```text
Адрес сервера: https://твой-проект.vercel.app/api/vk
Секретный ключ: значение VK_CALLBACK_SECRET
Строка подтверждения: значение VK_CALLBACK_CONFIRMATION
```

Во вкладке «Типы событий» включи:

```text
Сообщения → Входящее сообщение / message_new
```

## 5. Supabase Database Webhook для заявок

Supabase → Database → Webhooks → Create webhook.

Для таблицы `reports`:

```text
Table: reports
Events: Insert
Method: POST
URL: https://твой-проект.vercel.app/api/table-webhook?secret=TABLE_WEBHOOK_SECRET
```

Для `admin_logs`, если нужны уведомления о заявках магазина:

```text
Table: admin_logs
Events: Insert
Method: POST
URL: https://твой-проект.vercel.app/api/table-webhook?secret=TABLE_WEBHOOK_SECRET
```

Бот отправит уведомление в группу, которую владелец отметил командой:

```text
/group type staff
```

## 6. Команды

### Базовые

```text
/id
/помощь
/пинг
```

### Отчёты

Пошагово:

```text
/отчет
```

Быстро одной командой:

```text
/отчет Проверил жалобы, закрыл 12 тем | 2026-06-25 | Норма | https://example.com
```

Без даты, бот поставит текущую дату по Москве:

```text
/отчет Проверил жалобы | Норма | https://example.com
```

Отмена формы:

```text
/отмена
```

### Модерские

```text
/модеры
/юзер <vk_id>
/стата <vk_id>
/отчёты [число]
/репорт <id>
/принять <id> [xp]
/отклонить <id> [причина]
/заявки [число]
```

### Владелец

```text
/group type staff
/group type reports
/group type ai
/group info
/groups
/group clear
/модер выдать <vk_id>
/модер снять <vk_id>
/xp <vk_id> +100 причина
/привязать <vk_id> <site_user_id> <email> <ник>
```

### DeepSeek AI

```text
/ai <вопрос>
/совет <ситуация>
/разбор <кейс>
/наказание <нарушение>
/шаблон <что ответить>
бот, <вопрос>
```

AI-команды доступны владельцу, модераторам и беседам типов `staff`, `reports`, `ai`.

## 7. Права на удаление сообщений

Чтобы бот реально удалял сообщения формы, ему нужны права администратора/модератора в VK-беседе. Если прав нет, отчёт сохранится, но сообщения могут остаться.
