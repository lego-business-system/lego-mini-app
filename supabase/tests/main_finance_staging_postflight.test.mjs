import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { planMainFinanceStaging } from "../../scripts/prepare-main-finance-staging.mjs";

const STAGING_REF = "bljeoovhydhjhdzwplxh";
const PRODUCTION_REF = "soxtekhspohkddpdidvp";
const POSTFLIGHT_SHA256 = "9772ec633a2e8b8dd86e1e994020885db7147f3e39b910dbc43ab25f922d972b";
const DEPLOYMENT_SET_SHA256 = "bfce967fc0cfc39c5399b52d8c804287db98f8c510e43e9e040ea4b3a0d35263";

const manifest = JSON.parse(readFileSync(
  "supabase/releases/main-finance-pilot-v1/staging.manifest.json",
  "utf8",
));
const postflight = readFileSync(manifest.postflight.path, "utf8");

test("postflight bytes and target boundary are exact", () => {
  assert.equal(createHash("sha256").update(postflight).digest("hex"), POSTFLIGHT_SHA256);
  assert.equal(manifest.postflight.sha256, POSTFLIGHT_SHA256);
  assert.deepEqual(manifest.allowedStagingProjectRefs, [STAGING_REF]);
  assert.deepEqual(manifest.productionDenyProjectRefs, [PRODUCTION_REF]);
  assert.match(postflight, new RegExp(STAGING_REF));
  assert.match(postflight, new RegExp(PRODUCTION_REF));
  assert.match(postflight, /^BEGIN;\nSET TRANSACTION READ ONLY;$/m);
  assert.match(postflight, /^ROLLBACK;$/m);
});

test("postflight requires exact history, catalog, ACL and data-less state", () => {
  for (const value of [
    "20260714235900",
    "finance_integration_foundation",
    "20260715010000",
    "finance_entitlement_outbox_v1",
    "20260715020000",
    "finance_subject_resolver_v1",
    "remote_schema",
  ]) assert.match(postflight, new RegExp(value));
  assert.match(postflight, /v_count <> 4/);
  assert.match(postflight, /v_count <> 5/);
  assert.match(postflight, /v_count <> 57/);
  assert.match(postflight, /v_count <> 49/);
  assert.match(postflight, /v_count <> 20/);
  assert.match(postflight, /v_count <> 4 THEN[\s\S]*exact trigger count differs/);
  assert.equal((postflight.match(/'architecture_[a-z_]+_internal'/g) || []).length >= 9, true);
  assert.match(postflight, /exact nine-function contract differs/);
  assert.match(postflight, /direct table or column ACL remains/);
  assert.match(postflight, /exact function ACL allow-list differs/);
  assert.match(postflight, /namespace\.nspname = 'public'[\s\S]*relation\.relkind IN \('r', 'p'\)[\s\S]*SELECT EXISTS/);
  assert.match(postflight, /auth\.users is not empty/);
  assert.doesNotMatch(
    postflight,
    /^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/im,
  );
});

test("Edge deployment file set is byte-pinned", () => {
  const source = manifest.edgeDeploymentFiles
    .map(item => {
      const bytes = readFileSync(item.path);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
      return `${item.path}\0${item.sha256}\n`;
    })
    .join("");
  assert.equal(manifest.edgeDeploymentFiles.length, 10);
  assert.equal(createHash("sha256").update(source).digest("hex"), DEPLOYMENT_SET_SHA256);
  assert.equal(manifest.edgeDeploymentSetSha256, DEPLOYMENT_SET_SHA256);
});

test("config/secrets/function commands are an inert exact staging-only plan", () => {
  assert.equal(manifest.edgeDeploymentPlan.implemented, false);
  const commands = manifest.edgeDeploymentPlan.commands;
  assert.equal(commands.length, 4);
  assert.deepEqual(commands.map(command => command.slice(0, 3)), [
    ["supabase", "config", "push"],
    ["supabase", "secrets", "set"],
    ["supabase", "functions", "deploy"],
    ["supabase", "functions", "deploy"],
  ]);
  assert.deepEqual(commands.slice(2).map(command => command[3]), [
    "finance-sync-entitlements",
    "finance-issue-code",
  ]);
  for (const command of commands) {
    assert.equal(command[command.indexOf("--project-ref") + 1], STAGING_REF);
    assert.equal(command.includes(PRODUCTION_REF), false);
    assert.equal(command.includes("--yes"), true);
    assert.equal(command.includes("--prune"), false);
  }
  for (const command of commands.slice(2)) {
    assert.equal(command.includes("--no-verify-jwt"), true);
    assert.equal(command.includes("--use-api"), true);
  }
  const envContract = readFileSync("supabase/functions/.env.example", "utf8");
  assert.equal(
    createHash("sha256").update(envContract).digest("hex"),
    manifest.environmentContractSha256,
  );
  assert.match(envContract, /^MAIN_FINANCE_SYNC_MODE=disabled$/m);
  assert.match(envContract, /^MAIN_FINANCE_PROTOCOL_MODE=disabled$/m);
});

test("plan-only operator exposes hashes and commands without environment or CLI access", () => {
  const result = planMainFinanceStaging(["--project-ref", STAGING_REF], {
    environment: new Proxy({}, {
      get() { throw new Error("plan-only must not read environment"); },
      ownKeys() { throw new Error("plan-only must not enumerate environment"); },
    }),
  });
  assert.equal(result.hosted_write_performed, false);
  assert.equal(result.apply_supported, false);
  assert.equal(result.postflight.sha256, POSTFLIGHT_SHA256);
  assert.equal(result.edge_deployment_set_sha256, DEPLOYMENT_SET_SHA256);
  assert.equal(result.environment_contract_sha256, manifest.environmentContractSha256);
  assert.deepEqual(result.required_server_secrets, manifest.requiredServerSecrets);
  assert.deepEqual(result.future_hosted_commands, manifest.edgeDeploymentPlan.commands);
});
