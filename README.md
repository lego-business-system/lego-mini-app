# АРХИТЕКТУРА — Telegram Mini App

Основное обучающее приложение экосистемы.

Опубликованный только в рабочей ветке, ещё не развёрнутый foundation интеграции с «АРХИТЕКТУРА: ФИНАНСЫ» описан в:

- [`supabase/functions/README.md`](supabase/functions/README.md) — HTTP/Telegram/HMAC контракт;
- [`supabase/INTEGRATION_RUNBOOK.md`](supabase/INTEGRATION_RUNBOOK.md) — staging, E2E и rollback;
- [`supabase/migrations/20260714235900_finance_integration_foundation.sql`](supabase/migrations/20260714235900_finance_integration_foundation.sql) — draft DB foundation.
- [`supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql`](supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql) — staging-only desired-state/outbox v1 для надёжной синхронизации grant/revoke;
- [`supabase/migrations/20260715020000_finance_subject_resolver_v1.sql`](supabase/migrations/20260715020000_finance_subject_resolver_v1.sql) — service-only чтение подтверждённого Main Telegram ID как точной строки;
- [`supabase/functions/finance-sync-entitlements/index.ts`](supabase/functions/finance-sync-entitlements/index.ts) — выключенный по умолчанию приватный worker доставки событий в Finance.
- [`architecture-finance.js`](architecture-finance.js) — отдельный экран выдачи одноразового кода;
- [`architecture-finance-config.js`](architecture-finance-config.js) — публичная конфигурация и feature gate без секретов.
- [`supabase/contracts/telegram-finance-issuer-v1.json`](supabase/contracts/telegram-finance-issuer-v1.json) — общий с Finance побайтово закреплённый golden contract v1 без реальных секретов.

Интерфейс рабочей ветки подключён к контракту, но работает fail-closed: `enabled: false`, а адрес финансового сайта пуст. До прохождения staging-runbook кнопка не вызывает endpoint. Существующий учебный «Финансовый помощник» не заменён — «АРХИТЕКТУРА: ФИНАНСЫ» добавлена отдельной карточкой.

Outbox v1 атомарно фиксирует желаемое состояние по доверенному `public.users.id`, версию, событие, автора и причину; одновременно закрывает действующий Main gate. Service-only claim/finish обеспечивают lease, идемпотентность, упорядочивание версий, backoff и `dead_letter`. Приватный worker получает Telegram ID только через отдельный resolver во время обработки, сверяет keyed subject digest, подписывает точные байты HMAC и открывает Main gate только после подтверждённого Finance grant. При revoke или любом незавершённом/ошибочном состоянии gate остаётся закрытым. В outbox raw Telegram ID не хранится.

Рабочая ветка опубликована в [черновом PR #1](https://github.com/lego-business-system/lego-mini-app/pull/1). Ни миграция, ни Edge Function не применялись к live Supabase; merge в `main` и deploy не выполнялись.

Кодовый кандидат `c39cf796` прошёл [GitHub Actions run #26](https://github.com/lego-business-system/lego-mini-app/actions/runs/29385810300): 34/34 прикладных теста, общий с Finance golden contract v1, 7/7 защитных тестов harness, frozen Deno check/audit и полное исполнение одноразовой миграции со smoke/rollback/retry на чистом PostgreSQL 17. Это подтверждает исполнимость кода в одноразовом CI-контуре, но не подтверждает Supabase Edge Runtime, Auth/PostgREST и полный Telegram E2E. Следующий обязательный рубеж — два изолированных Supabase staging.

Локальный entitlement delivery candidate проходит 47/47 тестов, frozen Deno check/audit и побайтово совпадает с Finance golden fixture (`9121493943b47fc862a81c5a538cb3e336b34507431e0a5bd3a7814fea1139bd`). Исполнение outbox/resolver миграций и поведения в disposable PostgreSQL 17 должен подтвердить следующий GitHub Actions run; до этого пакет нельзя считать проверенным SQL-runtime.
