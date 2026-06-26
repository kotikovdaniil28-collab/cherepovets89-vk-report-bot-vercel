# CH89 VK Bot v9: нормальный `/help`, алиасы и фиксы `/отчет`/`/мут`

Owner этой сборки зафиксирован: `628466808`.

## Что исправлено в v9

- `/help` теперь разделён на страницы: `/help`, `/help отчеты`, `/help км`, `/help наказания`, `/help згм`, `/help гм`, `/help заявки`, `/help ai`.
- `/отчет` в неправильной беседе теперь явно пишет, что нужно сделать `/group type reports`.
- `/мут` сначала пытается применить VK-ограничение, а потом пишет действие в Supabase. Если таблица SQL не создана, команда всё равно покажет результат VK и понятную ошибку БД.
- Добавлены русские алиасы: `/ид`, `/мьют`, `/замутить`, `/забанить`, `/кик`, `/варн`, `/анкеты`, `/гшит`, `/поиск`, `/инфо` и другие.
- Apps Script уже содержит ссылку на твой Vercel-домен и секреты `ch89forms2026` / `ch89pull2026`.

## Что исправлено в v7

Старый режим зависел от Google Form trigger `onFormSubmit`. Если триггер не срабатывал, заявка не приходила. В v7 добавлен стабильный режим: команда `/заявки` сама запрашивает Google Sheet через Apps Script Web App и выводит строки, где в последних двух столбцах нет вердикта.

Логика заявки:

```text
строка считается нерассмотренной, если последние 2 столбца строки пустые
```

Если в одном из двух последних столбцов что-то есть — бот считает, что по заявке уже есть вердикт/комментарий, и не показывает её в `/заявки`.

## 1. SQL

В Supabase выполни:

```sql
supabase/latest.sql
```

Если ты уже выполнял SQL v5/v6, повторное выполнение безопасно.

## 2. Vercel Environment Variables

Минимум:

```env
VK_GROUP_TOKEN=...
VK_CALLBACK_CONFIRMATION=...
VK_CALLBACK_SECRET=...
SUPABASE_URL=https://hcefoztytkfskmdchqos.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OWNER_VK_ID=628466808
```

Для Google Sheets pull-режима:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/ТВОЙ_DEPLOYMENT_ID/exec
GOOGLE_SHEET_PULL_SECRET=любой_секрет
GOOGLE_SHEET_TARGET_NAME=Ответы на форму (3)
```

Если используешь старый авто-webhook, можно также оставить:

```env
GOOGLE_SHEET_WEBHOOK_SECRET=тот_же_секрет
```

После изменения переменных всегда делай **Redeploy**.

## 3. Google Apps Script

Открой Google Sheet с ответами формы:

```text
Расширения → Apps Script
```

Вставь код из:

```text
google-apps-script/send-form-response-to-vk.gs
```

Вверху файла замени:

```js
const CH89_PULL_SECRET = 'YOUR_SECRET';
```

на тот же секрет, что в Vercel:

```env
GOOGLE_SHEET_PULL_SECRET=...
```

Потом сделай:

```text
Deploy → New deployment → Web app
Execute as: Me
Who has access: Anyone with the link
Deploy
```

Скопируй Web App URL и вставь в Vercel:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

Проверка в браузере:

```text
https://script.google.com/macros/s/.../exec?mode=pending&limit=5&secret=ТВОЙ_СЕКРЕТ
```

Должен вернуться JSON с `ok: true` и `items`.

## 4. Команда `/заявки`

В staff-беседе сначала привяжи группу:

```text
/group type staff
```

Потом:

```text
/заявки
/заявки 10
```

Бот заберёт из Google Sheet последние строки без вердикта и отправит их в чат.

## 5. Роли и права

Роли:

```text
ГМ
ЗГМ
Куратор
КМ
Модератор
```

Команды:

```text
/роли
/роль @id123 Модератор
/роль @id123 КМ
/роль @id123 Куратор
/роль @id123 ЗГМ
/роль снять @id123
```

КМ и выше могут выдавать модератора сайта:

```text
/модер выдать email user@gmail.com
/модер снять email user@gmail.com
/модер выдать @id123
/модер снять @id123
```

## 6. Пользователи через «собаку»

```text
/юзер @id628466808
/юзер @screen_name
/юзер https://vk.com/id628466808
/стата @id628466808
/xp @id628466808 +100 причина
```

## 7. Модерские действия

```text
/мут @id123 90м флуд
/размут @id123
/бан @id123 7д реклама
/пред @id123 причина
/устник @id123 причина
/строгий @id123 причина
/приват @id123 3д причина
/глобал @id123 7д причина
/обнулить @id123 причина
/наказания @id123
/снятьнаказание act_...
```

Для попытки реального мута в VK:

```env
VK_USE_CHAT_RESTRICTIONS=true
```

Для попытки кика при `/бан`:

```env
VK_AUTO_KICK_ON_BAN=true
```

Если VK API не даст право на мут/кик, бот покажет ошибку VK, но действие всё равно сохранится в Supabase.

## 8. DeepSeek

Ответы короткие, без полотен. Команды:

```text
/совет ситуация
/разбор кейс
/наказание нарушение
/шаблон текст ответа
бот, вопрос
```

## v8: Google Sheets заявки по колонке «Вердикт»

В v8 команда `/заявки` работает через Google Apps Script Web App и считает заявку открытой, если колонка `Вердикт` пустая или равна `На рассмотрении` / `Ожидает` / `pending`.

Важно: `GOOGLE_APPS_SCRIPT_URL` должен быть именно URL Google Apps Script вида:

```text
https://script.google.com/macros/s/.../exec
```

Нельзя ставить туда Vercel URL `/api/google-sheet-webhook`, иначе бот будет видеть staff-группу, но не сможет читать таблицу.

Проверка в VK:

```text
/gsheet
/заявки 10
```

Если `/gsheet` показывает `Вердикт: не найден`, проверь точное название колонки в первой строке листа.
