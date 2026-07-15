# АРХИТЕКТУРА — Telegram Mini App

Основное обучающее приложение экосистемы.

Опубликованный только в рабочей ветке, ещё не развёрнутый foundation интеграции с «АРХИТЕКТУРА: ФИНАНСЫ» описан в:

- [`supabase/functions/README.md`](supabase/functions/README.md) — HTTP/Telegram/HMAC контракт;
- [`supabase/INTEGRATION_RUNBOOK.md`](supabase/INTEGRATION_RUNBOOK.md) — staging, E2E и rollback;
- [`supabase/migrations/20260714235900_finance_integration_foundation.sql`](supabase/migrations/20260714235900_finance_integration_foundation.sql) — draft DB foundation.
- [`architecture-finance.js`](architecture-finance.js) — отдельный экран выдачи одноразового кода;
- [`architecture-finance-config.js`](architecture-finance-config.js) — публичная конфигурация и feature gate без секретов.
- [`supabase/contracts/telegram-finance-issuer-v1.json`](supabase/contracts/telegram-finance-issuer-v1.json) — общий с Finance побайтово закреплённый golden contract v1 без реальных секретов.

Интерфейс рабочей ветки подключён к контракту, но работает fail-closed: `enabled: false`, а адрес финансового сайта пуст. До прохождения staging-runbook кнопка не вызывает endpoint. Существующий учебный «Финансовый помощник» не заменён — «АРХИТЕКТУРА: ФИНАНСЫ» добавлена отдельной карточкой.

Рабочая ветка опубликована в [черновом PR #1](https://github.com/lego-business-system/lego-mini-app/pull/1). Ни миграция, ни Edge Function не применялись к live Supabase; merge в `main` и deploy не выполнялись.

Кодовый кандидат `c39cf796` прошёл [GitHub Actions run #26](https://github.com/lego-business-system/lego-mini-app/actions/runs/29385810300): 34/34 прикладных теста, общий с Finance golden contract v1, 7/7 защитных тестов harness, frozen Deno check/audit и полное исполнение одноразовой миграции со smoke/rollback/retry на чистом PostgreSQL 17. Это подтверждает исполнимость кода в одноразовом CI-контуре, но не подтверждает Supabase Edge Runtime, Auth/PostgREST и полный Telegram E2E. Следующий обязательный рубеж — два изолированных Supabase staging.
