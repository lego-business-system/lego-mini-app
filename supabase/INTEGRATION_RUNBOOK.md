# Main → Finance v1 pilot runbook

> Только staging. Документ не подтверждает deploy и не разрешает production,
> миграции или изменение Auth без отдельного подтверждения владельца.

## Цель и граница пилота

Пилот доказывает одну цепочку:

```text
Telegram → Main connector → одноразовый код → Finance → revoke → повторный grant
```

В пилот входят только v1 subject, три Main-миграции, две Main Edge Functions,
Finance issuer/entitlement consumer и отдельный connector artifact. Полный Main
сайт не публикуется. Ротация privacy key, Telegram rebind, subject v2, массовый
batch и production не входят.

## Обязательные предпосылки

1. Main staging и Finance staging — отдельные проекты без пользовательских
   production-данных.
2. Read-only preflight подтверждает в Main staging:
   `public.users.id uuid NOT NULL UNIQUE` и
   `public.users.telegram_id bigint NOT NULL UNIQUE`.
3. Один тестовый пользователь существует в `public.users`; его Telegram ID не
   меняется до завершения пилота.
4. Общие contract fixtures в Main и Finance побайтово совпадают.
5. Все server secrets созданы заново. Совпадают между проектами только
   соответствующие issuer и entitlement HMAC secrets; bot/privacy/nonce/trigger
   keys различны.
6. Точные staging URLs и production boundary хранятся во внешних локальных JSON
   файлах с правами `0600`. Секреты в эти файлы не помещаются.

## Формат внешнего connector config

```json
{
  "schemaVersion": 1,
  "environment": "staging",
  "publicOrigin": "https://<connector-staging-host>",
  "mainEdgeOrigin": "https://<main-staging-ref>.supabase.co",
  "financeWebOrigin": "https://<finance-staging-host>",
  "telegramMiniAppUrl": "https://t.me/<staging_bot>?startapp",
  "features": { "issueCode": true }
}
```

Production boundary имеет ровно четыре поля:
`schemaVersion`, `mainEdgeOrigin`, `financeWebOrigin`, `telegramMiniAppUrl`.
Сборщик прекращает работу, если staging совпадает хотя бы с одним production
значением. Production boundary не попадает в artifact.

Сборка выполняется только во внешнюю пустую директорию:

```bash
node scripts/build-finance-pilot.mjs \
  --config /absolute/path/pilot-staging.json \
  --production-boundary /absolute/path/production-boundary.json \
  --out /absolute/path/empty-artifact

node scripts/verify-finance-pilot-artifact.mjs \
  --artifact /absolute/path/empty-artifact \
  --config /absolute/path/pilot-staging.json \
  --production-boundary /absolute/path/production-boundary.json
```

Разворачивать можно только эту output-директорию. Корень репозитория для
connector deploy запрещён.

## Порядок staging deploy

Каждый hosted/database шаг выполняется отдельно и только после явного
подтверждения владельца.

### Безопасная подготовка Main staging

Точный release-контракт находится в
[`releases/main-finance-pilot-v1/staging.manifest.json`](releases/main-finance-pilot-v1/staging.manifest.json).
Он принимает только созданный data-less Main staging ref
`bljeoovhydhjhdzwplxh`, навсегда запрещает Main production ref
`soxtekhspohkddpdidvp`, закрепляет Supabase CLI `2.109.1`, ровно три миграции
v1 и ровно две Edge Functions. Любой иной ref отклоняется.

Обычный запуск ничего не скачивает, не читает секреты и не обращается к hosted
Supabase:

```bash
node scripts/prepare-main-finance-staging.mjs \
  --project-ref bljeoovhydhjhdzwplxh
```

После создания новой data-less ветки допускается только read-only подготовка в
новой внешней директории, которой ещё не существует:

```bash
node scripts/prepare-main-finance-staging.mjs \
  --project-ref bljeoovhydhjhdzwplxh \
  --prepare \
  --workspace /absolute/new/disposable/main-staging-preflight \
  --supabase-cli /absolute/pinned/supabase
```

Оператор выполняет `migration fetch` только в каталоге `fetch`, принимает ровно
один файл `<timestamp>_remote_schema.sql`, затем создаёт отдельный каталог
`deploy`. Fetched baseline нужен только для локального сопоставления истории и
не должен исполняться повторно. `migration list` обязан показать baseline как
local+remote, а три pilot-версии — только local. `db push --dry-run` обязан
предложить ровно эти файлы и в таком порядке:

1. `20260714235900_finance_integration_foundation.sql`;
2. `20260715010000_finance_entitlement_outbox_v1.sql`;
3. `20260715020000_finance_subject_resolver_v1.sql`.

Перед CLI оператор удаляет из дочернего окружения все `PG*`, `POSTGRES*`,
`DATABASE*`, `DB_*` и `SUPABASE_*` target overrides; сохраняется только
`SUPABASE_ACCESS_TOKEN`. После каждого `link`, `migration fetch`,
`migration list` и dry-run заново проверяется соответствующая одноразовая
`supabase/.temp`: `project-ref`/`linked-project.json` обязан указывать только на
`bljeoovhydhjhdzwplxh`, а ни один metadata-файл не может содержать production
ref или `soxtekhspohkddpdidvp.supabase.co`. При ошибке CLI stdout/stderr целиком
скрываются, чтобы URL, connection string или credential не попали в терминал.

Любой другой файл, порядок, версия CLI или project ref означает `NO-GO`.
Оператор не поддерживает `--apply` и не выполняет secrets/functions deploy.
Перед будущим применением требуются отдельное текущее подтверждение владельца,
точные staging/production refs, hash release-набора, hash dry-run attestation и
hash внешнего environment-файла. В environment-файле оба gate сначала обязаны
оставаться `disabled`; шесть server-only secrets перечислены в manifest и
[`functions/.env.example`](functions/.env.example), но не входят в attestation.

1. Локально пройти `verify_local.sh`, static guard, frozen Deno check/audit и
   clean diff/secret scan.
2. В Finance staging сначала применить reviewed Finance entitlement/issuer
   migrations, затем развернуть `finance-apply-entitlement-event` и
   `finance-issue-telegram-code`. Клиентский вход пока выключен.
3. В Main staging применить строго по порядку:
   - `20260714235900_finance_integration_foundation.sql`;
   - `20260715010000_finance_entitlement_outbox_v1.sql`;
   - `20260715020000_finance_subject_resolver_v1.sql`.
4. Не применять никакую subject-rotation/v2 migration.
5. Развернуть `finance-sync-entitlements` и `finance-issue-code` с
   `verify_jwt=false`, но оставить `MAIN_FINANCE_SYNC_MODE=disabled` и
   `MAIN_FINANCE_PROTOCOL_MODE=disabled`. Обе функции имеют собственную
   внутреннюю аутентификацию; browser context для worker запрещён.
6. Настроить точные staging origins/paths, server secrets и gateway rate limit.
7. Собрать и проверить отдельный connector artifact из ровно семи файлов.
   Седьмой файл `_headers` предназначен для Cloudflare Pages: он возвращает
   побайтово тот же CSP как HTTP header, оставляет в `connect-src` только один
   точный Main staging origin, устанавливает `frame-ancestors 'none'`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, закрытую
   Permissions Policy, `Cross-Origin-Opener-Policy: same-origin` и
   `Cross-Origin-Resource-Policy: same-origin`. Опубликовать только эту output-
   директорию с gate выключенным и привязать только к staging Telegram bot.
   `frame-ancestors` из meta-тега сам по себе не является защитой; до включения
   issuer фактический HTTP-ответ обязан побайтово совпасть с `_headers`.
8. Включить sync worker, выполнить один адресный grant, проверить read-only
   status и Finance entitlement. Затем включить issuer. Connector — последний.

## Операторский grant/revoke

Прямой вызов `architecture_upsert_product_entitlement_internal` запрещён.
Единственный операторский путь — `manage-finance-access.mjs`: он сначала читает
текущую версию, вычисляет subject из service-only resolver, пишет desired state
с optimistic `expected_version`, адресно запускает ровно одно событие и повторно
читает status.

Dry-run не читает secrets и не делает сеть:

```bash
node scripts/manage-finance-access.mjs grant \
  --user-id <UUIDv4> --event-id <UUIDv4> \
  --changed-by operator:<name> --reason "Pilot access approved"
```

Для staging apply обязательны внешний target descriptor, связанный SHA-256 с
production boundary, `--apply`; для немедленной адресной доставки —
`--dispatch`. Если сеть оборвалась после setter, повторная mutation запрещена до
read-only `status`: outcome считается неизвестным.

## Обязательный E2E

1. Вне Telegram, пустой/невалидный/устаревший `initData` → код не выдаётся.
2. Нет Main entitlement или он blocked/revoked → Finance upstream не вызывается.
3. Валидный свежий Telegram + applied grant → один восьмизначный код.
4. Exact retry использует тот же UUID и байты; changed payload/replay → отказ.
5. Код вводится в Finance, создаётся разрешённая browser session.
6. Логи не содержат raw body, Telegram ID, code, nonce, HMAC или service keys.
7. Revoke через новый UUID закрывает Main gate немедленно, адресное событие
   становится `applied`, Finance закрывает entitlement, активные коды/устройства
   и ранее открытая сессия больше не получает доступ. Финансовые записи не
   удаляются.
8. Повторный grant новым UUID восстанавливает вход.

## Go / no-go

Go возможен только если одновременно:

- CI и disposable PostgreSQL 17 зелёные;
- artifact verifier подтверждает ровно семь файлов, точный HTTP CSP и отсутствие production
  URL/full Main assets;
- hosted Edge smoke выполнен при выключенном UI;
- grant/login/revoke/regrant завершены без ручного изменения таблиц;
- Main и Finance status совпадают;
- rollback проверен.

Любой unknown outcome, `dead_letter`, subject mismatch, production URL в
artifact, попытка rebind/rotation или расхождение статусов — no-go.

## Rollback

1. Снять connector/feature gate.
2. Отключить issuer (`MAIN_FINANCE_PROTOCOL_MODE=disabled`).
3. Довести pending revoke до подтверждённого Finance `applied`.
4. Только после проверки очереди отключить sync worker.
5. Не удалять audit/outbox/request/replay rows и финансовые данные.
6. Не откатывать SQL разрушительными командами. Destructive rollback требует
   отдельного review и подтверждения владельца.

## Отложено после пилота

- управляемая ротация privacy key и subject v2;
- Telegram account rebind;
- массовое назначение ролей/entitlements;
- полный Main staging с восстановлением отсутствующих legacy Edge sources;
- production rollout;
- retention policy и автоматизация observability/alerting.
