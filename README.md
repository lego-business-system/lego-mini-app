# АРХИТЕКТУРА — Telegram Mini App

Основное обучающее приложение экосистемы. Эта ветка содержит отдельный, ещё не
развёрнутый staging-кандидат связи с «АРХИТЕКТУРА: ФИНАНСЫ».

## Что входит в пилот

- [`finance-pilot/`](finance-pilot/) — минимальная оболочка входа из Telegram;
- [`scripts/build-finance-pilot.mjs`](scripts/build-finance-pilot.mjs) —
  staging-only сборщик отдельного статического artifact;
- [`scripts/verify-finance-pilot-artifact.mjs`](scripts/verify-finance-pilot-artifact.mjs) —
  строгая проверка состава, CSP, staging origins и отсутствия production URL;
- [`scripts/manage-finance-access.mjs`](scripts/manage-finance-access.mjs) —
  операторский `grant`, `revoke` и read-only `status` с dry-run по умолчанию;
- [`scripts/prepare-main-finance-staging.mjs`](scripts/prepare-main-finance-staging.mjs) —
  plan/read-only подготовка data-less Main staging: production-ref запрещён,
  `remote_schema` загружается только в одноразовую внешнюю директорию, а
  миграционный dry-run обязан предложить ровно три v1-файла по порядку;
- три последовательные Main-миграции v1: foundation, desired-state/outbox и
  service-only Telegram subject resolver;
- `finance-sync-entitlements` — приватная адресная доставка grant/revoke в
  Finance;
- `finance-issue-code` — выдача одноразового кода после серверной проверки
  Telegram и действующего Main entitlement.

Полный Main-сайт не является pilot artifact. Сборка физически содержит ровно
семь файлов: Telegram shell, публичную staging-конфигурацию, Finance JS/CSS и
Cloudflare Pages `_headers`. Последний возвращает тот же CSP как HTTP-заголовок,
фиксирует единственный Main staging origin в `connect-src`, запрещает все
`frame-ancestors` и добавляет `nosniff`, `no-referrer`, Permissions Policy,
COOP и CORP. Сборка не копирует `app.js`, форум или модуль бизнес-архитектуры.
Корень production-сайта остаётся неизменным.

## Граница безопасности

- artifact строится только из внешнего reviewed staging config;
- отдельный внешний production boundary запрещает подменить staging origin на
  production;
- meta CSP и HTTP CSP побайтово совпадают и разрешают сеть только к одному
  точному Main staging Supabase origin;
- без точного public origin, Telegram `initData` и feature gate оболочка
  закрывается;
- клиентская проверка не является полномочием: Edge повторно проверяет Telegram
  и entitlement;
- raw Telegram ID не хранится в outbox и не возвращается оператору;
- revoke закрывает Main gate сразу, а Finance получает отдельное
  версионированное событие;
- прямой service-role обход outbox через legacy entitlement upsert отозван.

## Стабильный subject пилота

v1 использует `HMAC-SHA256(MAIN_FINANCE_PRIVACY_HMAC_KEY,
"main-telegram-subject-v1\n<Telegram ID>")`. Для первого пилота запрещены смена
privacy key, перепривязка Telegram ID и ротация subject. Управляемая ротация —
отдельный последующий этап; v2-код и v2-миграции в этот кандидат не входят.

## Локальная проверка

```bash
./supabase/tests/verify_local.sh
node --test supabase/tests/postgres-ci/static_guard.test.mjs
```

CI дополнительно выполняет frozen Deno check/audit обеих v1 Edge Functions и
три миграции на одноразовом чистом PostgreSQL 17. Это доказывает локальную и
CI-совместимость кандидата, но не доказывает hosted Supabase, Telegram или
межпроектный E2E.

Staging-оператор намеренно не имеет режима применения: `--apply` всегда
отклоняется. Его результат — локальный план либо read-only attestation для
последующего отдельного решения владельца; hosted write он не выполняет.

Порядок сборки, staging deploy, grant/revoke drill и rollback описан в
[`supabase/INTEGRATION_RUNBOOK.md`](supabase/INTEGRATION_RUNBOOK.md). Никакая
миграция, функция или статический artifact из этой ветки не должны попадать в
production без отдельного подтверждения владельца непосредственно перед
действием.
