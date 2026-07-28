# Main Finance staging access bootstrap

Этот оператор готовит только отдельный пилотный staging. Production refs
`soxtekhspohkddpdidvp` и `koibxwgtihwajocxfetb` запрещены до чтения PAT,
локальных секретов и до сети.

## Почему ротация ограничена пустым staging

`MAIN_FINANCE_SYNC_TRIGGER_SECRET` используется только как отдельный ключ
запуска Main worker. Он не передаётся в Finance и не совпадает с issuer либо
entitlement HMAC. Его смена делает старые операторские запросы
неавторизованными, поэтому разрешена только при четырёх выключенных pilot
gate.

`MAIN_FINANCE_PRIVACY_HMAC_KEY` также не является общим секретом Main и
Finance, но он определяет `subject_digest`. Его смена после первого grant,
issue-code или Finance login создала бы новый псевдоним того же Telegram
пользователя и оставила бы старую цепочку entitlement без управляемой
привязки. Поэтому bootstrap разрешён только пока:

- Main Auth пуст;
- Main содержит не более одной строки fixture в `public.users`;
- пять Main subject/outbox/issue таблиц пусты;
- Finance Auth, profiles, entitlements, devices, codes, integration state,
  subject bindings и rotation-authorizations пусты;
- Finance subject-cutover содержит ровно одну миграционную строку
  `architecture_finance/preparing` без данных финализации;
- все четыре Main/Finance gate имеют точное значение `disabled`.

Эти условия проверяются заново перед локальной подготовкой и перед будущей
установкой. Проверка выполняется только через Management API endpoint
`/database/query/read-only`.

## Режимы

Инертный план не читает PAT, не делает сеть и не создаёт файлы:

```bash
node scripts/bootstrap-main-finance-staging-access.mjs \
  --plan \
  --main-project-ref bljeoovhydhjhdzwplxh \
  --finance-project-ref makgsbjduobcphuqzaoq
```

Подготовка выполняет пять hosted read:

1. Main read-only database preflight;
2. Finance read-only database preflight;
3. Main secret inventory;
4. Finance secret inventory;
5. revealed Main API key inventory.

После проверок она принимает ровно один legacy JWT с ролью `service_role` и
точным Main staging `ref`, генерирует два разных 384-bit секрета и создаёт
новую внешнюю директорию `0700`. В ней находятся только:

- `main-finance-staging-runtime.env` — режим `0600`, четыре runtime значения
  для `manage-finance-access.mjs`;
- `main-finance-staging-runtime.attestation.json` — режим `0600`, только
  hashes и границы, без значений секретов.

```bash
node scripts/bootstrap-main-finance-staging-access.mjs \
  --prepare \
  --main-project-ref bljeoovhydhjhdzwplxh \
  --finance-project-ref makgsbjduobcphuqzaoq \
  --access-token-file /absolute/owner-private/access-token \
  --output-directory /absolute/new/owner-private/bootstrap-bundle
```

Подготовка не меняет hosted Supabase.

Режим установки существует для отдельного подтверждённого staging шага, но
не является частью подготовки. Он повторяет все guards, выполняет ровно один
`POST /v1/projects/bljeoovhydhjhdzwplxh/secrets` с двумя именами:

- `MAIN_FINANCE_PRIVACY_HMAC_KEY`;
- `MAIN_FINANCE_SYNC_TRIGGER_SECRET`.

После POST оператор повторно читает Main и Finance secret inventory,
подтверждает новые SHA-256 и запрещает любое изменение остальных секретов.
Неопределённый outcome фиксируется во внешнем receipt и не допускает
автоматический retry.

```bash
node scripts/bootstrap-main-finance-staging-access.mjs \
  --install \
  --main-project-ref bljeoovhydhjhdzwplxh \
  --finance-project-ref makgsbjduobcphuqzaoq \
  --access-token-file /absolute/owner-private/access-token \
  --bundle-directory /absolute/owner-private/bootstrap-bundle \
  --receipt-directory /absolute/owner-private/receipts \
  --confirmation "INSTALL MAIN FINANCE E2E SECRETS TO DATALESS STAGING ONLY"
```

Если `POST` был отправлен, но его ответ не прошёл строгий контракт оператора,
повторять `--install` запрещено. Для такого случая существует отдельный
`--reconcile`:

- принимает исходный bundle и ровно один криптографически проверенный
  `*-unknown.json`;
- выполняет ровно два `GET`: Main и Finance staging secret inventory;
- не делает database query, `POST`, `PATCH`, `PUT` или `DELETE`;
- требует, чтобы все четыре Main/Finance gate оставались точным `disabled`;
- сравнивает только SHA-256 двух целевых секретов с исходной attestation;
- не печатает и не записывает значения секретов;
- при полном совпадении создаёт детерминированный verified receipt, связанный
  с unknown receipt, runtime attestation и двумя ожидаемыми digest;
- при несовпадении не создаёт verified receipt и не допускает повторной
  мутации.

Граница доказательства указана в receipt прямо: reconciliation подтверждает
текущее совпадение двух целевых digest и четыре выключенных gate. Она не
утверждает неизменность остальных секретов, потому что unknown receipt не
содержит доверенного полного снимка inventory до POST.

```bash
node scripts/bootstrap-main-finance-staging-access.mjs \
  --reconcile \
  --main-project-ref bljeoovhydhjhdzwplxh \
  --finance-project-ref makgsbjduobcphuqzaoq \
  --access-token-file /absolute/owner-private/access-token \
  --bundle-directory /absolute/owner-private/bootstrap-bundle \
  --unknown-receipt-file /absolute/owner-private/receipts/main-finance-staging-secret-install-TIMESTAMP-unknown.json \
  --receipt-directory /absolute/owner-private/receipts
```

Повторный `--reconcile` с тем же unknown receipt также запрещён: имя
подтверждённого receipt детерминировано, а запись использует `O_EXCL`.

Этот install нельзя запускать после появления первого subject-bound состояния.
Дальнейшая смена privacy key требует отдельного subject-rotation протокола, а
не повторного bootstrap.
