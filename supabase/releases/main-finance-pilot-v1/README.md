# Main Finance pilot v1 — staging release gate

Этот каталог является проверяемым планом. Он не выполняет hosted write и не
разрешает production.

## Точная граница

- допустимый Main staging: `bljeoovhydhjhdzwplxh`;
- запрещённый Main production: `soxtekhspohkddpdidvp`;
- миграции: ровно пять файлов из `staging.manifest.json`;
- Edge Functions: только `finance-sync-entitlements` и `finance-issue-code`;
- оба server gate до E2E: `disabled`;
- production-данные в staging: `0` строк.

Локальный plan-only оператор:

```bash
node scripts/prepare-main-finance-staging.mjs \
  --project-ref bljeoovhydhjhdzwplxh
```

Он проверяет release hashes и печатает будущий порядок команд, но не запускает
`config push`, `secrets set` или `functions deploy`. `--apply` всегда
отклоняется.

## Postflight после пяти миграций

[`postflight.sql`](postflight.sql) запускается только через соединение, уже
независимо подтверждённое как exact Main staging. Connection string или пароль
не передаются аргументом командной строки и не сохраняются в репозитории.

SHA-256:

```text
e010d27d41e5ea01c7f8c95523456a5d995a8d8a019ca78fb18ed119d17b79f2
```

Postflight открывает `READ ONLY` транзакцию и требует одновременно:

1. историю из одной `<timestamp>/remote_schema` и пяти точных staging
   миграций;
2. пять точных integration tables, 57 колонок, 49 constraints, 20 indexes и
   четыре пользовательских trigger;
3. RLS без policy, владельца `postgres`, ровно owner-only
   `SELECT`/`INSERT`/`UPDATE` ACL на пяти integration tables и отсутствие
   column ACL;
4. девять точных function signatures/bodies/metadata, семь service-only ACL
   и один owner-only `EXECUTE` на вложенном entitlement primitive;
5. исходный контракт `public.users.id uuid UNIQUE NOT NULL` и
   `telegram_id bigint UNIQUE NOT NULL`;
6. ноль строк во всех `public` tables и в `auth.users`.

Любое отличие — `NO-GO`. SQL завершает проверку `ROLLBACK` и ничего не меняет.

## Будущий Edge-порядок

После успешного migration postflight и проверки SHA внешнего environment-файла
разрешён только порядок из manifest:

1. `supabase config push` в exact staging;
2. `supabase secrets set --env-file <external-reviewed-file>`;
3. deploy `finance-sync-entitlements` с `--no-verify-jwt --use-api`;
4. deploy `finance-issue-code` с `--no-verify-jwt --use-api`.

Deployment set SHA-256:

```text
8ecac081bf2c64bd107350efcdd1141a0f95d1d8da551db17164b24f141170b4
```

`--prune`, deploy всех функций без имени, корень полного Main-приложения и любой
другой project ref запрещены. При частичном сбое оба gate остаются `disabled`,
connector не включается, повторная запись не выполняется до read-only проверки
фактического состояния.
