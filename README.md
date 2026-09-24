# Summarize Telegram Mini App

Приложение превращает PDF, DOCX и PPTX лекции в краткие конспекты. Один деплой на Vercel содержит Vite-интерфейс, FastAPI и Telegram webhook. Локально используется SQLite, на Vercel — PostgreSQL.

## Локальный запуск

Требования: Node.js 20+ и Python 3.11+.

```powershell
Copy-Item .env.example .env
npm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

В `.env` обязательно укажите `AI_API_KEY`. Для бота также укажите действительный `TELEGRAM_BOT_TOKEN`. Оставьте `DEV_MODE=true` только для локальной разработки.

Терминал 1:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Терминал 2:

```powershell
npm run dev
```

Откройте `http://localhost:8080`. Локально бот использует long polling, а библиотека хранится в `data/summarize.db`.

## Деплой на Vercel

### 1. Импорт проекта

Загрузите репозиторий на GitHub/GitLab, в Vercel нажмите **Add New → Project → Import** и выберите репозиторий. Корневая папка проекта должна остаться `.`. Настройки из `vercel.json` уже задают:

- Framework: Vite;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- Python Function: `api/index.py`;
- максимальное время функции: 300 секунд.

### 2. Подключение PostgreSQL

До первого production-деплоя откройте у проекта **Storage → Browse Marketplace → Neon** (можно также Supabase/Postgres), создайте базу и подключите её к проекту. Backend автоматически распознаёт одну из переменных:

- `DATABASE_URL`;
- `POSTGRES_URL`;
- `NEON_DATABASE_URL`.

Без PostgreSQL production-функция намеренно не запускается: файловая система Vercel не подходит для постоянного SQLite-хранилища.

### 3. Environment Variables

В **Settings → Environment Variables** добавьте для Production:

```ini
AI_API_KEY=ваш_ключ_AI
AI_MODEL=gpt-4.1-mini
TELEGRAM_BOT_TOKEN=полный_токен_из_BotFather
DEV_MODE=false
MAX_FILE_MB=20
AI_CHUNK_CHARS=14000
TELEGRAM_WEBHOOK_SECRET=случайная_строка_1
WEBHOOK_SETUP_SECRET=случайная_строка_2
```

Две независимые случайные строки можно создать так:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Не добавляйте `VITE_API_URL` в Vercel: frontend обращается к `/api` на том же домене. `AI_API_KEY`, токен бота, строки подключения и webhook-секреты никогда не должны иметь префикс `VITE_`.

Новый Vercel-проект автоматически предоставляет `VERCEL_PROJECT_PRODUCTION_URL`. Backend использует его как адрес Mini App и webhook. Если вы используете собственный домен или системные переменные отключены, добавьте явно:

```ini
TELEGRAM_WEB_APP_URL=https://ваш-домен
TELEGRAM_WEBHOOK_URL=https://ваш-домен/api/telegram/webhook
```

После добавления переменных нажмите **Deploy** или **Redeploy**.

### 4. Проверка API

Откройте:

```text
https://ваш-домен/api/health
```

Ожидаемый ответ содержит `"status":"ok"`, `"aiConfigured":true`, `"botConfigured":true` и `"database":"postgresql"`.

### 5. Регистрация Telegram webhook

После успешного деплоя выполните один раз, подставив production-домен и точное значение `WEBHOOK_SETUP_SECRET`:

```powershell
$setupSecret = "ваше_значение_WEBHOOK_SETUP_SECRET"
Invoke-RestMethod `
  -Method Post `
  -Uri "https://ваш-домен/api/telegram/setup" `
  -Headers @{ "X-Webhook-Setup-Secret" = $setupSecret }
```

Ответ должен содержать `ok: true` и URL, заканчивающийся на `/api/telegram/webhook`. Повторите эту команду после смены токена, webhook-секрета или домена.

### 6. Настройка Mini App в BotFather

В Telegram откройте `@BotFather`:

1. `/mybots` → выберите бота.
2. **Bot Settings → Menu Button → Configure menu button**.
3. Отправьте production URL вида `https://ваш-домен`.
4. Укажите название кнопки, например `Open Summarize`.

Затем отправьте боту `/start`. Кнопка откроет Mini App, а PDF/DOCX/PPTX можно отправлять прямо в чат — обе точки входа используют одну PostgreSQL-библиотеку.

Production-домен должен быть публичным: Vercel Deployment Protection не должна блокировать запросы Telegram.

## Ограничения Vercel

- В браузере UI ограничивает файлы до 4 MB, потому что предел тела запроса Vercel Functions — 4.5 MB с учётом multipart-обвязки.
- Отправка файлов боту использует Telegram API и может работать до `MAX_FILE_MB` (по умолчанию 20 MB).
- Сканированные PDF без текстового слоя не поддерживаются: в MVP нет OCR.
- Preview-деплои не перенастраивают production webhook автоматически.

## Проверки

```powershell
npm run lint
npm run build
npx tsc --noEmit
$env:PYTHONPATH="backend"
python -m pytest backend\tests
```
