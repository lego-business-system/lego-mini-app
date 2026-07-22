#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptFile), "..");
const manifestPath = path.join(
  repositoryRoot,
  "supabase/releases/main-finance-pilot-v1/staging.manifest.json",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  throw new Error(`Main Finance staging preparation refused: ${message}`);
}

function parseArguments(argv) {
  if (argv.includes("--help")) return { help: true };
  const result = { prepare: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--prepare") {
      if (result.prepare) fail("duplicate --prepare");
      result.prepare = true;
      continue;
    }
    if (argument === "--apply") {
      fail("--apply is intentionally unsupported; this operator is plan/read-only only");
    }
    if (!["--project-ref", "--workspace", "--supabase-cli"].includes(argument)) {
      fail(`unknown argument ${argument}`);
    }
    if (Object.hasOwn(result, argument.slice(2).replaceAll("-", "_"))) {
      fail(`duplicate ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${argument} requires a value`);
    result[argument.slice(2).replaceAll("-", "_")] = value;
    index += 1;
  }
  if (!result.project_ref) fail("--project-ref is required");
  if (!/^[a-z]{20}$/u.test(result.project_ref)) fail("project ref must be exactly 20 lower-case letters");
  if (result.prepare && (!result.workspace || !result.supabase_cli)) {
    fail("--prepare requires --workspace and --supabase-cli");
  }
  if (!result.prepare && (result.workspace || result.supabase_cli)) {
    fail("--workspace and --supabase-cli require --prepare");
  }
  return result;
}

function readManifest() {
  const source = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(source);
  if (manifest.schemaVersion !== 1 || manifest.environment !== "staging") {
    fail("manifest is not the exact staging v1 contract");
  }
  if (
    !Array.isArray(manifest.productionDenyProjectRefs)
    || manifest.productionDenyProjectRefs.length !== 1
    || manifest.productionDenyProjectRefs[0] !== "soxtekhspohkddpdidvp"
  ) fail("production deny-list differs from the reviewed contract");
  if (
    !Array.isArray(manifest.productionDenyHostnames)
    || manifest.productionDenyHostnames.length !== 1
    || manifest.productionDenyHostnames[0] !== "soxtekhspohkddpdidvp.supabase.co"
  ) fail("production hostname deny-list differs from the reviewed contract");
  if (
    !Array.isArray(manifest.allowedStagingProjectRefs)
    || manifest.allowedStagingProjectRefs.length !== 1
    || manifest.allowedStagingProjectRefs[0] !== "bljeoovhydhjhdzwplxh"
  ) fail("Main staging allow-list differs from the reviewed contract");
  if (manifest.supabaseCliVersion !== "2.109.1") fail("Supabase CLI pin differs");
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length !== 3) {
    fail("manifest must contain exactly three migrations");
  }
  const expectedNames = [
    "20260714235900_finance_integration_foundation.sql",
    "20260715010000_finance_entitlement_outbox_v1.sql",
    "20260715020000_finance_subject_resolver_v1.sql",
  ];
  const actualNames = manifest.migrations.map(item => path.basename(item.path));
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    fail("migration order differs from the reviewed three-file contract");
  }
  const migrationSet = manifest.migrations
    .map(item => `${item.path}\0${item.sha256}\n`)
    .join("");
  if (sha256(migrationSet) !== manifest.migrationSetSha256) {
    fail("migration set fingerprint differs");
  }
  for (const item of manifest.migrations) {
    const absolute = path.resolve(repositoryRoot, item.path);
    if (!absolute.startsWith(`${repositoryRoot}${path.sep}`) || !statSync(absolute).isFile()) {
      fail(`migration path is unsafe: ${item.path}`);
    }
    if (sha256(readFileSync(absolute)) !== item.sha256) {
      fail(`migration bytes differ: ${item.path}`);
    }
  }
  if (
    manifest.postflight?.path !== "supabase/releases/main-finance-pilot-v1/postflight.sql"
    || manifest.postflight.sha256 !== "fcf2e403abc496b397db3427029feb9d64fc730821543731384739d743de6090"
    || manifest.postflight.transactionMode !== "read only"
    || manifest.postflight.expectedMigrationCount !== 4
    || manifest.postflight.expectedPublicDataRows !== 0
    || manifest.postflight.expectedAuthUsers !== 0
  ) fail("hosted staging postflight contract differs");
  const postflightPath = path.join(repositoryRoot, manifest.postflight.path);
  if (sha256(readFileSync(postflightPath)) !== manifest.postflight.sha256) {
    fail("hosted staging postflight bytes differ");
  }
  const expectedDeploymentPaths = [
    "supabase/config.toml",
    "supabase/functions/_shared/main-edge-runtime.ts",
    "supabase/functions/_shared/main-entitlement-protocol.mjs",
    "supabase/functions/_shared/main-finance-protocol.mjs",
    "supabase/functions/finance-sync-entitlements/deno.json",
    "supabase/functions/finance-sync-entitlements/deno.lock",
    "supabase/functions/finance-sync-entitlements/index.ts",
    "supabase/functions/finance-issue-code/deno.json",
    "supabase/functions/finance-issue-code/deno.lock",
    "supabase/functions/finance-issue-code/index.ts",
  ];
  if (
    !Array.isArray(manifest.edgeDeploymentFiles)
    || JSON.stringify(manifest.edgeDeploymentFiles.map(item => item.path))
      !== JSON.stringify(expectedDeploymentPaths)
  ) fail("Edge deployment file allow-list differs");
  const deploymentSet = manifest.edgeDeploymentFiles
    .map(item => `${item.path}\0${item.sha256}\n`)
    .join("");
  if (
    manifest.edgeDeploymentSetSha256
      !== "bfce967fc0cfc39c5399b52d8c804287db98f8c510e43e9e040ea4b3a0d35263"
    || sha256(deploymentSet) !== manifest.edgeDeploymentSetSha256
  ) fail("Edge deployment set fingerprint differs");
  for (const item of manifest.edgeDeploymentFiles) {
    const absolute = path.resolve(repositoryRoot, item.path);
    if (!absolute.startsWith(`${repositoryRoot}${path.sep}`) || !statSync(absolute).isFile()) {
      fail(`Edge deployment path is unsafe: ${item.path}`);
    }
    if (sha256(readFileSync(absolute)) !== item.sha256) {
      fail(`Edge deployment bytes differ: ${item.path}`);
    }
  }
  if (
    !Array.isArray(manifest.edgeFunctions)
    || JSON.stringify(manifest.edgeFunctions.map(item => item.name))
      !== JSON.stringify(["finance-sync-entitlements", "finance-issue-code"])
    || manifest.edgeFunctions.some(item => item.verifyJwt !== false)
  ) fail("Edge Function allow-list differs");
  const expectedSecrets = [
    "TELEGRAM_BOT_TOKEN",
    "MAIN_FINANCE_PRIVACY_HMAC_KEY",
    "MAIN_FINANCE_NONCE_DERIVATION_KEY",
    "MAIN_FINANCE_ISSUER_HMAC_SECRET",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
    "MAIN_FINANCE_ENTITLEMENT_HMAC_SECRET",
  ];
  if (
    manifest.functionConfigPath !== "supabase/config.toml"
    || manifest.environmentContractPath !== "supabase/functions/.env.example"
    || manifest.environmentContractSha256
      !== "8f799eedd3d9802236b02d60a6ce00ef41da42c0e94d36e97100b3f647c9ba83"
    || sha256(readFileSync(path.join(repositoryRoot, manifest.environmentContractPath)))
      !== manifest.environmentContractSha256
    || JSON.stringify(manifest.requiredServerSecrets) !== JSON.stringify(expectedSecrets)
  ) fail("Edge environment and secret-name contract differs");
  if (manifest.apply?.implemented !== false) fail("manifest must keep apply unimplemented");
  const expectedCommands = [
    ["supabase", "config", "push", "--project-ref", "bljeoovhydhjhdzwplxh", "--workdir", "<ATTESTED_DEPLOY_WORKDIR>", "--yes"],
    ["supabase", "secrets", "set", "--project-ref", "bljeoovhydhjhdzwplxh", "--env-file", "<EXTERNAL_REVIEWED_ENV_FILE>", "--workdir", "<ATTESTED_DEPLOY_WORKDIR>", "--yes"],
    ["supabase", "functions", "deploy", "finance-sync-entitlements", "--project-ref", "bljeoovhydhjhdzwplxh", "--no-verify-jwt", "--use-api", "--workdir", "<ATTESTED_DEPLOY_WORKDIR>", "--yes"],
    ["supabase", "functions", "deploy", "finance-issue-code", "--project-ref", "bljeoovhydhjhdzwplxh", "--no-verify-jwt", "--use-api", "--workdir", "<ATTESTED_DEPLOY_WORKDIR>", "--yes"],
  ];
  if (
    manifest.edgeDeploymentPlan?.implemented !== false
    || JSON.stringify(manifest.edgeDeploymentPlan.commands) !== JSON.stringify(expectedCommands)
  ) fail("plan-only Edge command allow-list differs");
  return { manifest, source, sha256: sha256(source), expectedNames };
}

function assertStagingRef(projectRef, manifest) {
  if (manifest.productionDenyProjectRefs.includes(projectRef)) {
    fail("target is the exact Main production project ref");
  }
  if (!manifest.allowedStagingProjectRefs.includes(projectRef)) {
    fail("target is not the exact reviewed data-less Main staging project ref");
  }
}

function assertDisposableWorkspace(workspace) {
  if (!path.isAbsolute(workspace) || workspace !== workspace.trim()) {
    fail("workspace must be one absolute path");
  }
  const requested = path.resolve(workspace);
  const root = realpathSync(repositoryRoot);
  if (requested === root || requested.startsWith(`${root}${path.sep}`)) {
    fail("workspace must be outside the repository");
  }
  if (existsSync(requested)) fail("workspace must not already exist");
  const parent = path.dirname(requested);
  const parentStatus = lstatSync(parent);
  if (!parentStatus.isDirectory() || parentStatus.isSymbolicLink()) {
    fail("workspace parent must be a real directory");
  }
  const realParent = realpathSync(parent);
  const projected = path.join(realParent, path.basename(requested));
  if (projected === root || projected.startsWith(`${root}${path.sep}`)) {
    fail("workspace resolves inside the repository");
  }
  mkdirSync(projected, { mode: 0o700 });
  return projected;
}

function assertCli(cliPath) {
  if (!path.isAbsolute(cliPath) || cliPath !== cliPath.trim()) {
    fail("Supabase CLI path must be absolute");
  }
  const status = lstatSync(cliPath);
  if (!status.isFile() || status.isSymbolicLink() || (status.mode & 0o111) === 0) {
    fail("Supabase CLI must be an executable regular non-symlink file");
  }
  return realpathSync(cliPath);
}

function scrubCliEnvironment(environment) {
  const scrubbed = {};
  for (const [name, value] of Object.entries(environment)) {
    const isTargetOverride = (
      name !== "SUPABASE_ACCESS_TOKEN"
      && (
        name.startsWith("SUPABASE_")
        || name.startsWith("PG")
        || name.startsWith("POSTGRES")
        || name.startsWith("DATABASE_")
        || name === "DATABASE_URL"
        || name.startsWith("DB_")
      )
    );
    if (!isTargetOverride) scrubbed[name] = value;
  }
  return scrubbed;
}

function runCli(cli, args, environment = process.env) {
  const result = spawnSync(cli, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) fail("Supabase CLI could not start; process error withheld");
  if (result.status !== 0) {
    fail("Supabase CLI read-only command failed; stdout and stderr withheld");
  }
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  return {
    stdout,
    stderr,
    combined: [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n"),
  };
}

function metadataFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    const status = lstatSync(item);
    if (status.isSymbolicLink()) fail("disposable Supabase metadata contains a symlink");
    if (status.isDirectory()) files.push(...metadataFiles(item));
    else if (status.isFile()) files.push(item);
    else fail("disposable Supabase metadata contains a non-regular entry");
  }
  return files;
}

function assertDisposableLinkMetadata(workdir, manifest) {
  const directory = path.join(workdir, "supabase/.temp");
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) {
    fail("disposable Supabase .temp metadata is missing");
  }
  const files = metadataFiles(directory);
  if (files.length === 0) fail("disposable Supabase .temp metadata is empty");
  const denied = [
    ...manifest.productionDenyProjectRefs,
    ...manifest.productionDenyHostnames,
  ].map(value => Buffer.from(value, "utf8"));
  let exactProjectRefFound = false;
  for (const file of files) {
    const status = lstatSync(file);
    if (status.size > 1024 * 1024) fail("disposable Supabase metadata file is unexpectedly large");
    const bytes = readFileSync(file);
    if (denied.some(value => bytes.includes(value))) {
      fail("disposable Supabase metadata resolves to the forbidden production target");
    }
    const relative = path.relative(directory, file);
    if (relative === "linked-project.json") {
      let linkedProject;
      try {
        linkedProject = JSON.parse(bytes.toString("utf8"));
      } catch {
        fail("linked-project.json is not valid JSON");
      }
      if (
        linkedProject === null
        || typeof linkedProject !== "object"
        || Array.isArray(linkedProject)
        || linkedProject.ref !== manifest.allowedStagingProjectRefs[0]
      ) fail("linked-project.json does not contain the exact reviewed staging ref");
      exactProjectRefFound = true;
    }
    if (relative === "project-ref") {
      if (bytes.toString("utf8").trim() !== manifest.allowedStagingProjectRefs[0]) {
        fail("project-ref does not contain the exact reviewed staging ref");
      }
      exactProjectRefFound = true;
    }
  }
  if (!exactProjectRefFound) {
    fail("disposable Supabase metadata does not prove the exact reviewed staging ref");
  }
}

function createWorkdir(directory) {
  mkdirSync(path.join(directory, "supabase/migrations"), { recursive: true, mode: 0o700 });
  copyFileSync(path.join(repositoryRoot, "supabase/config.toml"), path.join(directory, "supabase/config.toml"));
}

function copyReleaseSources(deployDirectory, manifest) {
  for (const item of manifest.migrations) {
    const destination = path.join(deployDirectory, item.path);
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    copyFileSync(path.join(repositoryRoot, item.path), destination);
  }
  for (const item of manifest.edgeDeploymentFiles) {
    const destination = path.join(deployDirectory, item.path);
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    copyFileSync(path.join(repositoryRoot, item.path), destination);
  }
  const postflightDestination = path.join(deployDirectory, manifest.postflight.path);
  mkdirSync(path.dirname(postflightDestination), { recursive: true, mode: 0o700 });
  copyFileSync(path.join(repositoryRoot, manifest.postflight.path), postflightDestination);
}

function exactRemoteBaseline(fetchDirectory, manifest) {
  const directory = path.join(fetchDirectory, "supabase/migrations");
  const files = readdirSync(directory).filter(name => !name.startsWith("."));
  const pattern = new RegExp(manifest.remoteBaseline.filenamePattern, "u");
  if (files.length !== manifest.remoteBaseline.exactFileCount || !pattern.test(files[0] || "")) {
    fail("migration fetch must return exactly one timestamped remote_schema baseline");
  }
  const source = path.join(directory, files[0]);
  const status = lstatSync(source);
  if (!status.isFile() || status.isSymbolicLink() || status.size === 0 || status.size > 64 * 1024 * 1024) {
    fail("fetched remote_schema must be a bounded regular file");
  }
  return { name: files[0], path: source, sha256: sha256(readFileSync(source)) };
}

function validateMigrationList(output, baselineName, expectedNames) {
  const versions = [baselineName, ...expectedNames].map(name => name.slice(0, 14));
  const tokens = [...output.matchAll(/\b[0-9]{14}\b/gu)].map(match => match[0]);
  const unexpected = tokens.filter(version => !versions.includes(version));
  if (unexpected.length) fail(`migration list contains unexpected version ${unexpected[0]}`);
  if (tokens.filter(value => value === versions[0]).length !== 2) {
    fail("remote_schema must appear as both local and remote");
  }
  for (const version of versions.slice(1)) {
    if (tokens.filter(value => value === version).length !== 1) {
      fail(`pilot migration ${version} must appear exactly once as local-only`);
    }
  }
}

function validateDryRun(output, expectedNames) {
  const offered = [...output.matchAll(/\b[0-9]{14}_[A-Za-z0-9][A-Za-z0-9_-]*\.sql\b/gu)]
    .map(match => match[0]);
  if (JSON.stringify(offered) !== JSON.stringify(expectedNames)) {
    fail(`dry-run order must be exactly: ${expectedNames.join(", ")}`);
  }
}

export function planMainFinanceStaging(argv, { environment = process.env } = {}) {
  const input = parseArguments(argv);
  if (input.help) {
    return {
      ok: true,
      mode: "help",
      usage: "prepare-main-finance-staging.mjs --project-ref <20 letters> [--prepare --workspace <new absolute path> --supabase-cli <absolute executable>]",
    };
  }
  const reviewed = readManifest();
  assertStagingRef(input.project_ref, reviewed.manifest);
  const plan = {
    ok: true,
    mode: input.prepare ? "prepared_read_only" : "plan_only",
    environment: "staging",
    project_ref: input.project_ref,
    production_ref_denied: reviewed.manifest.productionDenyProjectRefs[0],
    manifest_sha256: reviewed.sha256,
    migration_set_sha256: reviewed.manifest.migrationSetSha256,
    migration_order: reviewed.expectedNames,
    edge_functions: reviewed.manifest.edgeFunctions.map(item => ({
      name: item.name,
      verify_jwt: item.verifyJwt,
      initial_gate: item.initialGate,
    })),
    postflight: {
      path: reviewed.manifest.postflight.path,
      sha256: reviewed.manifest.postflight.sha256,
      transaction_mode: reviewed.manifest.postflight.transactionMode,
    },
    edge_deployment_set_sha256: reviewed.manifest.edgeDeploymentSetSha256,
    environment_contract_sha256: reviewed.manifest.environmentContractSha256,
    required_server_secrets: reviewed.manifest.requiredServerSecrets,
    future_hosted_commands: reviewed.manifest.edgeDeploymentPlan.commands,
    apply_supported: false,
    hosted_write_performed: false,
  };
  if (!input.prepare) return plan;

  const cli = assertCli(input.supabase_cli);
  const workspace = assertDisposableWorkspace(input.workspace);
  const cliEnvironment = scrubCliEnvironment(environment);
  const version = runCli(cli, ["--version"], cliEnvironment).stdout.trim();
  if (version !== reviewed.manifest.supabaseCliVersion) {
    fail(`Supabase CLI must be exactly ${reviewed.manifest.supabaseCliVersion}`);
  }

  const fetchDirectory = path.join(workspace, "fetch");
  const deployDirectory = path.join(workspace, "deploy");
  mkdirSync(fetchDirectory, { mode: 0o700 });
  mkdirSync(deployDirectory, { mode: 0o700 });
  createWorkdir(fetchDirectory);
  runCli(cli, ["link", "--project-ref", input.project_ref, "--workdir", fetchDirectory], cliEnvironment);
  assertDisposableLinkMetadata(fetchDirectory, reviewed.manifest);
  runCli(cli, ["migration", "fetch", "--linked", "--workdir", fetchDirectory], cliEnvironment);
  assertDisposableLinkMetadata(fetchDirectory, reviewed.manifest);
  const baseline = exactRemoteBaseline(fetchDirectory, reviewed.manifest);

  createWorkdir(deployDirectory);
  copyReleaseSources(deployDirectory, reviewed.manifest);
  copyFileSync(baseline.path, path.join(deployDirectory, "supabase/migrations", baseline.name));
  runCli(cli, ["link", "--project-ref", input.project_ref, "--workdir", deployDirectory], cliEnvironment);
  assertDisposableLinkMetadata(deployDirectory, reviewed.manifest);
  const migrationList = runCli(
    cli,
    ["migration", "list", "--linked", "--workdir", deployDirectory],
    cliEnvironment,
  ).combined;
  assertDisposableLinkMetadata(deployDirectory, reviewed.manifest);
  validateMigrationList(migrationList, baseline.name, reviewed.expectedNames);
  const dryRun = runCli(
    cli,
    ["db", "push", "--linked", "--include-all", "--dry-run", "--yes", "--workdir", deployDirectory],
    cliEnvironment,
  ).combined;
  assertDisposableLinkMetadata(deployDirectory, reviewed.manifest);
  validateDryRun(dryRun, reviewed.expectedNames);

  const attestation = {
    schemaVersion: 1,
    environment: "staging",
    projectRef: input.project_ref,
    productionRefDenied: reviewed.manifest.productionDenyProjectRefs[0],
    manifestSha256: reviewed.sha256,
    migrationSetSha256: reviewed.manifest.migrationSetSha256,
    postflightSha256: reviewed.manifest.postflight.sha256,
    edgeDeploymentSetSha256: reviewed.manifest.edgeDeploymentSetSha256,
    remoteBaseline: { name: baseline.name, sha256: baseline.sha256, execute: false },
    migrationListSha256: sha256(migrationList),
    dryRunSha256: sha256(dryRun),
    exactDryRunOrder: reviewed.expectedNames,
    hostedWritePerformed: false,
    applySupported: false,
  };
  const attestationSource = `${JSON.stringify(attestation, null, 2)}\n`;
  const attestationPath = path.join(workspace, "main-finance-staging-preflight.json");
  writeFileSync(attestationPath, attestationSource, { mode: 0o600, flag: "wx" });
  chmodSync(attestationPath, 0o600);
  return {
    ...plan,
    workspace,
    remote_baseline: attestation.remoteBaseline,
    dry_run_sha256: attestation.dryRunSha256,
    attestation_path: attestationPath,
    attestation_sha256: sha256(attestationSource),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptFile) {
  try {
    process.stdout.write(`${JSON.stringify(planMainFinanceStaging(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
