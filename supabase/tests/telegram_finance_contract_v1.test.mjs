import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFinanceCanonicalRequest,
  buildFinanceIssuerBody,
  deriveFinanceNonce,
  sha256Hex,
  signFinanceCanonicalRequest,
  validateFinanceSuccess,
} from "../functions/_shared/main-finance-protocol.mjs";

const FIXTURE_PATH = "supabase/contracts/telegram-finance-issuer-v1.json";
const FIXTURE_SHA256 =
  "e2860d8282fc51aad9efa190b9a46f7765a16ebeaae941ff6af66c92192052df";
const fixtureSource = readFileSync(FIXTURE_PATH, "utf8");
const fixture = JSON.parse(fixtureSource);

test("shared Telegram Finance issuer v1 fixture is versioned and byte-pinned", () => {
  assert.equal(
    createHash("sha256").update(fixtureSource).digest("hex"),
    FIXTURE_SHA256,
  );
  assert.equal(fixture.contract_id, "architecture.finance.telegram-code.issuer");
  assert.equal(fixture.contract_version, 1);
  assert.equal(fixture.vector_id, "golden-v1-001");
  assert.equal(
    fixture.key_material_notice,
    "PUBLIC TEST VECTOR ONLY. NEVER USE IN ANY ENVIRONMENT.",
  );
});

test("Main producer matches the shared v1 request bytes, nonce and signature", async () => {
  const { request, test_only_key_material: keys, expected } = fixture;
  const body = buildFinanceIssuerBody(request.telegram_id, request.product_code);
  assert.equal(new TextDecoder().decode(body), expected.request_body_utf8);
  assert.equal(await sha256Hex(body), expected.request_body_sha256);
  assert.equal(
    createHash("sha256").update(body).digest("hex"),
    expected.request_body_sha256,
  );

  const nonce = await deriveFinanceNonce(keys.nonce_hmac_key, request.request_id);
  assert.equal(nonce, expected.nonce);
  assert.equal(
    createHmac("sha256", keys.nonce_hmac_key)
      .update(`main-finance-network-nonce-v1\n${request.request_id}`)
      .digest("hex"),
    expected.nonce,
  );

  const canonical = buildFinanceCanonicalRequest({
    method: request.method,
    path: request.path,
    timestamp: request.timestamp,
    nonce,
    requestId: request.request_id,
    bodySha256: expected.request_body_sha256,
  });
  assert.equal(canonical, expected.canonical_request);
  assert.equal(
    await signFinanceCanonicalRequest(keys.issuer_hmac_key, canonical),
    expected.signature,
  );
  assert.equal(
    `v1=${createHmac("sha256", keys.issuer_hmac_key)
      .update(canonical)
      .digest("hex")}`,
    expected.signature,
  );
});

test("Main consumer accepts the exact shared v1 success response", () => {
  const { request, expected } = fixture;
  assert.equal(
    JSON.stringify(expected.success_payload),
    expected.success_body_utf8,
  );
  assert.deepEqual(JSON.parse(expected.success_body_utf8), expected.success_payload);

  const nowMilliseconds = Number(request.timestamp) * 1_000;
  assert.deepEqual(
    validateFinanceSuccess(
      JSON.parse(expected.success_body_utf8),
      request.request_id,
      nowMilliseconds,
    ),
    {
      code: expected.success_payload.code,
      expiresAt: expected.success_payload.expires_at,
      replayed: expected.success_payload.replayed,
      requestId: request.request_id,
    },
  );
});
