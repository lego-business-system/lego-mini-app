# Disposable PostgreSQL 17 verification

Этот контур исполняет main-миграцию Finance foundation в одноразовой базе
PostgreSQL 17 внутри GitHub Actions. Он не подключается к Supabase, не читает
repository secrets и не может работать с удалённой базой.

Проверяется:

- первое применение миграции вместе с её встроенным строгим postflight;
- независимый каталог: 3 таблицы, 24 колонки, 19 constraints, 10 индексов,
  4 функции, 2 пользовательских триггера, RLS и ACL;
- очистка неизвестного default grantee, который намеренно создаёт bootstrap;
- service-only RPC: entitlement, begin, finish, idempotent retry и revoke;
- отсутствие прямого доступа к таблицам у `service_role` и вызова RPC у
  `authenticated`;
- полный rollback тестовых данных;
- обязательный атомарный отказ повторного запуска одноразовой миграции;
- неизменность semantic catalog/data fingerprints после smoke и отказа.

Файлы:

- [`bootstrap.sql`](bootstrap.sql) — минимальный Supabase-совместимый shim;
- [`behavior_smoke.sql`](behavior_smoke.sql) — транзакционный RPC smoke;
- [`postflight.sql`](postflight.sql) — независимые runtime-инварианты;
- [`catalog_fingerprint.sql`](catalog_fingerprint.sql) — OID-независимый hash;
- [`run.sh`](run.sh) — fail-closed runner только для loopback CI-базы;
- [`static_guard.test.mjs`](static_guard.test.mjs) — supply-chain и safety guard.

Это доказательство исполнимости на PostgreSQL 17, но не доказательство
совместимости с фактической схемой main Supabase. Перед production всё равно
обязательны отдельный main staging, read-only аудит `public.users` и
действующего `check-access`, а затем полный Telegram E2E.
