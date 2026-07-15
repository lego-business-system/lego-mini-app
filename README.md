# АРХИТЕКТУРА — Telegram Mini App

Основное обучающее приложение экосистемы.

Локальный, ещё не развёрнутый foundation интеграции с «АРХИТЕКТУРА: ФИНАНСЫ» описан в:

- [`supabase/functions/README.md`](supabase/functions/README.md) — HTTP/Telegram/HMAC контракт;
- [`supabase/INTEGRATION_RUNBOOK.md`](supabase/INTEGRATION_RUNBOOK.md) — staging, E2E и rollback;
- [`supabase/migrations/20260714235900_finance_integration_foundation.sql`](supabase/migrations/20260714235900_finance_integration_foundation.sql) — draft DB foundation.
- [`architecture-finance.js`](architecture-finance.js) — отдельный экран выдачи одноразового кода;
- [`architecture-finance-config.js`](architecture-finance-config.js) — публичная конфигурация и feature gate без секретов.

Локальный интерфейс подключён к контракту, но работает fail-closed: `enabled: false`, а адрес финансового сайта пуст. До прохождения staging-runbook кнопка не вызывает endpoint. Существующий учебный «Финансовый помощник» не заменён — «АРХИТЕКТУРА: ФИНАНСЫ» добавлена отдельной карточкой.

Ни миграция, ни Edge Function не применялись к live Supabase. Commit, push и deploy не выполнялись.
