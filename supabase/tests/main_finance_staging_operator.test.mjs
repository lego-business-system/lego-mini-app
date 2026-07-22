import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { planMainFinanceStaging } from "../../scripts/prepare-main-finance-staging.mjs";

const PRODUCTION_REF = "soxtekhspohkddpdidvp";
const STAGING_REF = "bljeoovhydhjhdzwplxh";
const MIGRATIONS = [
  "20260714235900_finance_integration_foundation.sql",
  "20260715010000_finance_entitlement_outbox_v1.sql",
  "20260715020000_finance_subject_resolver_v1.sql",
];

function temporaryDirectory(t, prefix) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fakeCli(t, scenario = "ok") {
  const directory = temporaryDirectory(t, "main-staging-fake-cli-");
  const cli = path.join(directory, "supabase-fake.mjs");
  const log = path.join(directory, "calls.jsonl");
  writeFileSync(cli, `#!${process.execPath}
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const targetEnvironment = Object.keys(process.env).filter(name =>
  name !== "SUPABASE_ACCESS_TOKEN" && (
    name.startsWith("SUPABASE_") || name.startsWith("PG") ||
    name.startsWith("POSTGRES") || name.startsWith("DATABASE_") ||
    name === "DATABASE_URL" || name.startsWith("DB_")
  )
).sort();
appendFileSync(process.env.FAKE_SUPABASE_LOG, JSON.stringify({
  args,
  targetEnvironment,
  accessTokenPreserved: process.env.SUPABASE_ACCESS_TOKEN === "fixture-access-token"
}) + "\\n");
const scenario = process.env.FAKE_SUPABASE_SCENARIO || "ok";
const option = name => args[args.indexOf(name) + 1];
if (args[0] === "--version") {
  process.stdout.write(scenario === "wrong-version" ? "2.108.0\\n" : "2.109.1\\n");
} else if (args[0] === "link") {
  const directory = path.join(option("--workdir"), "supabase/.temp");
  mkdirSync(directory, { recursive: true });
  const ref = scenario === "production-link" ? ${JSON.stringify(PRODUCTION_REF)} : option("--project-ref");
  writeFileSync(path.join(directory, "linked-project.json"), JSON.stringify({ ref }));
  if (scenario === "production-host-file") {
    writeFileSync(path.join(directory, "pooler-url"), "postgresql://${PRODUCTION_REF}.supabase.co/database");
  }
  process.stdout.write("linked local workdir\\n");
} else if (args[0] === "migration" && args[1] === "fetch") {
  if (scenario === "cli-error") {
    process.stderr.write("postgresql://user:password@${PRODUCTION_REF}.supabase.co/database?token=secret\\n");
    process.exit(71);
  }
  const directory = path.join(option("--workdir"), "supabase/migrations");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "20260722120000_remote_schema.sql"), "-- fetched baseline only\\n");
  if (scenario === "production-after-fetch") {
    writeFileSync(path.join(option("--workdir"), "supabase/.temp/pooler-url"), "${PRODUCTION_REF}.supabase.co");
  }
  if (scenario === "extra-fetch") {
    writeFileSync(path.join(directory, "20260722120100_unexpected.sql"), "-- forbidden\\n");
  }
} else if (args[0] === "migration" && args[1] === "list") {
  if (scenario === "production-after-list") {
    writeFileSync(path.join(option("--workdir"), "supabase/.temp/pooler-url"), "${PRODUCTION_REF}.supabase.co");
  }
  process.stdout.write([
    "LOCAL          | REMOTE         | TIME",
    "20260714235900 |                | 2026-07-14",
    "20260715010000 |                | 2026-07-15",
    "20260715020000 |                | 2026-07-15",
    "20260722120000 | 20260722120000 | 2026-07-22",
  ].join("\\n") + "\\n");
} else if (args[0] === "db" && args[1] === "push" && args.includes("--dry-run")) {
  if (scenario === "production-after-dry-run") {
    writeFileSync(path.join(option("--workdir"), "supabase/.temp/pooler-url"), "${PRODUCTION_REF}.supabase.co");
  }
  const migrations = ${JSON.stringify(MIGRATIONS)};
  if (scenario === "wrong-order") migrations.reverse();
  if (scenario === "extra-dry-run") migrations.push("20260722130000_forbidden.sql");
  process.stdout.write("Would push these migrations:\\n" + migrations.map(name => " • " + name).join("\\n") + "\\n");
} else {
  process.stderr.write("fake CLI refused a write or unknown command\\n");
  process.exitCode = 70;
}
`, { mode: 0o700 });
  chmodSync(cli, 0o700);
  return {
    cli,
    log,
    environment: {
      ...process.env,
      FAKE_SUPABASE_LOG: log,
      FAKE_SUPABASE_SCENARIO: scenario,
      SUPABASE_ACCESS_TOKEN: "fixture-access-token",
      SUPABASE_DB_URL: "postgresql://production.example/forbidden",
      SUPABASE_PROJECT_REF: PRODUCTION_REF,
      SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      PGHOST: "production-db.example",
      PGPORT: "5432",
      PGDATABASE: "production",
      PGUSER: "production",
      PGPASSWORD: "must-not-reach-cli",
      POSTGRES_URL: "postgresql://production.example/forbidden",
      DATABASE_URL: "postgresql://production.example/forbidden",
      DB_URL: "postgresql://production.example/forbidden",
    },
  };
}

function entries(fixture) {
  if (!existsSync(fixture.log)) return [];
  return readFileSync(fixture.log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

function calls(fixture) {
  return entries(fixture).map(entry => entry.args);
}

test("default is a local plan with the exact three-file and two-function boundary", () => {
  assert.match(readFileSync(".gitignore", "utf8"), /^supabase\/\.temp\/$/m);
  const result = planMainFinanceStaging(["--project-ref", STAGING_REF], {
    environment: new Proxy({}, {
      get() { throw new Error("plan-only must not read environment"); },
    }),
  });
  assert.equal(result.mode, "plan_only");
  assert.equal(result.hosted_write_performed, false);
  assert.equal(result.apply_supported, false);
  assert.deepEqual(result.migration_order, MIGRATIONS);
  assert.deepEqual(result.edge_functions.map(item => item.name), [
    "finance-sync-entitlements",
    "finance-issue-code",
  ]);
  assert.equal(result.production_ref_denied, PRODUCTION_REF);
});

test("the exact Main production ref and every apply request are rejected locally", () => {
  assert.throws(
    () => planMainFinanceStaging(["--project-ref", PRODUCTION_REF]),
    /exact Main production project ref/,
  );
  assert.throws(
    () => planMainFinanceStaging(["--apply", "--project-ref", STAGING_REF]),
    /apply is intentionally unsupported/,
  );
  assert.throws(
    () => planMainFinanceStaging(["--project-ref", "abcdefghijklmnopqrst"]),
    /not the exact reviewed data-less Main staging project ref/,
  );
});

test("read-only preparation fetches remote_schema only in disposable workdirs and proves exact order", t => {
  const fixture = fakeCli(t);
  const parent = temporaryDirectory(t, "main-staging-workspace-parent-");
  const workspace = path.join(parent, "new-workspace");
  const result = planMainFinanceStaging([
    "--project-ref", STAGING_REF,
    "--prepare",
    "--workspace", workspace,
    "--supabase-cli", fixture.cli,
  ], { environment: fixture.environment });

  assert.equal(result.mode, "prepared_read_only");
  assert.equal(result.hosted_write_performed, false);
  assert.equal(result.remote_baseline.name, "20260722120000_remote_schema.sql");
  assert.equal(result.remote_baseline.execute, false);
  assert.equal(existsSync(result.attestation_path), true);
  const attestation = JSON.parse(readFileSync(result.attestation_path, "utf8"));
  assert.deepEqual(attestation.exactDryRunOrder, MIGRATIONS);
  assert.equal(attestation.hostedWritePerformed, false);
  assert.equal(attestation.applySupported, false);
  const manifest = JSON.parse(readFileSync(
    "supabase/releases/main-finance-pilot-v1/staging.manifest.json",
    "utf8",
  ));
  for (const item of manifest.edgeDeploymentFiles) {
    assert.equal(existsSync(path.join(result.workspace, "deploy", item.path)), true);
  }
  assert.equal(existsSync(path.join(
    result.workspace,
    "deploy/supabase/functions/.env.example",
  )), false);
  assert.equal(existsSync(path.join(
    result.workspace,
    "deploy/supabase/releases/main-finance-pilot-v1/postflight.sql",
  )), true);

  const invoked = calls(fixture);
  assert.deepEqual(invoked.map(args => args.slice(0, 2)), [
    ["--version"],
    ["link", "--project-ref"],
    ["migration", "fetch"],
    ["link", "--project-ref"],
    ["migration", "list"],
    ["db", "push"],
  ]);
  assert.equal(invoked.some(args => args[0] === "secrets" || args[0] === "functions"), false);
  const pushes = invoked.filter(args => args[0] === "db" && args[1] === "push");
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].includes("--dry-run"), true);
  for (const args of invoked.filter(args => args.includes("--workdir"))) {
    const workdir = args[args.indexOf("--workdir") + 1];
    assert.equal(workdir.startsWith(`${result.workspace}${path.sep}`), true);
  }
  assert.notEqual(
    invoked[1][invoked[1].indexOf("--workdir") + 1],
    invoked[3][invoked[3].indexOf("--workdir") + 1],
  );
  for (const entry of entries(fixture)) {
    assert.deepEqual(entry.targetEnvironment, []);
    assert.equal(entry.accessTokenPreserved, true);
  }
});

test("production metadata from a compromised link stops before fetch and db push", t => {
  for (const scenario of ["production-link", "production-host-file"]) {
    const fixture = fakeCli(t, scenario);
    const workspace = path.join(temporaryDirectory(t, `main-staging-${scenario}-`), "workspace");
    assert.throws(() => planMainFinanceStaging([
      "--project-ref", STAGING_REF,
      "--prepare", "--workspace", workspace,
      "--supabase-cli", fixture.cli,
    ], { environment: fixture.environment }), /forbidden production target/);
    const invoked = calls(fixture);
    assert.deepEqual(invoked.map(args => args[0]), ["--version", "link"]);
    assert.equal(invoked.some(args => args[0] === "migration" || args[0] === "db"), false);
  }
});

test("CLI failure with credentials and production URL withholds all external output", t => {
  const fixture = fakeCli(t, "cli-error");
  const workspace = path.join(temporaryDirectory(t, "main-staging-cli-error-"), "workspace");
  assert.throws(() => planMainFinanceStaging([
    "--project-ref", STAGING_REF,
    "--prepare", "--workspace", workspace,
    "--supabase-cli", fixture.cli,
  ], { environment: fixture.environment }), error => {
    assert.match(error.message, /stdout and stderr withheld/);
    assert.doesNotMatch(error.message, /password|token|postgresql|supabase\.co|soxtekhspohkddpdidvp/i);
    return true;
  });
  assert.equal(calls(fixture).some(args => args[0] === "db"), false);
});

test("metadata target is revalidated after fetch, list and dry-run", t => {
  const scenarios = [
    ["production-after-fetch", ["--version", "link", "migration"]],
    ["production-after-list", ["--version", "link", "migration", "link", "migration"]],
    ["production-after-dry-run", ["--version", "link", "migration", "link", "migration", "db"]],
  ];
  for (const [scenario, expectedCommands] of scenarios) {
    const fixture = fakeCli(t, scenario);
    const workspace = path.join(temporaryDirectory(t, `main-staging-${scenario}-`), "workspace");
    assert.throws(() => planMainFinanceStaging([
      "--project-ref", STAGING_REF,
      "--prepare", "--workspace", workspace,
      "--supabase-cli", fixture.cli,
    ], { environment: fixture.environment }), /forbidden production target/);
    assert.deepEqual(calls(fixture).map(args => args[0]), expectedCommands);
  }
});

test("preparation rejects a fetched history with anything besides one remote_schema", t => {
  const fixture = fakeCli(t, "extra-fetch");
  const workspace = path.join(temporaryDirectory(t, "main-staging-extra-parent-"), "workspace");
  assert.throws(() => planMainFinanceStaging([
    "--project-ref", STAGING_REF,
    "--prepare", "--workspace", workspace,
    "--supabase-cli", fixture.cli,
  ], { environment: fixture.environment }), /exactly one timestamped remote_schema/);
  assert.equal(calls(fixture).some(args => args[0] === "db"), false);
});

test("preparation rejects an out-of-order or expanded dry-run", t => {
  for (const scenario of ["wrong-order", "extra-dry-run"]) {
    const fixture = fakeCli(t, scenario);
    const workspace = path.join(temporaryDirectory(t, `main-staging-${scenario}-`), "workspace");
    assert.throws(() => planMainFinanceStaging([
      "--project-ref", STAGING_REF,
      "--prepare", "--workspace", workspace,
      "--supabase-cli", fixture.cli,
    ], { environment: fixture.environment }), /dry-run order must be exactly/);
  }
});

test("preparation requires the pinned CLI and a new external workspace", t => {
  const wrongCli = fakeCli(t, "wrong-version");
  const workspace = path.join(temporaryDirectory(t, "main-staging-version-parent-"), "workspace");
  assert.throws(() => planMainFinanceStaging([
    "--project-ref", STAGING_REF,
    "--prepare", "--workspace", workspace,
    "--supabase-cli", wrongCli.cli,
  ], { environment: wrongCli.environment }), /must be exactly 2\.109\.1/);

  const goodCli = fakeCli(t);
  const existing = temporaryDirectory(t, "main-staging-existing-");
  assert.throws(() => planMainFinanceStaging([
    "--project-ref", STAGING_REF,
    "--prepare", "--workspace", existing,
    "--supabase-cli", goodCli.cli,
  ], { environment: goodCli.environment }), /must not already exist/);
  assert.deepEqual(calls(goodCli), []);
});
