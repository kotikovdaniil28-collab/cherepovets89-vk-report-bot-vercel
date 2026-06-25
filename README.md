# CH89 VK Bot v5: роли, модерские команды, DeepSeek, Google Forms

Owner этой сборки зафиксирован: `628466808`. Даже если `OWNER_VK_ID` не выставлен в Vercel, бот признаёт владельцем этот VK ID.

## 1. SQL

В новой Supabase выполни:

```sql
supabase/vk_bot_v5_roles_google.sql
```

Этот файл создаёт:

- `vk_links` — привязка VK к аккаунту сайта;
- `vk_report_sessions` — шаги формы отчёта;
- `vk_group_bindings` — типы бесед `/group type staff/reports`;
- `vk_staff_roles` — роли ГМ, ЗГМ, Куратор, КМ, Модератор;
- `vk_moderation_actions` — муты, баны, предупреждения и другие действия;
- `vk_google_sheet_events` — лог заявок из Google Sheets.

## 2. Vercel Environment Variables

Минимум:

```env
VK_GROUP_TOKEN=...
VK_CALLBACK_CONFIRMATION=...
VK_CALLBACK_SECRET=...
SUPABASE_URL=https://hcefoztytkfskmdchqos.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OWNER_VK_ID=628466808
DEEPSEEK_API_KEY=...
TABLE_WEBHOOK_SECRET=...
GOOGLE_SHEET_WEBHOOK_SECRET=...
GOOGLE_SHEET_TARGET_NAME=Ответы на формы (3)
```

После изменения переменных всегда делай Redeploy.

## 3. Привязка бесед

В staff-беседе:

```text
/group type staff
```

В беседе отчётов:

```text
/group type reports
```

Посмотреть:

```text
/group info
/groups
```

## 4. Роли staff

Роли:

- `ГМ` — владелец, полный доступ;
- `ЗГМ` — высокий staff-доступ;
- `Куратор` — staff-доступ;
- `КМ` — может выдавать права модератора сайта и роль `Модератор`;
- `Модератор` — может использовать модерские действия.

Команды:

```text
/роли
/роль @id123 Модератор
/роль @id123 КМ
/роль @id123 Куратор
/роль @id123 ЗГМ
/роль снять @id123
```

## 5. Пользователи через «собаку»

Теперь команды понимают:

```text
/юзер @id628466808
/юзер @screen_name
/юзер https://vk.com/id628466808
/стата @id628466808
/xp @id628466808 +100 причина
/модер выдать @id628466808
/модер снять @id628466808
```

Если `@screen_name` не переводится в ID, проверь, что ссылка реально ведёт на VK-пользователя, а не на группу.

## 6. Модерские команды

```text
/мут @id123 90м флуд
/бан @id123 7д реклама
/пред @id123 провокация
/устник @id123 капс
/строгий @id123 повторное нарушение
/приват @id123 3д нарушение названия комнаты
/глобал @id123 7д реклама другого проекта
/обнулить @id123 трансфер валюты
/наказания @id123
/снятьнаказание act_...
```

По умолчанию это логируется в Supabase. Если включить `VK_AUTO_KICK_ON_BAN=true`, команда `/бан` попробует кикнуть пользователя из VK-беседы, если у сообщества есть права.

## 7. Отчёты и права сайта

```text
/отчёты
/отчёты все 10
/отчёты email mail@example.com
/репорт <id>
/принять <id> 100
/отклонить <id> причина
/модер выдать email mail@example.com
/модер снять email mail@example.com
/привязать email <vk_id> <email> [ник]
```

`/модер выдать email ...` создаёт служебную запись в `reports`:

```text
email = USER_ROLE
link = site_user_id
status = moderator
```

## 8. Google Forms / Google Sheets → staff

Тебе нужен лист `Ответы на формы (3)`. Когда туда попадает новая строка, Apps Script отправляет её в Vercel, а бот пересылает всю информацию одним сообщением в staff-беседу.

Endpoint:

```text
https://ТВОЙ-ПРОЕКТ.vercel.app/api/google-sheet-webhook?secret=ТВОЙ_GOOGLE_SHEET_WEBHOOK_SECRET
```

Файл скрипта:

```text
google-apps-script/send-form-response-to-vk.gs
```

Настройка:

1. Открой Google Sheet с ответами формы.
2. `Расширения → Apps Script`.
3. Вставь код из `send-form-response-to-vk.gs`.
4. Замени `CH89_WEBHOOK_URL` на свой Vercel endpoint.
5. Слева `Триггеры → Add Trigger`.
6. Функция: `onFormSubmit`.
7. Источник: `From spreadsheet`.
8. Event type: `On form submit`.

Проверка вручную:

```text
Run → testSendLastRow
```

## 9. DeepSeek

Ответы сокращены: 3–4 строки, без больших полотен. Бот использует правила BLACK RUSSIA Discord, которые были зашиты в системный контекст.

Команды:

```text
/совет ситуация
/разбор кейс
/наказание нарушение
/шаблон текст ответа
бот, вопрос
```
