# Main Finance pilot v1 — staging release gate

Этот каталог является проверяемым планом. Он не выполняет hosted write и не
разрешает production.

## Точная граница

- допустимый Main staging: `bljeoovhydhjhdzwplxh`;
- запрещённый Main production: `soxtekhspohkddpdidvp`;
- миграции: ровно три файла из `staging.manifest.json`;
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

## Postflight после трёх миграций

[`postflight.sql`](postflight.sql) запускается только через соединение, уже
независимо подтверждённое как exact Main staging. Connection string или пароль
не передаются аргументом командной строки и не сохраняются в репозитории.

SHA-256:

```text
9772ec633a2e8b8dd86e1e994020885db7147f3e39b910dbc43ab25f922d972b
```

Postflight открывает `READ ONLY` транзакцию и требует одновременно:

1. историю из одной поздней `<timestamp>/remote_schema` и трёх точных v1
   миграций;
2. пять точных integration tables, 57 колонок, 49 constraints, 20 indexes и
   четыре пользовательских trigger;
3. RLS без policy, владельца `postgres`, отсутствие прямых table/column ACL;
4. девять точных function signatures/bodies/metadata и семь service-only ACL;
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
bfce967fc0cfc39c5399b52d8c804287db98f8c510e43e9e040ea4b3a0d35263
```

`--prune`, deploy всех функций без имени, корень полного Main-приложения и любой
другой project ref запрещены. При частичном сбое оба gate остаются `disabled`,
connector не включается, повторная запись не выполняется до read-only проверки
фактического состояния.
