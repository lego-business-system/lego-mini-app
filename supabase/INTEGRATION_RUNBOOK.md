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

Новый production boundary v2 имеет ровно пять полей и явно фиксирует production
public origin, который hosted verifier обязан запрещать:

```json
{
  "schemaVersion": 2,
  "publicOrigin": "https://<production-main-or-connector-host>",
  "mainEdgeOrigin": "https://<production-main-ref>.supabase.co",
  "financeWebOrigin": "https://<production-finance-host>",
  "telegramMiniAppUrl": "https://t.me/<production_bot>?startapp"
}
```

Старый boundary v1 остаётся допустимым только для совместимости локальных
операторов и полностью инертной bootstrap-сборки на `.invalid`. Любая сборка для
реального host и hosted verifier принимают только v2.
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

После отдельного подтверждённого staging deploy публикация проверяется теми же
external reviewed config и production boundary, а также неизменённой локальной
output-директорией:

```bash
node scripts/verify-finance-pilot-hosted.mjs \
  --artifact /absolute/path/exact-artifact \
  --config /absolute/path/pilot-staging.json \
  --production-boundary /absolute/path/production-boundary.json
```

Оператор выполняет ровно шесть `GET`: `/` и пять именованных asset paths.
Все шесть запросов жёстко привязаны к точному origin
`https://architecture-main-pilot.pages.dev`; значение из config не может
перенаправить verifier на другой Cloudflare host, IP, localhost или порт.
Cloudflare применяет `_headers` как конфигурацию и не публикует его как обычный
asset, а `/index.html` канонизирует в `/`; оба пути поэтому запрещено использовать
как искусственную седьмую проверку. Седьмой локальный файл проверяется до сети, а
его точный контракт доказывается на HTTP-заголовках каждого из шести ответов.
Запросы имеют
пятисекундный timeout, размер каждого
ответа ограничен размером точного локального файла и общим пределом 512 KiB;
cookies, Authorization, referrer и переходы по redirect отсутствуют. Каждый
ответ обязан вернуть `200`, неизменённый exact URL и origin, ожидаемый MIME,
побайтово совпасть с artifact и вернуть все заголовки из локального `_headers`.
Bootstrap `.invalid`, pending/placeholder bot config и безопасная временная
заглушка Pages означают `NO-GO`. Результат редактирован: URL, содержимое и
локальные пути не выводятся; CLI также скрывает детали локальных ошибок.
Проверка read-only и не является разрешением на
deploy или доказательством Telegram E2E.

## Отдельный Telegram pilot bot

Пилот использует отдельного бота, созданного через официальный `@BotFather`.
Production-бот для пилота запрещён. Username нового бота фиксируется в
`telegramMiniAppUrl` внешнего connector config; URL обязан иметь вид
`https://t.me/<staging_bot>?startapp`.

После создания бота токен помещается только во внешний JSON-файл с правами
`0600`:

```json
{
  "schemaVersion": 1,
  "environment": "staging",
  "telegramBotToken": "<secret>"
}
```

Проверить план без токена и без сети:

```bash
node scripts/configure-finance-pilot-bot.mjs \
  --config /absolute/path/pilot-staging.json \
  --production-boundary /absolute/path/production-boundary.json
```

Применить настройку только к боту, чей username регистронезависимо точно
соответствует reviewed staging config:

```bash
node scripts/configure-finance-pilot-bot.mjs \
  --config /absolute/path/pilot-staging.json \
  --production-boundary /absolute/path/production-boundary.json \
  --secrets /absolute/path/telegram-pilot-secrets.json \
  --apply
```

Оператор сначала проверяет `getMe`, затем требует отсутствие уже настроенного
webhook, устанавливает один `web_app` menu button на точный `publicOrigin`,
сразу читает кнопку обратно и повторно подтверждает, что webhook остался пустым.
Токен не принимается через argv, не возвращается в результате и не записывается
в artifact. Любой production URL отклоняется до чтения token-файла и до сети.

Этот Bot API шаг не включает Main Mini App. Для прямой ссылки `?startapp`
в `@BotFather` отдельно выполняется: `/mybots` → pilot bot → `Bot Settings` →
`Configure Mini App` → `Enable Mini App`, URL — точный `publicOrigin`. До этого
пилот можно открыть через настроенную menu button в личном чате с ботом. Ни
BotFather, ни token нельзя считать заменой серверной проверке Telegram
`initData`: её выполняет только Main Edge.

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
   точный Main staging origin, разрешает `frame-ancestors` только для точного
   origin `https://web.telegram.org`, необходимого Telegram Web Mini App,
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

## Live revoke proof и честная source provenance

Снимок сохранности Finance и rollback barrier выполняются только оператором
`staging-gates.mjs`. Перед baseline оператор требует внешний reviewed provenance
файл с точным режимом `0600`, принадлежащий текущему пользователю, без symlink и
вне репозитория:

```json
{
  "schemaVersion": 2,
  "kind": "staging-gate-release-provenance-v2",
  "environment": "staging",
  "mainProjectRef": "bljeoovhydhjhdzwplxh",
  "financeProjectRef": "makgsbjduobcphuqzaoq",
  "mainExpectedCommitSha": "<reviewed clean Main HEAD, 40 lowercase hex>",
  "mainExpectedTreeSha": "<tree of that exact Main HEAD, 40 lowercase hex>",
  "financeReviewedCommitSha": "<reviewed Finance release commit, 40 lowercase hex>",
  "gitExecutableRealPath": "</absolute/real/path/to/reviewed/git>",
  "gitExecutableSha256": "<SHA-256 of the exact Git executable bytes, 64 lowercase hex>",
  "gitVersion": "<exact single-line output of that executable --version>"
}
```

`mainExpectedCommitSha` и `mainExpectedTreeSha` создаются только после commit
точного Main release-кандидата. `gitExecutableRealPath`,
`gitExecutableSha256` и `gitVersion` фиксируются владельцем одновременно с
review release: путь должен быть абсолютным и уже раскрытым realpath, файл —
обычным executable без symlink, не group/world-writable и принадлежащим root
либо текущему оператору. Перед каждым source snapshot оператор дважды читает
bytes Git executable без следования конечному symlink, сверяет SHA-256 и exact
`--version`; произвольный binary в `--git-cli` не принимается.

Оператор самостоятельно связывает ответ Git с фактическим `.git`: для обычного
репозитория realpath каталога `.git` обязан совпасть с
`rev-parse --absolute-git-dir`; для worktree безопасно прочитанный единственный
absolute `gitdir:` pointer обязан указывать ровно на тот же реальный каталог.
Repository root, `.git` и Git directory должны быть real, принадлежать текущему
оператору и не быть group/world-writable.

До hosted read и повторно перед записью receipt оператор требует одновременно:

- `core.sparseCheckout=false`;
- ни одной `assume-unchanged`, `skip-worktree` или иной неканонической index
  записи (`git ls-files -v -z` допускает только normal `H`);
- пустой porcelain status с учётом всех tracked, всех untracked и matching
  ignored paths; даже `supabase/.temp/` и иной ignored residue блокируют proof;
- независимое совпадение фактических bytes с Git blob из exact проверенного
  commit OID для
  `scripts/staging-gates.mjs`, `scripts/staging-revoke-live-proof.mjs`,
  `scripts/finance-pilot-safety.mjs` и
  `supabase/contracts/staging-revoke-preservation-v1.json`.

Перед операторским запуском sparse-checkout нужно отключить, index-флаги снять,
а tracked, untracked и ignored residue удалить или перенести вне worktree.
После проверки runtime bytes и полного status оператор повторно сверяет, что
HEAD и его tree не изменились за время source snapshot.
SHA-256 каждого из четырёх runtime-файлов и identity проверенного Git входят в
`sourceProvenance`; поэтому изменение runtime bytes между baseline и proof
блокирует rollback.

Finance SHA не объявляется live-проверкой развёрнутого Finance: в receipt он
называется `financeReviewedCommitSha` и связан SHA-256 с exact bytes внешнего
reviewed descriptor. Проверка фактического hosted Finance state выполняется
отдельным Main A → Finance → Main B read-only proof.

До revoke, при четырёх включённых gate:

```bash
node scripts/staging-gates.mjs capture-revoke-baseline \
  --receipt-dir /absolute/owner-private/gate-receipts \
  --supabase-cli /absolute/pinned/supabase \
  --git-cli /absolute/git \
  --release-provenance /absolute/owner-private/release-provenance.json \
  --revoke-event-id <UUIDv4>
```

После подтверждённого `revoke` со статусом `applied` сначала отключается Main
protocol. На следующем rollback тот же provenance и UUID обязательны:

```bash
node scripts/staging-gates.mjs rollback \
  --receipt-dir /absolute/owner-private/gate-receipts \
  --supabase-cli /absolute/pinned/supabase \
  --git-cli /absolute/git \
  --release-provenance /absolute/owner-private/release-provenance.json \
  --revoke-event-id <UUIDv4> \
  --apply
```

Новые baseline/proof receipts имеют `schemaVersion: 3` и объект
`sourceProvenance`; прежние v2 receipts с фиксированными commit-полями читаются
только как историческая hash-chain. Legacy v2 baseline не может разрешить новое
отключение Main sync: требуется новый UUID и новый v3 baseline. Ни descriptor,
ни receipt не доказывают deploy сами по себе.

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
