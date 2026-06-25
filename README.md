# CH89 VK Report Bot for Vercel

Это версия VK-бота под Vercel Functions. Она работает через VK Callback API, а не через Long Poll.

Схема:

```text
VK Callback API -> https://your-project.vercel.app/api/vk -> Supabase reports
```

## Что изменилось относительно Long Poll версии

- Нет `vk.updates.start()` и постоянно работающего процесса.
- VK сам отправляет события на `/api/vk`.
- Шаги формы хранятся в Supabase `vk_report_sessions`, потому что Vercel Functions статeless и память между сообщениями не гарантирована.
- Отправка ответа в VK идет через метод `messages.send`.

## Файлы

```text
api/vk.js              # webhook для VK Callback API
supabase/vk_bot.sql    # таблицы vk_links и vk_report_sessions
.env.example           # пример переменных окружения
vercel.json            # настройки Vercel Function
package.json
```

## 1. Supabase

В Supabase SQL Editor выполни:

```sql
-- файл supabase/vk_bot.sql
```

Если у тебя уже есть `vk_links`, файл ничего не сломает: используется `create table if not exists`.

Опционально создай публичный Storage bucket:

```text
report-proofs
```

Если bucket не создан, бот всё равно сохранит прямую ссылку на вложение VK как fallback.

## 2. Vercel Environment Variables

В Vercel открой:

```text
Project -> Settings -> Environment Variables
```

Добавь переменные:

```env
VK_GROUP_TOKEN=...
VK_CALLBACK_CONFIRMATION=...
VK_CALLBACK_SECRET=...
VK_API_VERSION=5.199
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REPORT_PROOFS_BUCKET=report-proofs
BOT_ADMIN_VK_IDS=
```

`VK_CALLBACK_SECRET` придумай сам, например длинную случайную строку. Эту же строку нужно указать в настройках Callback API в VK.

`SUPABASE_SERVICE_ROLE_KEY` нельзя вставлять в сайт или хранить в публичном репозитории. Только в Vercel Environment Variables.

## 3. Деплой на Vercel

Вариант через CLI:

```bash
npm install
npx vercel
npx vercel --prod
```

После деплоя endpoint будет выглядеть так:

```text
https://your-project.vercel.app/api/vk
```

## 4. Настройка VK Callback API

В управлении сообществом VK открой:

```text
Управление -> Работа с API -> Callback API
```

Добавь сервер:

```text
https://your-project.vercel.app/api/vk
```

Вставь Secret key такой же, как `VK_CALLBACK_SECRET` в Vercel.

Скопируй строку подтверждения из VK и добавь ее в Vercel как:

```env
VK_CALLBACK_CONFIRMATION=строка_которую_просит_вернуть_vk
```

После этого нажми подтверждение сервера в VK. Функция вернет строку подтверждения.

Во вкладке типов событий включи:

```text
message_new
```

Также проверь, что в сообществе включены сообщения и у токена сообщества есть доступ к сообщениям.

## 5. Команды

```text
/отчет    начать сдачу отчета
/id       показать VK ID для привязки на сайте
/отмена   отменить текущую форму
/помощь   показать справку
```

Опционально для админов бота:

```text
/привязать <vk_user_id> <site_user_id> <email> <nickname>
```

Для этой команды нужно добавить свой VK ID в `BOT_ADMIN_VK_IDS`.

## 6. Проверка

Открой в браузере:

```text
https://your-project.vercel.app/api/vk
```

Должен вернуться JSON:

```json
{"ok":true,"service":"ch89-vk-report-bot-vercel"}
```

Затем в VK напиши в чат с ботом:

```text
/id
```

Если бот отвечает, webhook работает.

## 7. Безопасность

Если токены уже были отправлены в чат или кому-то показаны, перевыпусти:

- VK community token.
- Supabase service role key.
- VK Callback secret.

Не коммить `.env` и не вставляй service role key в сайт.
