# Disposable PostgreSQL 17 verification

Этот контур последовательно исполняет main-миграцию Finance foundation,
staging-only entitlement-outbox v1 и service-only subject resolver в одноразовой базе
PostgreSQL 17 внутри GitHub Actions. Он не подключается к Supabase, не читает
repository secrets и не может работать с удалённой базой.

Проверяется:

- первое применение миграции вместе с её встроенным строгим postflight;
- независимый каталог: 3 таблицы, 24 колонки, 19 constraints, 10 индексов,
  4 функции, 2 пользовательских триггера, RLS и ACL;
- очистка неизвестного default grantee, который намеренно создаёт bootstrap;
- service-only RPC: entitlement, begin, finish, idempotent retry и revoke;
- desired-state/outbox: доверенный Main user, последовательные версии,
  идемпотентный set/claim/finish, lease, retry/backoff и `dead_letter`;
- resolver: точное преобразование подтверждённого `bigint` Telegram ID в строку
  без передачи идентификатора в outbox;
- отсутствие прямого доступа к таблицам у `service_role` и вызова RPC у
  `authenticated`;
- полный rollback тестовых данных;
- обязательный атомарный отказ повторного запуска всех трёх одноразовых миграций;
- неизменность semantic catalog/data fingerprints после smoke и отказа.

Файлы:

- [`bootstrap.sql`](bootstrap.sql) — минимальный Supabase-совместимый shim;
- [`behavior_smoke.sql`](behavior_smoke.sql) — транзакционный RPC smoke;
- [`outbox_behavior_smoke.sql`](outbox_behavior_smoke.sql) — транзакционный
  smoke desired-state, порядка версий, retry и dead-letter;
- [`postflight.sql`](postflight.sql) — независимые runtime-инварианты;
- [`outbox_postflight.sql`](outbox_postflight.sql) — отдельные runtime-инварианты
  outbox, ACL/RLS и запрета identity/secret колонок;
- [`resolver_behavior_smoke.sql`](resolver_behavior_smoke.sql) — exact bigint
  и missing/null user поведение;
- [`resolver_postflight.sql`](resolver_postflight.sql) — metadata и точный ACL
  resolver-функции;
- [`catalog_fingerprint.sql`](catalog_fingerprint.sql) — OID-независимый hash;
- [`run.sh`](run.sh) — fail-closed runner только для loopback CI-базы;
- [`static_guard.test.mjs`](static_guard.test.mjs) — supply-chain и safety guard.

Миграции сами не активируют worker: runtime gate остаётся `disabled`. Это
доказательство исполнимости на PostgreSQL 17, но не доказательство
совместимости с фактической схемой main Supabase. Перед production всё равно
обязательны отдельный main staging и полный Telegram/Edge/PostgREST E2E.

Прежний foundation-контур прошёл [GitHub Actions run #22](https://github.com/lego-business-system/lego-mini-app/actions/runs/29384073500). Новый outbox/resolver/worker пакет локально проходит все проверки, но его исполнение в disposable PostgreSQL 17 должен подтвердить следующий GitHub Actions run. Ни staging, ни live Supabase этими проверками не затрагиваются.
