import {
  jsonResponse,
  readJsonRequestBytes,
  RequestRejected,
  serviceClient,
} from "../_shared/main-edge-runtime.ts";
import {
  constantTimeHexEqual,
  derivePrivateDigest,
  hmacSha256Hex,
  matchesSupabaseFunctionRoute,
  sha256Hex,
} from "../_shared/main-finance-protocol.mjs";

const INCOMING_PATH = "/functions/v1/finance-manage-access-v2";
const MAIN_PROJECT_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_PROJECT_REF = "makgsbjduobcphuqzaoq";
const MAIN_ORIGIN = `https://${MAIN_PROJECT_REF}.supabase.co`;
const PRODUCTION_DENY_REFS = Object.freeze([
  "soxtekhspohkddpdidvp",
  "koibxwgtihwajocxfetb",
]);
const OPERATOR_HEADER = "x-architecture-finance-operator-v2";
const OPERATOR_TIMESTAMP_HEADER = "x-architecture-finance-timestamp-v2";
const PRODUCT_CODE = "architecture_finance";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]{0,18})$/u;
const ACTOR = /^[a-z][a-z0-9_.:-]{2,127}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const MAXIMUM_BODY_BYTES = 256 * 1024;
const SNAPSHOT_MAXIMUM_AGE_MS = 5 * 60 * 1_000;
const SNAPSHOT_MAXIMUM_FUTURE_SKEW_MS = 30 * 1_000;
const PROOF_MAXIMUM_AGE_SECONDS = 5 * 60;
const MUTATION_PLAN_KEYS = Object.freeze([
  "schema_version",
  "action",
  "main_project_ref",
  "finance_project_ref",
  "source_deployment_sha256",
  "pre_database_clock",
  "pre_response_sha256",
  "descriptor_sha256",
  "catalog_sha256",
  "gate_inventory_sha256",
  "privacy_secret_inventory_sha256",
  "main_source_commit_sha",
  "main_source_tree_sha",
  "source_manifest_sha256",
  "state_sha256",
  "checked_count",
  "event_id",
  "main_user_id",
  "current_event_id",
  "expected_version",
  "changed_by",
  "dispatch",
  "attestation_proof",
  "approval_expires_at",
  "post_database_clock",
  "post_response_sha256",
  "post_snapshot_sha256",
]);

type RpcDependency = (
  name: string,
  body: Record<string, unknown>,
) => Promise<unknown>;

export type FinanceManageAccessV2Dependencies = Readonly<{
  env?: (name: string) => string | undefined;
  rpc?: RpcDependency;
  dispatch?: (eventId: string, triggerSecret: string) => Promise<unknown>;
  now?: () => number;
}>;

type SnapshotRow = Readonly<{
  main_user_id: string;
  event_id: string;
  desired_state: "granted" | "revoked";
  version: string;
  applied_state: "granted" | "revoked" | null;
  applied_version: string;
  event_state: "pending" | "processing" | "retry_wait" | "applied" | "dead_letter";
  changed_by: string;
  change_reason: string;
}>;

type ValidatedSnapshot = Readonly<{
  schema_version: 2;
  main_source_commit_sha: string;
  main_source_tree_sha: string;
  source_manifest_sha256: string;
  database_clock: string;
  sql_sha256: string;
  response_sha256: string;
  descriptor_sha256: string;
  state_sha256: string;
  catalog_sha256: string;
  gate_inventory_sha256: string;
  privacy_secret_inventory_sha256: string;
  checked_count: number;
  rows: readonly SnapshotRow[];
}>;

type AccessStatus = Readonly<{
  main_user_id: string;
  current_version: string;
  desired_state: "granted" | "revoked" | null;
  applied_version: string;
  applied_state: "granted" | "revoked" | null;
  event: null | Readonly<{
    event_id: string;
    version: string;
    desired_state: "granted" | "revoked";
    state: "pending" | "processing" | "retry_wait" | "applied" | "dead_letter";
  }>;
}>;

class ConfigurationFailure extends Error {}
class AttestationFailure extends Error {}
class AttestationOutcomeUnknown extends Error {}
class MutationOutcomeUnknown extends Error {}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => keys.includes(key));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
  ).join(",")}}`;
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function envValue(
  dependencies: FinanceManageAccessV2Dependencies,
  name: string,
): string {
  const value = dependencies.env ? dependencies.env(name) : Deno.env.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigurationFailure("required configuration is unavailable");
  }
  return value;
}

function secret(
  dependencies: FinanceManageAccessV2Dependencies,
  name: string,
): string {
  const value = envValue(dependencies, name);
  if (new TextEncoder().encode(value).byteLength < 32 || /[\u0000-\u001f\u007f\s]/u.test(value)) {
    throw new ConfigurationFailure("runtime secret contract differs");
  }
  return value;
}

function assertCompiledBoundary(
  input: Record<string, unknown>,
  dependencies: FinanceManageAccessV2Dependencies,
): void {
  if (
    input.main_project_ref !== MAIN_PROJECT_REF ||
    input.finance_project_ref !== FINANCE_PROJECT_REF ||
    canonicalJson(input.production_deny_project_refs) !== canonicalJson(PRODUCTION_DENY_REFS) ||
    PRODUCTION_DENY_REFS.includes(input.main_project_ref as string) ||
    PRODUCTION_DENY_REFS.includes(input.finance_project_ref as string)
  ) throw new RequestRejected("target boundary differs");

  // This non-secret origin check deliberately precedes every secret read and RPC.
  const configuredOrigin = envValue(dependencies, "SUPABASE_URL").replace(/\/$/u, "");
  if (configuredOrigin !== MAIN_ORIGIN) {
    throw new ConfigurationFailure("runtime target is not exact Main staging");
  }
  if (envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_MODE") !== "enabled") {
    throw new ConfigurationFailure("operator boundary is disabled");
  }
  if (
    !SHA256.test(input.source_deployment_sha256 as string) ||
    input.source_deployment_sha256 !==
      envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256")
  ) throw new ConfigurationFailure("source deployment hash differs");
}

async function parseCanonicalBody(request: Request): Promise<Record<string, unknown>> {
  const bytes = await readJsonRequestBytes(request, MAXIMUM_BODY_BYTES, 3_000);
  let source: string;
  let parsed: unknown;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(source);
  } catch {
    throw new RequestRejected("request body is not UTF-8 JSON");
  }
  if (!exactObject(parsed, [
    "schema_version",
    "action",
    "main_project_ref",
    "finance_project_ref",
    "production_deny_project_refs",
    "source_deployment_sha256",
    "snapshot",
    "command",
  ]) || source !== canonicalJson(parsed)) {
    throw new RequestRejected("request body is not canonical");
  }
  if (
    parsed.schema_version !== 2 ||
    !["attest", "status", "grant", "revoke", "reconcile"].includes(parsed.action as string)
  ) throw new RequestRejected("request schema differs");
  return parsed;
}

function validateRow(value: unknown): SnapshotRow {
  if (!exactObject(value, [
    "main_user_id",
    "event_id",
    "desired_state",
    "version",
    "applied_state",
    "applied_version",
    "event_state",
    "changed_by",
    "change_reason",
  ])) throw new AttestationFailure("snapshot row schema differs");
  if (
    !UUID_V4.test(value.main_user_id as string) ||
    !UUID_V4.test(value.event_id as string) ||
    !["granted", "revoked"].includes(value.desired_state as string) ||
    !DECIMAL.test(value.version as string) ||
    value.version === "0" ||
    ![null, "granted", "revoked"].includes(value.applied_state as string | null) ||
    !DECIMAL.test(value.applied_version as string) ||
    BigInt(value.applied_version as string) > BigInt(value.version as string) ||
    (value.applied_version === "0") !== (value.applied_state === null) ||
    !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(
      value.event_state as string,
    ) ||
    !ACTOR.test(value.changed_by as string) ||
    typeof value.change_reason !== "string" ||
    value.change_reason !== value.change_reason.trim() ||
    value.change_reason.length < 1 ||
    value.change_reason.length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(value.change_reason)
  ) throw new AttestationFailure("snapshot row invariant differs");
  return Object.freeze(value as unknown as SnapshotRow);
}

async function validateSnapshot(
  value: unknown,
  dependencies: FinanceManageAccessV2Dependencies,
): Promise<ValidatedSnapshot> {
  if (!exactObject(value, [
    "schema_version",
    "main_source_commit_sha",
    "main_source_tree_sha",
    "source_manifest_sha256",
    "database_clock",
    "sql_sha256",
    "response_sha256",
    "descriptor_sha256",
    "state_sha256",
    "catalog_sha256",
    "gate_inventory_sha256",
    "privacy_secret_inventory_sha256",
    "checked_count",
    "rows",
  ])) throw new AttestationFailure("snapshot schema differs");
  if (
    value.schema_version !== 2 ||
    !GIT_SHA.test(value.main_source_commit_sha as string) ||
    !GIT_SHA.test(value.main_source_tree_sha as string) ||
    !SHA256.test(value.source_manifest_sha256 as string) ||
    !SHA256.test(value.sql_sha256 as string) ||
    !SHA256.test(value.response_sha256 as string) ||
    !SHA256.test(value.descriptor_sha256 as string) ||
    !SHA256.test(value.state_sha256 as string) ||
    !SHA256.test(value.catalog_sha256 as string) ||
    !SHA256.test(value.gate_inventory_sha256 as string) ||
    !SHA256.test(value.privacy_secret_inventory_sha256 as string) ||
    value.main_source_commit_sha !==
      envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA") ||
    value.main_source_tree_sha !==
      envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA") ||
    value.source_manifest_sha256 !==
      envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256") ||
    value.sql_sha256 !== envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_PREFLIGHT_SQL_SHA256") ||
    value.catalog_sha256 !== envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_CATALOG_SHA256") ||
    value.privacy_secret_inventory_sha256 !==
      envValue(dependencies, "MAIN_FINANCE_ACCESS_V2_PRIVACY_INVENTORY_SHA256") ||
    !Array.isArray(value.rows) ||
    !Number.isSafeInteger(value.checked_count) ||
    (value.checked_count as number) <= 0 ||
    value.checked_count !== value.rows.length ||
    !canonicalTimestamp(value.database_clock)
  ) throw new AttestationFailure("snapshot evidence differs");

  const now = dependencies.now?.() ?? Date.now();
  const clock = Date.parse(value.database_clock);
  if (
    !Number.isFinite(clock) ||
    now - clock > SNAPSHOT_MAXIMUM_AGE_MS ||
    clock - now > SNAPSHOT_MAXIMUM_FUTURE_SKEW_MS
  ) throw new AttestationFailure("snapshot is stale or future-dated");

  const rows = value.rows.map(validateRow);
  const identities = new Set<string>();
  const events = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (
      identities.has(row.main_user_id) ||
      events.has(row.event_id) ||
      (index > 0 && rows[index - 1].main_user_id >= row.main_user_id)
    ) throw new AttestationFailure("snapshot rows are duplicate or unsorted");
    identities.add(row.main_user_id);
    events.add(row.event_id);
  }
  const expectedDescriptorHash = await sha256Hex(canonicalJson({
    main_source_commit_sha: value.main_source_commit_sha,
    main_source_tree_sha: value.main_source_tree_sha,
    source_manifest_sha256: value.source_manifest_sha256,
    catalog_sha256: value.catalog_sha256,
    gate_inventory_sha256: value.gate_inventory_sha256,
    privacy_secret_inventory_sha256: value.privacy_secret_inventory_sha256,
    checked_count: value.checked_count,
    rows,
  }));
  if (value.descriptor_sha256 !== expectedDescriptorHash) {
    throw new AttestationFailure("snapshot descriptor hash differs");
  }
  return Object.freeze({
    ...(value as unknown as Omit<ValidatedSnapshot, "rows">),
    rows: Object.freeze(rows),
  });
}

function parseStatus(value: unknown, userId: string, eventId: string): AccessStatus {
  if (!exactObject(value, [
    "ok",
    "main_user_id",
    "current_version",
    "desired_state",
    "applied_version",
    "applied_state",
    "event",
  ]) || value.ok !== true || value.main_user_id !== userId ||
    !DECIMAL.test(value.current_version as string) ||
    !DECIMAL.test(value.applied_version as string) ||
    ![null, "granted", "revoked"].includes(value.desired_state as string | null) ||
    ![null, "granted", "revoked"].includes(value.applied_state as string | null)
  ) throw new AttestationFailure("status contract differs");
  if (value.event !== null && (!exactObject(value.event, ["event_id", "version", "desired_state", "state"]) ||
    value.event.event_id !== eventId ||
    !DECIMAL.test(value.event.version as string) ||
    !["granted", "revoked"].includes(value.event.desired_state as string) ||
    !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(
      value.event.state as string,
    )
  )) throw new AttestationFailure("current event status differs");
  return Object.freeze({
    main_user_id: value.main_user_id,
    current_version: value.current_version,
    desired_state: value.desired_state,
    applied_version: value.applied_version,
    applied_state: value.applied_state,
    event: value.event === null ? null : Object.freeze(value.event),
  } as AccessStatus);
}

function assertStatusMatchesRow(status: AccessStatus, row: SnapshotRow): void {
  if (
    status.current_version !== row.version ||
    status.desired_state !== row.desired_state ||
    status.applied_version !== row.applied_version ||
    status.applied_state !== row.applied_state ||
    status.event === null ||
    status.event.event_id !== row.event_id ||
    status.event.version !== row.version ||
    status.event.desired_state !== row.desired_state ||
    status.event.state !== row.event_state
  ) throw new AttestationFailure("descriptor row drifted");
}

function parseResolver(value: unknown, userId: string): string {
  if (!exactObject(value, ["ok", "main_user_id", "telegram_id"]) ||
    value.ok !== true || value.main_user_id !== userId ||
    typeof value.telegram_id !== "string" || !/^[1-9][0-9]{0,18}$/u.test(value.telegram_id)
  ) throw new AttestationFailure("resolver contract differs");
  return value.telegram_id;
}

function parseSetterReplay(value: unknown, row: SnapshotRow): void {
  if (!exactObject(value, ["ok", "replayed", "event_id", "version", "state"]) ||
    value.ok !== true || value.replayed !== true || value.event_id !== row.event_id ||
    value.version !== row.version || value.state !== row.event_state
  ) throw new AttestationFailure("attestation replay was not exact");
}

function parseSetterResult(
  value: unknown,
  eventId: string,
): Readonly<{ replayed: boolean; version: string; state: string }> {
  if (!exactObject(value, ["ok", "replayed", "event_id", "version", "state"]) ||
    value.ok !== true || typeof value.replayed !== "boolean" ||
    value.event_id !== eventId || !DECIMAL.test(value.version as string) ||
    !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(value.state as string)
  ) throw new AttestationFailure("setter result contract differs");
  if (value.replayed === false && value.state !== "pending") {
    throw new AttestationFailure("first setter result is not exact pending");
  }
  return Object.freeze({
    replayed: value.replayed,
    version: value.version as string,
    state: value.state as string,
  });
}

async function defaultRpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await serviceClient(7_500).rpc(name, body);
  if (error) throw new Error("RPC unavailable");
  return data;
}

async function rpc(
  dependencies: FinanceManageAccessV2Dependencies,
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return (dependencies.rpc ?? defaultRpc)(name, body);
}

async function readStatus(
  dependencies: FinanceManageAccessV2Dependencies,
  userId: string,
  eventId: string,
): Promise<AccessStatus> {
  return parseStatus(await rpc(
    dependencies,
    "architecture_get_finance_access_status_internal",
    { p_main_user_id: userId, p_event_id: eventId },
  ), userId, eventId);
}

async function replayAttestationRow(
  row: SnapshotRow,
  dependencies: FinanceManageAccessV2Dependencies,
  privacyKey: string,
  beforeReplay?: () => void | Promise<void>,
): Promise<Readonly<{
  status: AccessStatus;
  subjectDigest: string;
  subjectResolverValue: string;
}>> {
  const before = await readStatus(dependencies, row.main_user_id, row.event_id);
  assertStatusMatchesRow(before, row);
  const resolver = parseResolver(await rpc(
    dependencies,
    "architecture_resolve_finance_subject_internal",
    { p_main_user_id: row.main_user_id },
  ), row.main_user_id);
  const subjectDigest = await derivePrivateDigest(
    privacyKey,
    "main-telegram-subject-v1",
    resolver,
  );
  const historicalExpectedVersion = (BigInt(row.version) - 1n).toString();
  if (beforeReplay) await beforeReplay();
  let replay: unknown;
  try {
    replay = await rpc(
      dependencies,
      "architecture_set_finance_access_desired_internal",
      {
        p_event_id: row.event_id,
        p_main_user_id: row.main_user_id,
        p_subject_digest: `\\x${subjectDigest}`,
        p_desired_state: row.desired_state,
        p_changed_by: row.changed_by,
        p_change_reason: row.change_reason,
        // The existing setter ignores this field on exact replay. The value is
        // derived, never represented as independently attested evidence.
        p_expected_version: historicalExpectedVersion,
      },
    );
  } catch {
    try {
      const reconciled = await readStatus(
        dependencies,
        row.main_user_id,
        row.event_id,
      );
      assertStatusMatchesRow(reconciled, row);
    } catch {
      // Preserve unknown without disclosing which row failed.
    }
    throw new AttestationOutcomeUnknown("attestation replay outcome is unknown");
  }
  parseSetterReplay(replay, row);
  const after = await readStatus(dependencies, row.main_user_id, row.event_id);
  assertStatusMatchesRow(after, row);
  return Object.freeze({
    status: after,
    subjectDigest,
    subjectResolverValue: resolver,
  });
}

async function attestSnapshot(
  snapshot: ValidatedSnapshot,
  dependencies: FinanceManageAccessV2Dependencies,
  privacyKey: string,
): Promise<void> {
  // Complete status pass first. No setter is reachable until every descriptor
  // row is proven to be the current exact terminal row.
  for (const row of snapshot.rows) {
    if (
      row.event_state !== "applied" ||
      row.applied_version !== row.version ||
      row.applied_state !== row.desired_state
    ) throw new AttestationFailure("snapshot is not globally terminal");
    const status = await readStatus(dependencies, row.main_user_id, row.event_id);
    assertStatusMatchesRow(status, row);
  }

  for (const row of snapshot.rows) {
    await replayAttestationRow(row, dependencies, privacyKey);
  }
}

function proofMessage(
  sourceDeploymentSha256: string,
  snapshot: ValidatedSnapshot,
  timestamp: number,
): string {
  return [
    "main-finance-access-v2-attestation",
    sourceDeploymentSha256,
    snapshot.sql_sha256,
    snapshot.main_source_commit_sha,
    snapshot.main_source_tree_sha,
    snapshot.source_manifest_sha256,
    snapshot.catalog_sha256,
    snapshot.gate_inventory_sha256,
    snapshot.privacy_secret_inventory_sha256,
    snapshot.database_clock,
    snapshot.response_sha256,
    snapshot.descriptor_sha256,
    snapshot.state_sha256,
    String(snapshot.checked_count),
    String(timestamp),
  ].join("\n");
}

async function createProof(
  operatorSecret: string,
  sourceDeploymentSha256: string,
  snapshot: ValidatedSnapshot,
  now: number,
): Promise<string> {
  const timestamp = Math.trunc(now);
  const digest = await hmacSha256Hex(
    operatorSecret,
    proofMessage(sourceDeploymentSha256, snapshot, timestamp),
  );
  return `${timestamp}.${digest}`;
}

async function verifyProof(
  proof: unknown,
  operatorSecret: string,
  sourceDeploymentSha256: string,
  snapshot: ValidatedSnapshot,
  now: number,
): Promise<number> {
  if (typeof proof !== "string") throw new AttestationFailure("attestation proof differs");
  const match = /^([1-9][0-9]{12})\.([0-9a-f]{64})$/u.exec(proof);
  if (!match) throw new AttestationFailure("attestation proof differs");
  const timestamp = Number(match[1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    now - timestamp > PROOF_MAXIMUM_AGE_SECONDS * 1_000 ||
    timestamp - now > 30 * 1_000
  ) throw new AttestationFailure("attestation proof is stale or future-dated");
  const expected = await hmacSha256Hex(
    operatorSecret,
    proofMessage(sourceDeploymentSha256, snapshot, timestamp),
  );
  if (!constantTimeHexEqual(match[2], expected)) {
    throw new AttestationFailure("attestation proof differs");
  }
  return timestamp;
}

function liveRuntimeClock(dependencies: FinanceManageAccessV2Dependencies): number {
  const now = dependencies.now?.() ?? Date.now();
  if (
    !Number.isSafeInteger(now) ||
    now <= 0 ||
    new Date(now).getTime() !== now
  ) throw new ConfigurationFailure("runtime clock differs");
  return now;
}

function assertFreshImmediatelyBeforeMutation(
  requestTimestamp: number,
  approvalExpiresAt: string,
  snapshot: ValidatedSnapshot,
  dependencies: FinanceManageAccessV2Dependencies,
  proofTimestamp?: number,
): void {
  const liveNow = liveRuntimeClock(dependencies);
  const expiry = Date.parse(approvalExpiresAt);
  const databaseClock = Date.parse(snapshot.database_clock);
  if (
    Math.abs(liveNow - requestTimestamp) > 60 * 1_000 ||
    !Number.isFinite(expiry) ||
    expiry <= liveNow ||
    !Number.isFinite(databaseClock) ||
    liveNow - databaseClock > SNAPSHOT_MAXIMUM_AGE_MS ||
    databaseClock - liveNow > SNAPSHOT_MAXIMUM_FUTURE_SKEW_MS ||
    (proofTimestamp !== undefined && (
      liveNow - proofTimestamp > PROOF_MAXIMUM_AGE_SECONDS * 1_000 ||
      proofTimestamp - liveNow > 30 * 1_000
    ))
  ) throw new AttestationFailure("authorization expired before mutation");
}

async function defaultDispatch(eventId: string, triggerSecret: string): Promise<unknown> {
  const response = await fetch(`${MAIN_ORIGIN}/functions/v1/finance-sync-entitlements`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "x-architecture-sync-trigger": triggerSecret,
    },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (response.redirected || !response.ok ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get("content-type") ?? "")) {
    throw new Error("dispatch unavailable");
  }
  const bytes = await readJsonRequestBytes(
    response as unknown as Request,
    2_048,
    3_000,
  );
  let source: string;
  let value: unknown;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(source);
  } catch {
    throw new Error("dispatch response differs");
  }
  if (JSON.stringify(value) !== source) throw new Error("dispatch response is not exact JSON");
  return value;
}

function validateDispatch(value: unknown): void {
  if (!exactObject(value, ["ok", "claimed", "applied", "retried", "dead_lettered"]) ||
    value.ok !== true ||
    ![value.claimed, value.applied, value.retried, value.dead_lettered].every(
      (item) => Number.isInteger(item) && (item as number) >= 0 && (item as number) <= 1,
    ) ||
    value.claimed !== 1 ||
    (value.applied as number) + (value.retried as number) + (value.dead_lettered as number) !== 1
  ) throw new Error("dispatch contract differs");
}

function validateCommand(action: string, value: unknown): Record<string, unknown> | null {
  if (action === "attest") {
    if (value !== null) throw new RequestRejected("attest command must be null");
    return null;
  }
  if (action === "status") {
    if (!exactObject(value, ["main_user_id", "event_id"]) ||
      !UUID_V4.test(value.main_user_id as string) || !UUID_V4.test(value.event_id as string)
    ) throw new RequestRejected("status command differs");
    return value;
  }
  if (action === "reconcile") {
    if (!exactObject(value, [
      "original_plan",
      "original_plan_sha256",
      "reconcile_approval_expires_at",
      "reconcile_sha256",
    ]) || !exactObject(value.original_plan, MUTATION_PLAN_KEYS) ||
      !SHA256.test(value.original_plan_sha256 as string) ||
      !canonicalTimestamp(value.reconcile_approval_expires_at) ||
      !SHA256.test(value.reconcile_sha256 as string)
    ) throw new RequestRejected("reconcile command differs");
    return value;
  }
  if (!exactObject(value, [
    "event_id",
    "main_user_id",
    "current_event_id",
    "expected_version",
    "changed_by",
    "change_reason",
    "dispatch",
    "attestation_proof",
    "plan_sha256",
    "approval_expires_at",
    "post_database_clock",
    "post_response_sha256",
    "post_snapshot_sha256",
    "post_snapshot",
  ]) || !UUID_V4.test(value.event_id as string) ||
    !UUID_V4.test(value.main_user_id as string) ||
    !(
      value.current_event_id === null ||
      UUID_V4.test(value.current_event_id as string)
    ) ||
    !DECIMAL.test(value.expected_version as string) ||
    (value.current_event_id === null) !==
      (action === "grant" && value.expected_version === "0") ||
    !ACTOR.test(value.changed_by as string) ||
    typeof value.change_reason !== "string" || value.change_reason !== value.change_reason.trim() ||
    value.change_reason.length < 1 || value.change_reason.length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(value.change_reason) ||
    value.dispatch !== true ||
    !SHA256.test(value.plan_sha256 as string) ||
    typeof value.approval_expires_at !== "string" ||
    typeof value.post_database_clock !== "string" ||
    !SHA256.test(value.post_response_sha256 as string) ||
    !SHA256.test(value.post_snapshot_sha256 as string) ||
    value.post_snapshot === null || typeof value.post_snapshot !== "object"
  ) throw new RequestRejected("mutation command differs");
  return value;
}

function safeStatusPayload(action: string, status: AccessStatus): Record<string, unknown> {
  return {
    ok: true,
    action,
    main_user_id: status.main_user_id,
    current_version: status.current_version,
    desired_state: status.desired_state,
    applied_version: status.applied_version,
    applied_state: status.applied_state,
    event: status.event,
  };
}

function isExactAppliedAccess(
  status: AccessStatus,
  desiredState: "granted" | "revoked",
  version: string,
): boolean {
  return status.current_version === version &&
    status.desired_state === desiredState &&
    status.applied_version === version &&
    status.applied_state === desiredState &&
    status.event !== null &&
    status.event.version === version &&
    status.event.desired_state === desiredState &&
    status.event.state === "applied";
}

function accessNotAppliedResponse(dispatchPerformed: boolean): Response {
  // This is a known NO-GO, not authority to retry a setter or dispatch. Any
  // recovery requires a separate owner-reviewed workflow outside this route.
  return jsonResponse(409, {
    ok: false,
    error: "access_not_applied",
    reconcile_required: false,
    manual_recovery_required: true,
    dispatch_performed: dispatchPerformed,
  }, null);
}

function operatorRequestMessage(timestamp: string, bodySha256: string): string {
  return [
    "main-finance-access-v2-request",
    "POST",
    INCOMING_PATH,
    timestamp,
    bodySha256,
  ].join("\n");
}

async function validateMutationPlan(
  action: string,
  command: Record<string, unknown>,
  sourceDeploymentSha256: string,
  snapshot: ValidatedSnapshot,
  now: number,
): Promise<void> {
  if (!canonicalTimestamp(command.approval_expires_at) ||
    !canonicalTimestamp(command.post_database_clock)) {
    throw new AttestationFailure("approval timestamps differ");
  }
  const approvalExpiresAt = Date.parse(command.approval_expires_at);
  const postDatabaseClock = Date.parse(command.post_database_clock);
  const snapshotClock = Date.parse(snapshot.database_clock);
  if (
    !Number.isFinite(approvalExpiresAt) ||
    approvalExpiresAt <= now ||
    approvalExpiresAt - now > 30 * 60 * 1_000 ||
    !Number.isFinite(postDatabaseClock) ||
    postDatabaseClock < snapshotClock ||
    now - postDatabaseClock > SNAPSHOT_MAXIMUM_AGE_MS ||
    postDatabaseClock - now > SNAPSHOT_MAXIMUM_FUTURE_SKEW_MS ||
    command.post_snapshot_sha256 !== snapshot.state_sha256
  ) throw new AttestationFailure("approval or post-query evidence differs");

  const planCore = mutationPlanCore(action, command, sourceDeploymentSha256, snapshot);
  const expectedPlanSha256 = await sha256Hex(canonicalJson(planCore));
  if (
    command.plan_sha256 !== expectedPlanSha256 ||
    command.change_reason !==
      `main_finance_runtime_recovery_v2_plan:${expectedPlanSha256}`
  ) throw new AttestationFailure("mutation plan hash differs");
}

function mutationPlanCore(
  action: string,
  command: Record<string, unknown>,
  sourceDeploymentSha256: string,
  snapshot: ValidatedSnapshot,
): Record<string, unknown> {
  return {
    schema_version: 2,
    action,
    main_project_ref: MAIN_PROJECT_REF,
    finance_project_ref: FINANCE_PROJECT_REF,
    source_deployment_sha256: sourceDeploymentSha256,
    pre_database_clock: snapshot.database_clock,
    pre_response_sha256: snapshot.response_sha256,
    descriptor_sha256: snapshot.descriptor_sha256,
    catalog_sha256: snapshot.catalog_sha256,
    gate_inventory_sha256: snapshot.gate_inventory_sha256,
    privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    main_source_commit_sha: snapshot.main_source_commit_sha,
    main_source_tree_sha: snapshot.main_source_tree_sha,
    source_manifest_sha256: snapshot.source_manifest_sha256,
    state_sha256: snapshot.state_sha256,
    checked_count: snapshot.checked_count,
    event_id: command.event_id,
    main_user_id: command.main_user_id,
    current_event_id: command.current_event_id,
    expected_version: command.expected_version,
    changed_by: command.changed_by,
    dispatch: command.dispatch,
    attestation_proof: command.attestation_proof,
    approval_expires_at: command.approval_expires_at,
    post_database_clock: command.post_database_clock,
    post_response_sha256: command.post_response_sha256,
    post_snapshot_sha256: command.post_snapshot_sha256,
  };
}

function assertSnapshotSandwich(
  before: ValidatedSnapshot,
  after: ValidatedSnapshot,
  command: Record<string, unknown>,
  proofTimestampMilliseconds: number,
): void {
  const stableBefore = {
    schema_version: before.schema_version,
    main_source_commit_sha: before.main_source_commit_sha,
    main_source_tree_sha: before.main_source_tree_sha,
    source_manifest_sha256: before.source_manifest_sha256,
    sql_sha256: before.sql_sha256,
    descriptor_sha256: before.descriptor_sha256,
    state_sha256: before.state_sha256,
    catalog_sha256: before.catalog_sha256,
    gate_inventory_sha256: before.gate_inventory_sha256,
    privacy_secret_inventory_sha256: before.privacy_secret_inventory_sha256,
    checked_count: before.checked_count,
    rows: before.rows,
  };
  const stableAfter = {
    schema_version: after.schema_version,
    main_source_commit_sha: after.main_source_commit_sha,
    main_source_tree_sha: after.main_source_tree_sha,
    source_manifest_sha256: after.source_manifest_sha256,
    sql_sha256: after.sql_sha256,
    descriptor_sha256: after.descriptor_sha256,
    state_sha256: after.state_sha256,
    catalog_sha256: after.catalog_sha256,
    gate_inventory_sha256: after.gate_inventory_sha256,
    privacy_secret_inventory_sha256: after.privacy_secret_inventory_sha256,
    checked_count: after.checked_count,
    rows: after.rows,
  };
  if (
    canonicalJson(stableBefore) !== canonicalJson(stableAfter) ||
    Date.parse(after.database_clock) < Date.parse(before.database_clock) ||
    Date.parse(after.database_clock) <= proofTimestampMilliseconds ||
    command.post_database_clock !== after.database_clock ||
    command.post_response_sha256 !== after.response_sha256 ||
    command.post_snapshot_sha256 !== after.state_sha256
  ) throw new AttestationFailure("D0 to D1 snapshot sandwich differs");
}

function assertWorkerBoundary(
  dependencies: FinanceManageAccessV2Dependencies,
  dispatch: boolean,
): void {
  const expectedPath = "/functions/v1/finance-apply-entitlement-event-v2";
  const expectedUpstream = `https://${FINANCE_PROJECT_REF}.supabase.co${expectedPath}`;
  if (
    envValue(dependencies, "MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL") !== expectedUpstream ||
    envValue(dependencies, "MAIN_FINANCE_ENTITLEMENT_CANONICAL_PATH") !== expectedPath ||
    envValue(dependencies, "MAIN_FINANCE_PRODUCT_CODE") !== PRODUCT_CODE ||
    (dispatch && envValue(dependencies, "MAIN_FINANCE_SYNC_MODE") !== "enabled")
  ) throw new ConfigurationFailure("worker target boundary differs");
}

async function reconcileExistingEvent(
  command: Record<string, unknown>,
  snapshot: ValidatedSnapshot,
  sourceDeploymentSha256: string,
  dependencies: FinanceManageAccessV2Dependencies,
  privacyKey: string,
  now: number,
  requestTimestamp: number,
): Promise<Response> {
  const originalPlan = command.original_plan as Record<string, unknown>;
  const originalPlanSha256 = await sha256Hex(canonicalJson(originalPlan));
  const originalFirstGrant = originalPlan.action === "grant" &&
    originalPlan.expected_version === "0" && originalPlan.current_event_id === null;
  if (
    originalPlanSha256 !== command.original_plan_sha256 ||
    originalPlan.schema_version !== 2 ||
    !["grant", "revoke"].includes(originalPlan.action as string) ||
    originalPlan.main_project_ref !== MAIN_PROJECT_REF ||
    originalPlan.finance_project_ref !== FINANCE_PROJECT_REF ||
    originalPlan.source_deployment_sha256 !== sourceDeploymentSha256 ||
    originalPlan.main_source_commit_sha !== snapshot.main_source_commit_sha ||
    originalPlan.main_source_tree_sha !== snapshot.main_source_tree_sha ||
    originalPlan.source_manifest_sha256 !== snapshot.source_manifest_sha256 ||
    originalPlan.catalog_sha256 !== snapshot.catalog_sha256 ||
    originalPlan.privacy_secret_inventory_sha256 !==
      snapshot.privacy_secret_inventory_sha256 ||
    !UUID_V4.test(originalPlan.event_id as string) ||
    !UUID_V4.test(originalPlan.main_user_id as string) ||
    !(originalFirstGrant || UUID_V4.test(originalPlan.current_event_id as string)) ||
    !DECIMAL.test(originalPlan.expected_version as string) ||
    !ACTOR.test(originalPlan.changed_by as string) ||
    originalPlan.dispatch !== true ||
    !canonicalTimestamp(originalPlan.pre_database_clock) ||
    !canonicalTimestamp(originalPlan.post_database_clock) ||
    !canonicalTimestamp(originalPlan.approval_expires_at)
  ) throw new AttestationFailure("original mutation plan differs");

  const reconcileExpiresAt = Date.parse(command.reconcile_approval_expires_at as string);
  if (
    reconcileExpiresAt <= now ||
    reconcileExpiresAt - now > 30 * 60 * 1_000
  ) throw new AttestationFailure("reconcile approval expired");
  const reconcileCore = {
    schema_version: 2,
    kind: "main-finance-access-v2-reconcile",
    main_project_ref: MAIN_PROJECT_REF,
    finance_project_ref: FINANCE_PROJECT_REF,
    source_deployment_sha256: sourceDeploymentSha256,
    original_plan_sha256: originalPlanSha256,
    d1_database_clock: snapshot.database_clock,
    d1_response_sha256: snapshot.response_sha256,
    d1_descriptor_sha256: snapshot.descriptor_sha256,
    d1_state_sha256: snapshot.state_sha256,
    d1_catalog_sha256: snapshot.catalog_sha256,
    d1_gate_inventory_sha256: snapshot.gate_inventory_sha256,
    d1_privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    reconcile_approval_expires_at: command.reconcile_approval_expires_at,
  };
  if (command.reconcile_sha256 !== await sha256Hex(canonicalJson(reconcileCore))) {
    throw new AttestationFailure("reconcile plan hash differs");
  }

  const status = await readStatus(
    dependencies,
    originalPlan.main_user_id as string,
    originalPlan.event_id as string,
  );
  if (status.event === null) {
    return jsonResponse(409, {
      ok: false,
      error: "reconcile_event_absent",
      reconcile_required: true,
      dispatch_performed: false,
    }, null);
  }
  const targetRow = snapshot.rows.find((row) =>
    row.main_user_id === originalPlan.main_user_id &&
    row.event_id === originalPlan.event_id
  );
  const expectedReason =
    `main_finance_runtime_recovery_v2_plan:${originalPlanSha256}`;
  if (
    !targetRow ||
    targetRow.version !== (BigInt(originalPlan.expected_version as string) + 1n).toString() ||
    targetRow.desired_state !==
      (originalPlan.action === "grant" ? "granted" : "revoked") ||
    targetRow.changed_by !== originalPlan.changed_by ||
    targetRow.change_reason !== expectedReason ||
    status.current_version !== targetRow.version ||
    status.event.version !== targetRow.version ||
    status.event.desired_state !== targetRow.desired_state ||
    status.event.state !== targetRow.event_state
  ) throw new AttestationFailure("reconcile event is not exact current event");

  // Validate the complete supplied D1 before the one exact replay. Other rows
  // must remain terminal; only the target may be a nonterminal unknown outcome.
  for (const row of snapshot.rows) {
    if (row.main_user_id !== targetRow.main_user_id && (
      row.event_state !== "applied" ||
      row.applied_version !== row.version ||
      row.applied_state !== row.desired_state
    )) throw new AttestationFailure("non-target D1 row is not terminal");
    const current = await readStatus(dependencies, row.main_user_id, row.event_id);
    assertStatusMatchesRow(current, row);
  }
  const replayed = await replayAttestationRow(
    targetRow,
    dependencies,
    privacyKey,
    () => assertFreshImmediatelyBeforeMutation(
      requestTimestamp,
      command.reconcile_approval_expires_at as string,
      snapshot,
      dependencies,
    ),
  );
  if (!isExactAppliedAccess(
    replayed.status,
    targetRow.desired_state,
    targetRow.version,
  )) {
    return accessNotAppliedResponse(false);
  }
  return jsonResponse(200, {
    ...safeStatusPayload("reconcile", replayed.status),
    replayed: true,
    dispatch_performed: false,
    original_plan_sha256: originalPlanSha256,
    reconcile_sha256: command.reconcile_sha256,
  }, null);
}

export async function handleFinanceManageAccessV2Request(
  request: Request,
  dependencies: FinanceManageAccessV2Dependencies = {},
): Promise<Response> {
  try {
    if (!matchesSupabaseFunctionRoute(request.url, "finance-manage-access-v2")) {
      throw new RequestRejected("path differs");
    }
    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "method_not_allowed" }, null);
    }
    if (
      request.headers.has("origin") || request.headers.has("cookie") ||
      request.headers.has("authorization") || request.headers.has("access-control-request-method") ||
      request.headers.has("access-control-request-headers")
    ) throw new RequestRejected("ambient context is forbidden");

    const input = await parseCanonicalBody(request);
    assertCompiledBoundary(input, dependencies);
    const action = input.action as string;
    const command = validateCommand(action, input.command);

    const expectedOperator = secret(dependencies, "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2");
    const now = liveRuntimeClock(dependencies);
    const suppliedSignature = request.headers.get(OPERATOR_HEADER) ?? "";
    const suppliedTimestamp = request.headers.get(OPERATOR_TIMESTAMP_HEADER) ?? "";
    const timestamp = /^[1-9][0-9]{12}$/u.test(suppliedTimestamp)
      ? Number(suppliedTimestamp)
      : Number.NaN;
    const bodySha256 = await sha256Hex(canonicalJson(input));
    const expectedSignature = await hmacSha256Hex(
      expectedOperator,
      operatorRequestMessage(suppliedTimestamp, bodySha256),
    );
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(now - timestamp) > 60 * 1_000 ||
      !constantTimeHexEqual(suppliedSignature, expectedSignature)
    ) {
      return jsonResponse(401, { ok: false, error: "unauthorized" }, null);
    }

    if (action === "status") {
      if (input.snapshot !== null || command === null) {
        throw new RequestRejected("status snapshot must be null");
      }
      const status = await readStatus(
        dependencies,
        command.main_user_id as string,
        command.event_id as string,
      );
      return jsonResponse(200, safeStatusPayload(action, status), null);
    }

    const snapshot = await validateSnapshot(input.snapshot, dependencies);
    const privacyKey = secret(dependencies, "MAIN_FINANCE_PRIVACY_HMAC_KEY");
    const triggerSecret = secret(dependencies, "MAIN_FINANCE_SYNC_TRIGGER_SECRET");
    const optionalSecretNames = [
      "MAIN_FINANCE_ENTITLEMENT_V2_HMAC_SECRET",
      "MAIN_FINANCE_ENTITLEMENT_HMAC_SECRET",
      "MAIN_FINANCE_ISSUER_HMAC_SECRET",
      "MAIN_FINANCE_NONCE_DERIVATION_KEY",
      "TELEGRAM_BOT_TOKEN",
      "SUPABASE_SERVICE_ROLE_KEY",
      "MAIN_SUPABASE_SECRET_KEY",
    ];
    const optionalSecrets = optionalSecretNames
      .map((name) => dependencies.env ? dependencies.env(name) : Deno.env.get(name))
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const configuredSecrets = [expectedOperator, privacyKey, triggerSecret, ...optionalSecrets];
    if (new Set(configuredSecrets).size !== configuredSecrets.length) {
      throw new ConfigurationFailure("runtime secrets are not separated");
    }
    if (action === "reconcile") {
      if (command === null) throw new RequestRejected("reconcile command is missing");
      return await reconcileExistingEvent(
        command,
        snapshot,
        input.source_deployment_sha256 as string,
        dependencies,
        privacyKey,
        now,
        timestamp,
      );
    }
    if (action === "attest") {
      await attestSnapshot(snapshot, dependencies, privacyKey);
      const attestationProof = await createProof(
        expectedOperator,
        input.source_deployment_sha256 as string,
        snapshot,
        now,
      );
      return jsonResponse(200, {
        ok: true,
        action: "attest",
        provided_descriptor_replayed: true,
        database_clock: snapshot.database_clock,
        checked_count: snapshot.checked_count,
        mismatch_count: 0,
        state_sha256: snapshot.state_sha256,
        attested_at: new Date(now).toISOString(),
        attestation_proof: attestationProof,
      }, null);
    }

    if (command === null || command.post_snapshot_sha256 !== snapshot.state_sha256) {
      throw new AttestationFailure("post-attestation snapshot differs");
    }
    const proofTimestampMilliseconds = await verifyProof(
      command.attestation_proof,
      expectedOperator,
      input.source_deployment_sha256 as string,
      snapshot,
      now,
    );
    const postSnapshot = await validateSnapshot(command.post_snapshot, dependencies);
    assertSnapshotSandwich(
      snapshot,
      postSnapshot,
      command,
      proofTimestampMilliseconds,
    );
    await validateMutationPlan(
      action,
      command,
      input.source_deployment_sha256 as string,
      snapshot,
      now,
    );
    // D1 must still be globally identical to D0. Replay every supplied current
    // row at D1 before selecting the target for a new event.
    await attestSnapshot(postSnapshot, dependencies, privacyKey);
    const targetRow = postSnapshot.rows.find((row) => row.main_user_id === command.main_user_id);
    const firstGrant = command.current_event_id === null && command.expected_version === "0";
    if (firstGrant) {
      if (action !== "grant" || targetRow !== undefined) {
        throw new AttestationFailure("first grant target contract differs");
      }
    } else if (
      !targetRow ||
      command.current_event_id !== targetRow.event_id ||
      command.expected_version !== targetRow.version
    ) throw new AttestationFailure("target OCC plan differs");

    const desiredState = action === "grant" ? "granted" : "revoked";
    if (targetRow && command.event_id === targetRow.event_id) {
      return jsonResponse(409, {
        ok: false,
        error: "mutation_requires_reconciliation",
        reconcile_required: true,
        dispatch_performed: false,
      }, null);
    }
    if (postSnapshot.rows.some((row) => row.event_id === command.event_id)) {
      throw new AttestationFailure("event UUID belongs to another descriptor row");
    }

    assertWorkerBoundary(dependencies, command.dispatch as boolean);

    // Repeat the target status -> resolver -> exact current-event replay ->
    // status sequence immediately before the only new setter call. Its final
    // status supplies the fresh optimistic-concurrency version.
    let currentVersion: string;
    let targetSubjectDigest: string;
    let targetSubjectResolverValue: string;
    if (firstGrant) {
      const beforeIdentity = await readStatus(
        dependencies,
        command.main_user_id as string,
        command.event_id as string,
      );
      if (
        beforeIdentity.current_version !== "0" ||
        beforeIdentity.desired_state !== null ||
        beforeIdentity.applied_version !== "0" ||
        beforeIdentity.applied_state !== null ||
        beforeIdentity.event !== null
      ) throw new AttestationFailure("first grant target already has state");
      const resolver = parseResolver(await rpc(
        dependencies,
        "architecture_resolve_finance_subject_internal",
        { p_main_user_id: command.main_user_id },
      ), command.main_user_id as string);
      targetSubjectDigest = await derivePrivateDigest(
        privacyKey,
        "main-telegram-subject-v1",
        resolver,
      );
      targetSubjectResolverValue = resolver;
      currentVersion = "0";
    } else {
      const targeted = await replayAttestationRow(
        targetRow as SnapshotRow,
        dependencies,
        privacyKey,
      );
      targetSubjectDigest = targeted.subjectDigest;
      targetSubjectResolverValue = targeted.subjectResolverValue;
      currentVersion = targeted.status.current_version;
    }
    const candidateStatus = await readStatus(
      dependencies,
      command.main_user_id as string,
      command.event_id as string,
    );
    if (firstGrant) {
      if (
        candidateStatus.current_version !== "0" ||
        candidateStatus.desired_state !== null ||
        candidateStatus.applied_version !== "0" ||
        candidateStatus.applied_state !== null
      ) throw new AttestationFailure("first grant target already has state");
    } else if (
      candidateStatus.current_version !== currentVersion ||
      candidateStatus.desired_state !== (targetRow as SnapshotRow).desired_state ||
      candidateStatus.applied_version !== (targetRow as SnapshotRow).applied_version ||
      candidateStatus.applied_state !== (targetRow as SnapshotRow).applied_state
    ) throw new AttestationFailure("target drifted before mutation");
    if (candidateStatus.event !== null) {
      return jsonResponse(409, {
        ok: false,
        error: "mutation_requires_reconciliation",
        reconcile_required: true,
        dispatch_performed: false,
      }, null);
    }
    // Resolver identity is re-read only after the final OCC status. The sole
    // new setter uses this final derivation, and any drift stops before DML.
    const finalSubjectResolverValue = parseResolver(await rpc(
      dependencies,
      "architecture_resolve_finance_subject_internal",
      { p_main_user_id: command.main_user_id },
    ), command.main_user_id as string);
    const finalSubjectDigest = await derivePrivateDigest(
      privacyKey,
      "main-telegram-subject-v1",
      finalSubjectResolverValue,
    );
    if (
      finalSubjectResolverValue !== targetSubjectResolverValue ||
      !constantTimeHexEqual(finalSubjectDigest, targetSubjectDigest)
    ) throw new AttestationFailure("target resolver drifted before mutation");
    targetSubjectDigest = finalSubjectDigest;
    assertFreshImmediatelyBeforeMutation(
      timestamp,
      command.approval_expires_at as string,
      postSnapshot,
      dependencies,
      proofTimestampMilliseconds,
    );
    let setter: unknown;
    try {
      setter = await rpc(
        dependencies,
        "architecture_set_finance_access_desired_internal",
        {
          p_event_id: command.event_id,
          p_main_user_id: command.main_user_id,
          p_subject_digest: `\\x${targetSubjectDigest}`,
          p_desired_state: desiredState,
          p_changed_by: command.changed_by,
          p_change_reason: command.change_reason,
          p_expected_version: currentVersion,
        },
      );
    } catch {
      try {
        // One read-only reconciliation probe establishes whether the exact
        // candidate event exists. It never triggers a second setter call.
        await readStatus(
          dependencies,
          command.main_user_id as string,
          command.event_id as string,
        );
      } catch {
        // Unknown remains unknown when the status boundary is unavailable.
      }
      throw new MutationOutcomeUnknown("setter outcome is unknown");
    }
    let mutation: Readonly<{ replayed: boolean; version: string; state: string }>;
    try {
      mutation = parseSetterResult(setter, command.event_id as string);
      if (
        mutation.replayed === false &&
        mutation.version !== (BigInt(currentVersion) + 1n).toString()
      ) throw new AttestationFailure("setter successor version differs");
    } catch {
      try {
        // The setter has already crossed the DML boundary. A malformed result
        // can never be downgraded to a safe rejection; make one read-only probe
        // and preserve UNKNOWN without dispatching or retrying the setter.
        await readStatus(
          dependencies,
          command.main_user_id as string,
          command.event_id as string,
        );
      } catch {
        // Unknown remains unknown when the sole reconciliation probe fails.
      }
      throw new MutationOutcomeUnknown("setter result is unknown");
    }
    if (mutation.replayed) {
      return jsonResponse(409, {
        ok: false,
        error: "mutation_requires_reconciliation",
        reconcile_required: true,
        dispatch_performed: false,
      }, null);
    }

    if (command.dispatch && !["applied", "dead_letter"].includes(mutation.state)) {
      let dispatchResult: unknown;
      try {
        dispatchResult = await (dependencies.dispatch ?? defaultDispatch)(
          command.event_id as string,
          triggerSecret,
        );
      } catch {
        try {
          await readStatus(
            dependencies,
            command.main_user_id as string,
            command.event_id as string,
          );
        } catch {
          // Preserve unknown without retrying the worker.
        }
        throw new MutationOutcomeUnknown("dispatch outcome is unknown");
      }
      try {
        validateDispatch(dispatchResult);
      } catch {
        try {
          const knownAfterDispatch = await readStatus(
            dependencies,
            command.main_user_id as string,
            command.event_id as string,
          );
          if (
            knownAfterDispatch.event !== null &&
            knownAfterDispatch.event.event_id === command.event_id &&
            knownAfterDispatch.event.version === mutation.version &&
            knownAfterDispatch.event.desired_state === desiredState &&
            !isExactAppliedAccess(knownAfterDispatch, desiredState, mutation.version)
          ) return accessNotAppliedResponse(true);
        } catch {
          // A malformed dispatch response plus unavailable status is unknown.
        }
        throw new MutationOutcomeUnknown("dispatch outcome is unknown");
      }
    }

    let after: AccessStatus;
    try {
      after = await readStatus(
        dependencies,
        command.main_user_id as string,
        command.event_id as string,
      );
    } catch {
      throw new MutationOutcomeUnknown("post-mutation status is unknown");
    }
    if (
      after.event === null || after.event.event_id !== command.event_id ||
      after.event.desired_state !== desiredState || after.event.version !== mutation.version
    ) throw new MutationOutcomeUnknown("post-mutation status differs");
    if (!isExactAppliedAccess(after, desiredState, mutation.version)) {
      return accessNotAppliedResponse(true);
    }
    return jsonResponse(200, {
      ...safeStatusPayload(action, after),
      replayed: false,
      dispatch_performed: true,
    }, null);
  } catch (error) {
    if (error instanceof RequestRejected) {
      return jsonResponse(400, { ok: false, error: "invalid_request" }, null);
    }
    if (error instanceof AttestationOutcomeUnknown) {
      return jsonResponse(503, {
        ok: false,
        error: "attestation_outcome_unknown",
        reconcile_required: true,
      }, null);
    }
    if (error instanceof MutationOutcomeUnknown) {
      return jsonResponse(503, {
        ok: false,
        error: "mutation_outcome_unknown",
        reconcile_required: true,
      }, null);
    }
    if (error instanceof AttestationFailure) {
      return jsonResponse(409, {
        ok: false,
        error: "attestation_failed",
        checked_count: 0,
        mismatch_count: 1,
      }, null);
    }
    return jsonResponse(503, { ok: false, error: "temporarily_unavailable" }, null);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((request: Request) => handleFinanceManageAccessV2Request(request));
}
