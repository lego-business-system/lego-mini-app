# Main → Finance integration runbook

> Этот документ описывает будущую staging-проверку. Он не подтверждает deploy, миграцию или наличие production secrets.

## Подтверждённые допущения foundation

- Main и Finance — разные Supabase-проекты.
- В main существует `public.users`, но её схема в этом репозитории не зафиксирована; `auth.users` сейчас пуста.
- Текущий `check-access` находится в live Supabase, а не в данном Git-репозитории. Миграция его не заменяет и не изменяет.
- Источника Finance entitlement в main сейчас нет. Новая таблица пуста и поэтому блокирует все выдачи до явного sync/provisioning.
- Finance profile и Finance entitlement должны уже существовать и совпадать с тем же Telegram ID; Finance повторно проверяет их транзакционно.
- UI рабочей ветки уже добавлен отдельными `architecture-finance*.js/css`, но feature gate выключен, а адрес Finance-сайта пуст. Поэтому даже случайная публикация статических файлов не начинает выдавать коды.
- Main foundation и общий с Finance golden contract v1 прошли одноразовый PostgreSQL 17 CI со строгим postflight, поведенческим smoke, rollback и ожидаемым отказом повторного запуска: [run #26](https://github.com/lego-business-system/lego-mini-app/actions/runs/29385810300). Это не Supabase staging и не разрешение на deploy.

## Подготовка staging

1. Подтвердить, что оба репозитория содержат побайтно одинаковый `supabase/contracts/telegram-finance-issuer-v1.json`, а его SHA-256 совпадает с закреплённым в контрактных тестах.
2. Подтвердить committed function-local `deno.lock`, выполнить frozen `deno check`/audit и затем повторить сборку именно фактическим Supabase Edge Runtime; Deno CLI `2.9.2` в CI не считается доказательством hosted-совместимости.
3. Создать отдельные main staging и Finance staging. Не использовать production для первой проверки.
4. В Finance staging применить reviewed Finance migrations и развернуть `finance-issue-telegram-code` единым bundle.
5. В main staging проверить read-only, что `public.users` существует и новая миграция не конфликтует с текущим `check-access`.
6. Применить main draft `20260714235900_finance_integration_foundation.sql` только после отдельного подтверждения владельца.
7. Создать четыре разные случайные server-only secrets минимум по 32 bytes. Integration HMAC secret установить одинаковым в двух проектах; остальные ключи не переиспользовать.
8. Заполнить точные staging origins/URLs из `.env.example`, оставить `MAIN_FINANCE_PROTOCOL_MODE=disabled`, deploy `finance-issue-code` с `verify_jwt=false` и убедиться, что JWT отключён только у этой функции.
9. На Supabase gateway включить network-level rate limit. Edge намеренно не доверяет client-controlled IP headers и не сохраняет сетевые идентификаторы; DB дополнительно ограничивает verified subject.

## Provisioning entitlement

Сначала будущий sync должен взять Telegram ID из доверенного main-контура, вычислить:

```text
HMAC-SHA256(
  MAIN_FINANCE_PRIVACY_HMAC_KEY,
  "main-telegram-subject-v1\n<Telegram ID as decimal string>"
)
```

и передать только 32-byte digest в service-only RPC `architecture_upsert_product_entitlement_internal`. Raw Telegram ID нельзя помещать в migration, SQL history, URL, логи или integration request tables.

До создания отдельного sync-worker допускается только ручной provisioning в изолированном staging через доверенную server-side сессию. Production provisioning без утверждённого source-of-truth и revoke-процесса запрещён.

## Обязательные E2E сценарии

1. Валидный свежий `initData` + active entitlement → один восьмизначный код.
2. Невалидный hash, изменённый `user`, stale/future `auth_date`, duplicate query key → отказ до DB/upstream.
3. Нет entitlement, status `blocked`, истёкшее окно → одинаковый нейтральный отказ; Finance не вызывается.
4. Exact retry с тем же UUID и `initData` → те же timestamp, nonce, JSON bytes и Finance code; шестая попытка и retry раньше одной секунды → `429` до Finance.
5. Тот же UUID с другим Telegram launch, тот же launch с новым UUID, переставленными query fields или эквивалентным percent-encoding, изменённый product/identity field → отказ; варианты одного launch должны иметь один replay digest.
6. Неверный origin, wildcard, cookie, Authorization, oversized/slow/noncanonical JSON → отказ.
7. Неверная upstream signature/timestamp/path, redirect, timeout, 5xx, oversized/malformed response → код не возвращается; точный retry восстанавливается в пределах окна.
8. Main entitlement отозван между begin и retry → retry блокируется.
9. Finance profile/entitlement отсутствует или отозван → Finance возвращает отказ независимо от main.
10. Убедиться через log drain, что raw body, Telegram ID, code, nonce, HMAC, bot token и SQL details нигде не сохраняются.
11. Четвёртый новый запрос одного verified subject за rolling-окно десять минут → `429`, включая ранее rejected/upstream_error requests.

## Rollout

Обновление не считается атомарным: база, Edge Functions и два статических клиента публикуются отдельно. Поэтому порядок обязателен:

1. В Finance staging применить только аддитивную phase A migration: v2-таблицы и internal RPC существуют рядом с legacy-маршрутом. Phase A не удаляет legacy-коды и не закрывает старый browser RPC; при этом legacy RPC не должен видеть v2 digest-коды, иначе он обойдёт Edge/IP-limit.
2. Развернуть Finance issuer/consumer и проверить их напрямую. Main UI остаётся выключен.
3. Применить main DB foundation, настроить четыре раздельных секрета, точные origins и gateway network-rate-limit; затем развернуть main issuer с `MAIN_FINANCE_PROTOCOL_MODE=disabled`.
4. Опубликовать versioned Finance client и проверить HTTP cache policy. Старый клиент в переходном окне использует только legacy-коды, новый — только v2 Edge consumer.
5. Выполнить весь E2E/concurrency/security набор обоих репозиториев как одного контракта.
6. Сначала включить `MAIN_FINANCE_PROTOCOL_MODE=enabled` для пилотной entitlement-группы. Затем в `architecture-finance-config.js` указать проверенный HTTPS-адрес Finance-сайта и включить `enabled: true`; main UI включается последним.
7. Запретить создание новых legacy-кодов. После интервала `legacy code TTL + подтверждённый browser/CDN cache drain + active-tab grace` отдельной Finance phase B migration закрыть legacy RPC и удалить только истёкшие legacy-коды.

Каждый пункт имеет отдельный go/no-go. Production повторяет уже проверенную staging-последовательность только после отдельного подтверждения владельца.

## Rollback

- Сначала вернуть `enabled: false` или удалить exact main origin, чтобы остановить новые запросы.
- Не удалять request/replay rows до расследования; они не содержат raw PII или codes.
- Отключить main Edge, затем Finance issuer только после прекращения трафика.
- Пока phase B не применена, старый клиент можно временно оставить на legacy-маршруте; v2-коды туда никогда не передаются.
- SQL tables/functions не удалять автоматически. Destructive rollback требует отдельного review и подтверждения владельца.
- При подозрении на secret exposure ротировать integration, privacy и nonce keys раздельно. Смена privacy key требует осознанной пересинхронизации entitlement pseudonyms.

## Пока не решено

- Какая таблица/событие является каноническим источником entitlement в основном продукте.
- Как sync связывает `public.users` с HMAC subject без хранения raw Telegram ID в integration tables.
- Retention schedule для request/replay rows и срок хранения audit metadata.
- Production origins, проекты, secret manager, observability redaction и ответственный за revoke.
