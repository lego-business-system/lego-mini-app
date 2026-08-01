# Межрепозиторный Telegram → Finance контракт

[`telegram-finance-issuer-v1.json`](./telegram-finance-issuer-v1.json) — общий
versioned golden vector server-to-server issuer-контракта. Одинаковый файл
хранится в основном и Finance-репозитории. Его SHA-256 закреплён тестом как
`e2860d8282fc51aad9efa190b9a46f7765a16ebeaae941ff6af66c92192052df`.

Вектор фиксирует точные UTF-8 байты JSON, SHA-256 тела, nonce, canonical request,
HMAC `v1`, детерминированный тестовый код и точные байты успешного ответа. Все
идентификаторы и ключевой материал публичные и предназначены только для теста;
использовать их в local, staging или production запрещено.

[`telegram_finance_contract_v1.test.mjs`](../tests/telegram_finance_contract_v1.test.mjs)
исполняет соответствующую сторону контракта. Изменение существующего v1-вектора
запрещено: несовместимое изменение требует нового файла, новой версии протокола
и одновременного review обоих репозиториев.
