# Проблема есть

MVP Telegram Mini App, где пользователи отправляют реальные городские, бытовые и социальные проблемы, ИИ приводит текст в безопасный вид, админ вручную модерирует публикации, а другие люди подтверждают проблему кнопкой “Меня тоже касается”.

В MVP нет карты, комментариев, оплаты, личных кабинетов, сложных ролей и автопубликации.

## Структура

- `apps/web` — Next.js Mini App и API routes.
- `apps/bot` — отдельный Telegram-бот на Telegraf.
- `packages/shared` — общие категории, статусы и типы.
- `supabase/schema.sql` — SQL-схема Supabase.
- `.env.example` — список переменных окружения.

## Установка

```bash
npm install
```

## Supabase

1. Создайте проект в Supabase.
2. Откройте SQL Editor.
3. Выполните содержимое `supabase/schema.sql`.
4. Скопируйте `Project URL`, `anon key` и `service_role key`.
5. Заполните env-переменные:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

API приложения использует service role только на сервере. Telegram id публично не показывается.

## Env

Создайте `.env.local` в `apps/web` для frontend/API:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=change-me
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AI_API_URL=
AI_API_KEY=
```

Создайте `.env` в `apps/bot`:

```bash
BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_WEB_APP_URL=http://localhost:3000
```

Если `OPENAI_API_KEY` и `AI_API_URL` не заданы, создание проблемы всё равно работает через mock/fallback-модерацию.

## Telegram-бот

1. Откройте BotFather.
2. Создайте бота командой `/newbot`.
3. Скопируйте токен в `apps/bot/.env`.
4. Для локальной разработки Mini App должен быть доступен по HTTPS. Используйте ngrok, Cloudflare Tunnel или другой туннель и укажите публичный URL в `TELEGRAM_WEB_APP_URL` и `NEXT_PUBLIC_APP_URL`.
5. Запустите бота:

```bash
npm run dev:bot
```

Команда `/start` отправит приветствие и кнопку “Открыть приложение”.

## Запуск web

```bash
npm run dev:web
```

Откройте `http://localhost:3000`.

Основные страницы:

- `/` — лента опубликованных проблем и фильтры.
- `/new` — создание проблемы.
- `/problems/[id]` — публичная страница проблемы.
- `/admin` — ручная модерация по `ADMIN_PASSWORD`.

## Как работает MVP

1. Пользователь отправляет проблему через `/new`.
2. API вызывает AI-сервис или fallback-модерацию.
3. Проблема всегда сохраняется со статусом `pending`.
4. В публичной ленте видны только `published`, `collecting_support`, `sent_to_official_channel`, `resolved`.
5. Админ открывает `/admin`, вводит пароль, редактирует текст и меняет статус.
6. Пользователи подтверждают опубликованную проблему.
7. Повторное подтверждение ограничено Telegram user id или anonymous key из `localStorage`.
8. Кнопка “Поделиться” формирует Telegram share-сообщение.

## Что пока не реализовано

- Проверка подписи Telegram WebApp `initData`.
- Загрузка файлов, есть только поле URL фото.
- RLS-политики Supabase.
- Webhook-режим бота для production.
- Полноценная авторизация админа.
- Уведомления админа о новых pending-проблемах.

## Production-заметки

- Используйте HTTPS URL для Mini App.
- Не храните `.env` в git.
- Задайте сильный `ADMIN_PASSWORD`.
- Перед публичным запуском добавьте проверку Telegram `initData` на сервере.
- Проверьте тексты AI-модерации вручную: автопубликации в MVP нет.
