# Main → Finance Telegram code issuer

> Статус: foundation опубликован в рабочей ветке и черновом PR, но не развёрнут. Edge Function, SQL-миграция и секреты не применены; live Supabase и production не изменялись. Интерфейс подключён через отдельный feature gate, который по умолчанию выключен.

## Назначение

`finance-issue-code` — browser-facing Edge Function основного приложения. Она принимает свежий Telegram WebApp `initData`, независимо проверяет официальную HMAC-подпись Telegram, проверяет точный entitlement `architecture_finance` в main Supabase и только после этого подписывает server-to-server запрос в Finance.

Выдача дополнительно закрыта server-side gate `MAIN_FINANCE_PROTOCOL_MODE`: только точное значение `enabled` запускает обработку, а отсутствие, `disabled` или опечатка дают нейтральный `503`. Reviewed `.env.example` оставляет gate выключенным.

Supabase Auth намеренно не используется: по подтверждённому состоянию live main таблица `public.users` существует, но `auth.users` пуста. Новая миграция не меняет `public.users` и существующий `check-access`.

## Browser contract

Метод и путь:

```text
POST /functions/v1/finance-issue-code
Origin: <точный origin из MAIN_FINANCE_ALLOWED_ORIGINS>
content-type: application/json
```

Тело должно быть точным результатом `JSON.stringify` с двумя полями в указанном порядке, без лишних полей, пробелов и дублирующихся ключей:

```json
{"init_data":"<Telegram.WebApp.initData>","request_id":"018f1f3a-7b6a-4a7d-87e0-4fe2d24739c3"}
```

`request_id` — lower-case UUID v4. Для сетевого retry клиент сохраняет тот же UUID и исходное `init_data`. Для новой выдачи Telegram должен предоставить новое свежее `initData`, а клиент создаёт новый UUID. Поля `telegram_id`, `product_code`, `user_id`, Supabase JWT и любые лишние данные отклоняются.

Браузерная реализация находится в [`../../architecture-finance.js`](../../architecture-finance.js). Она хранит `initData`, UUID и показанный код только в памяти, отправляет запрос без cookie/Authorization, повторяет те же байты не дольше 55 секунд и очищает код при уходе с экрана. [`../../architecture-finance-config.js`](../../architecture-finance-config.js) остаётся с `enabled: false` и пустым `financeWebUrl` до успешного staging E2E.

Main Edge ограничивает серверное выполнение 25 секундами (`MAIN_FINANCE_TOTAL_TIMEOUT_MS`, reviewed default 24 секунды), а браузер после начала `fetch` ждёт 30 секунд. Индивидуальные body/DB/upstream timeout дополнительно обрезаются оставшимся общим бюджетом. В staging отдельно проверяется запас на CORS preflight, gateway и сетевую задержку; возможная конкуренция на границе timeout всё равно обрабатывается идемпотентно DB и Finance.

Успех повторяет безопасную часть Finance-ответа:

```json
{
  "ok": true,
  "code": "4829 1376",
  "expires_at": "2026-07-14T14:05:00.000Z",
  "replayed": false,
  "request_id": "018f1f3a-7b6a-4a7d-87e0-4fe2d24739c3"
}
```

Код не сохраняется в main DB. Ошибки нейтральны и не содержат Telegram ID, entitlement, SQL detail, upstream body или секреты.

## Telegram validation

Validator выполняет [официальный алгоритм Telegram Mini Apps](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):

1. Разбирает `initData` как query string, запрещает дублирующиеся поля и невалидное percent-encoding.
2. Удаляет только `hash`, сортирует остальные `key=value` по ASCII-имени и соединяет `\n` без завершающего перевода строки.
3. Получает secret как `HMAC-SHA256(key="WebAppData", message=bot_token)`.
4. Сравнивает `HMAC-SHA256(secret, data_check_string)` с `hash` в constant time.
5. Требует обязательные `auth_date` и `user.id`; по умолчанию возраст не больше 300 секунд, допустимое будущее — 15 секунд. Конфигурация ограничена максимумами 780 и 60 секунд соответственно; вместе с фиксированным запасом 60 секунд любой разрешённый набор укладывается в жёсткое DB-окно replay guard не больше 15 минут.
6. Только после проверки преобразует безопасный integer `user.id` в десятичную строку.

`initDataUnsafe` не используется как источник доверия.

## Main database contract

Черновик [`20260714235900_finance_integration_foundation.sql`](../migrations/20260714235900_finance_integration_foundation.sql) создаёт:

- `architecture_product_entitlements` — точный Finance entitlement по HMAC-псевдониму Telegram subject;
- `architecture_finance_issue_requests` — idempotency/outcome без кода и PII;
- `architecture_finance_issue_replay_guard` — уникальные HMAC-псевдонимы проверенного Telegram `hash` и исходящего nonce;
- три service-only RPC для выдачи entitlement, атомарного begin и finish.

На таблицах включён RLS, политик нет, прямые права отозваны даже у `service_role`; доступ выполняется только через проверенные `SECURITY DEFINER` RPC. Entitlement блокируется на старте операции и повторно проверяется под блокировкой непосредственно перед возвратом успешно выданного Finance-кода. Поэтому отзыв доступа во время сетевого запроса также завершается fail-closed. До явного entitlement endpoint отвечает fail-closed.

В DB не передаются raw Telegram ID, raw `initData`, Telegram `hash`, исходящий nonce, HMAC secret или Finance code. Replay identity выводится только из проверенного Telegram `hash`, поэтому перестановка query-полей или эквивалентное percent-encoding не обходят защиту. Один Telegram launch нельзя связать с новым request UUID. Точный retry восстанавливает исходные timestamp и детерминированный nonce, поэтому Finance получает те же подписанные байты.

DB разрешает не больше пяти попыток для одного UUID, вводит паузу не меньше одной секунды между retry и принимает не больше трёх новых запросов за десять минут для одного проверенного Telegram subject. Решение выполняется под subject advisory lock и учитывает все состояния запросов. Отдельный network-level rate limit на Supabase gateway остаётся обязательной настройкой deployment: client-controlled IP-заголовки функция не считает доверенной идентичностью и не сохраняет.

Миграция одноразовая и fail-closed: если одноимённые integration tables/functions уже существуют, preflight останавливает транзакцию вместо принятия неизвестной или частично изменённой схемы. Каталожный контракт закреплён под подтверждённый read-only аудитом PostgreSQL 17: владелец всех объектов — `postgres`; права отзываются у каждого фактического grantee из `relacl`/`attacl`/`proacl`, включая нестандартные default privileges и grant options. Postflight сверяет точные колонки и defaults, 19 constraints, 4 явных индекса, 4 overload-сигнатуры и их metadata, 2 пользовательских trigger, RLS без policy и точный ACL allow-list.

[GitHub Actions run #22](https://github.com/lego-business-system/lego-mini-app/actions/runs/29384073500) исполнил точную миграцию на чистом PostgreSQL 17: первый commit, независимый catalog postflight, service-only поведенческий smoke с rollback и атомарно отклонённый повтор без изменения catalog/data fingerprints. Это доказательство для минимального PostgreSQL/Supabase-compatible shim, но не для hosted Supabase Edge Runtime, Auth/PostgREST или фактической main-схемы. Первый запуск в Supabase допускается только в одноразовом main staging; retention request/replay rows остаётся нерешённым продуктовым вопросом в runbook и этой миграцией не задаётся.

## Finance server-to-server contract

Реализован контракт соседнего Finance-репозитория: `POST /functions/v1/finance-issue-telegram-code`, точный JSON `{"telegram_id":"...","product_code":"architecture_finance"}` и заголовки:

```text
x-architecture-timestamp
x-architecture-nonce
x-architecture-request-id
x-architecture-signature: v1=<lower-case HMAC-SHA256 hex>
```

Каноническая строка:

```text
POST
/functions/v1/finance-issue-telegram-code
<timestamp>
<nonce>
<request_id>
<sha256(raw_body_bytes)>
```

`MAIN_FINANCE_ISSUER_HMAC_SECRET` должен совпадать с Finance `FINANCE_TELEGRAM_ISSUER_HMAC_SECRET`. Privacy key, nonce key, Telegram bot token и integration secret обязаны быть разными.

## Main → Finance entitlement delivery

`finance-sync-entitlements` — приватный, выключенный по умолчанию worker. Он принимает только точный `POST {}` без browser `Origin`, cookie и Authorization и требует отдельный заголовок `x-architecture-sync-trigger`. Этот trigger secret не используется для HMAC-запроса в Finance и не должен совпадать ни с одним другим секретом.

Последовательность обработки:

1. service-only claim получает одну версионированную запись outbox с lease;
2. service-only resolver читает подтверждённый `public.users.telegram_id` как decimal string, не допуская округления `bigint` в JavaScript;
3. worker заново получает keyed digest `main-telegram-subject-v1` и сравнивает его constant-time с outbox;
4. точные канонические байты подписываются отдельным `MAIN_FINANCE_ENTITLEMENT_HMAC_SECRET` и отправляются только на закреплённый HTTPS Finance path;
5. только точный canonical success переводит событие в `applied`; 429/5xx/сеть дают bounded retry, протокольные и постоянные 4xx — `dead_letter`;
6. текущий grant открывает Main entitlement gate только после Finance success; revoke, retry, dead-letter и устаревший grant оставляют gate закрытым.

Outbox не хранит raw Telegram ID. Финансовые записи Finance при revoke не удаляются: закрываются доступ, активные коды и устройства. Все worker/endpoint gates в примерах имеют значение `disabled`.

## Trust boundaries

- CORS — только точное HTTPS-значение из allow-list; `*`, cookie и browser Authorization запрещены.
- Incoming JSON, UTF-8, размер и время чтения ограничены.
- Upstream URL обязан быть HTTPS, без credentials/query/hash и с точным canonical path.
- Redirect запрещён; DB и upstream имеют отдельные timeout внутри общего deadline не больше 25 секунд; Finance response ограничен по размеру и строгой схеме.
- В Edge-исходниках нет `console.*`; request body, Telegram ID, code, nonce, signatures и ошибки зависимостей не логируются.
- `@supabase/supabase-js` закреплён на `2.106.2`; function-local `deno.lock` фиксирует девять npm-пакетов с integrity и SHA-256 `5e322322c36ec504c98691cbea052a618d969d627ffcc21f89a5a440d61077eb`.

Локальная проверка:

```bash
./supabase/tests/verify_local.sh
deno check --config supabase/functions/finance-issue-code/deno.json --frozen supabase/functions/finance-issue-code/index.ts
(cd supabase/functions/finance-issue-code && deno audit --frozen)
deno check --config supabase/functions/finance-sync-entitlements/deno.json --frozen supabase/functions/finance-sync-entitlements/index.ts
(cd supabase/functions/finance-sync-entitlements && deno audit --frozen)
```

CI закрепляет Deno `2.9.2`, frozen type-check и dependency audit через immutable action commit. Локальный audit не обнаружил известных уязвимостей. Это не заменяет сборку и E2E на фактическом Supabase Edge Runtime staging.

Staging-порядок и rollback находятся в [`../INTEGRATION_RUNBOOK.md`](../INTEGRATION_RUNBOOK.md).
