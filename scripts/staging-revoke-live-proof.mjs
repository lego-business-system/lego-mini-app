import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = path.resolve(
  SCRIPT_DIRECTORY,
  "../supabase/contracts/staging-revoke-preservation-v1.json",
);
const MANAGEMENT_API_ORIGIN = "https://api.supabase.com";
const READ_ONLY_ENDPOINT_SUFFIX = "/database/query/read-only";
const MAXIMUM_RESPONSE_BYTES = 256 * 1_024;
const REQUEST_TIMEOUT_MS = 30_000;
const MAXIMUM_PROOF_AGE_MS = 15 * 60 * 1_000;
const MAXIMUM_FUTURE_SKEW_MS = 60 * 1_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const TABLE_IDENTIFIER = /^finance_[a-z0-9_]+$/u;
const EXPECTED_DATABASE_ROLE = "supabase_read_only_user";
const EXPECTED_FINANCE_CATALOG_COUNT = "135";
const EXPECTED_FINANCE_CATALOG_SHA256 =
  "842604191d7304888ca979cb3fa1c70c25ce37eb75195ed7a90f1f0558005e17";

export const STAGING_REVOKE_BOUNDARY = Object.freeze({
  financeProjectRef: "makgsbjduobcphuqzaoq",
  mainProjectRef: "bljeoovhydhjhdzwplxh",
  productionDenyRefs: Object.freeze([
    "koibxwgtihwajocxfetb",
    "soxtekhspohkddpdidvp",
  ]),
});

function fail(message) {
  throw new Error(`Staging revoke live proof refused: ${message}`);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function exactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) fail(`${label} keys differ`);
}

function canonicalTimestamp(value) {
  if (
    typeof value !== "string"
    || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u
      .test(value)
  ) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds)
    && new Date(milliseconds).toISOString() === value
  );
}

function nullableTimestamp(value) {
  return value === null || canonicalTimestamp(value);
}

function exactDecimal(value) {
  return typeof value === "string" && DECIMAL.test(value);
}

function allZero(value) {
  return Object.values(value).every(item => item === "0");
}

function loadReviewedManifest() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  } catch {
    fail("reviewed preservation manifest is unavailable");
  }
  exactKeys(parsed, [
    "schemaVersion",
    "schema",
    "tablePrefix",
    "preservedTables",
    "mutableTables",
  ], "preservation manifest");
  if (
    parsed.schemaVersion !== 1
    || parsed.schema !== "public"
    || parsed.tablePrefix !== "finance_"
    || !Array.isArray(parsed.preservedTables)
    || !Array.isArray(parsed.mutableTables)
    || parsed.preservedTables.length !== 129
    || parsed.mutableTables.length !== 6
    || parsed.preservedTables.some(name => !TABLE_IDENTIFIER.test(name))
    || parsed.mutableTables.some(name => !TABLE_IDENTIFIER.test(name))
    || new Set(parsed.preservedTables).size !== 129
    || new Set(parsed.mutableTables).size !== 6
    || canonicalJson([...parsed.preservedTables].sort())
      !== canonicalJson(parsed.preservedTables)
    || canonicalJson([...parsed.mutableTables].sort())
      !== canonicalJson(parsed.mutableTables)
    || parsed.preservedTables.some(name => parsed.mutableTables.includes(name))
    || canonicalJson(parsed.mutableTables) !== canonicalJson([
      "finance_connected_devices",
      "finance_device_codes",
      "finance_device_codes_v2",
      "finance_entitlement_subject_bindings_v2",
      "finance_entitlement_subject_events_v2",
      "finance_entitlements",
    ])
  ) fail("reviewed preservation manifest differs");
  const catalog = [...parsed.preservedTables, ...parsed.mutableTables].sort();
  if (
    catalog.length !== 135
    || sha256(catalog.join("\n")) !== EXPECTED_FINANCE_CATALOG_SHA256
  ) fail("reviewed Finance catalog boundary differs");
  return Object.freeze({
    ...parsed,
    preservedTables: Object.freeze([...parsed.preservedTables]),
    mutableTables: Object.freeze([...parsed.mutableTables]),
    manifestSha256: sha256(parsed.preservedTables.join("\n")),
    catalogSha256: sha256(catalog.join("\n")),
  });
}

export const PRESERVATION_MANIFEST = loadReviewedManifest();

function snapshotSelect(table) {
  return `SELECT '${table}'::text AS relation_name,
       pg_catalog.count(*)::text AS row_count,
       pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(
             COALESCE(
               pg_catalog.string_agg(
                 row_sha256,
                 E'\\n'
                 ORDER BY row_sha256
               ),
               ''
             ),
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       ) AS content_sha256
FROM (
  SELECT pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.to_jsonb(source_row)::text,
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         ) AS row_sha256
  FROM public.${table} AS source_row
) AS row_hashes`;
}

const CATALOG_CT = `catalog_rows AS (
  SELECT relation.relname::text AS relation_name
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname LIKE E'finance\\\\_%' ESCAPE E'\\\\'
),
catalog_proof AS (
  SELECT pg_catalog.count(*)::text AS table_count,
         pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               COALESCE(
                 pg_catalog.string_agg(
                   relation_name,
                   E'\\n'
                   ORDER BY relation_name
                 ),
                 ''
               ),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         ) AS catalog_sha256
  FROM catalog_rows
)`;

const SNAPSHOT_CT = `preservation_rows AS (
${PRESERVATION_MANIFEST.preservedTables.map(snapshotSelect).join("\nUNION ALL\n")}
),
preservation_proof AS (
  SELECT pg_catalog.count(*)::text AS table_count,
         pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.string_agg(
                 relation_name,
                 E'\\n'
                 ORDER BY relation_name
               ),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         ) AS manifest_sha256,
         pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'table', relation_name,
             'rowCount', row_count,
             'contentSha256', content_sha256
           )
           ORDER BY relation_name
         ) AS preservation_snapshot
  FROM preservation_rows
)`;

const DATABASE_CLOCK_SQL =
  `pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const TIMESTAMP_SQL = column =>
  `CASE WHEN ${column} IS NULL THEN NULL ELSE pg_catalog.to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END`;

const FINANCE_BASELINE_SQL = `WITH
${CATALOG_CT},
${SNAPSHOT_CT}
SELECT CURRENT_USER::text AS database_role,
       ${DATABASE_CLOCK_SQL} AS database_clock,
       catalog_proof.table_count AS catalog_table_count,
       catalog_proof.catalog_sha256,
       preservation_proof.table_count AS manifest_table_count,
       preservation_proof.manifest_sha256,
       preservation_proof.preservation_snapshot
FROM catalog_proof
CROSS JOIN preservation_proof`;

const MAIN_FINAL_SQL = `WITH
target_outbox AS (
  SELECT outbox.event_id,
         outbox.subject_digest,
         outbox.product_code,
         outbox.desired_state,
         outbox.version,
         outbox.state,
         outbox.created_at,
         outbox.updated_at,
         outbox.applied_at
  FROM public.architecture_finance_access_outbox AS outbox
  WHERE outbox.event_id = $1::uuid
),
target_desired AS (
  SELECT desired.main_user_id,
         desired.subject_digest,
         desired.product_code,
         desired.desired_state,
         desired.version,
         desired.last_event_id,
         desired.applied_version,
         desired.applied_state,
         desired.applied_at,
         desired.updated_at
  FROM public.architecture_finance_access_desired AS desired
  JOIN target_outbox AS outbox
    ON outbox.subject_digest = desired.subject_digest
   AND outbox.product_code = desired.product_code
   AND outbox.event_id = desired.last_event_id
),
target_entitlement AS (
  SELECT entitlement.subject_digest,
         entitlement.product_code,
         entitlement.status,
         entitlement.active_from,
         entitlement.active_until,
         entitlement.updated_at
  FROM public.architecture_product_entitlements AS entitlement
  JOIN target_outbox AS outbox
    ON outbox.subject_digest = entitlement.subject_digest
   AND outbox.product_code = entitlement.product_code
),
global_counts AS (
  SELECT
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state = 'pending') AS pending,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state = 'retry_wait') AS retry_wait,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state = 'processing') AS processing,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state = 'dead_letter') AS dead_letter,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state <> 'applied') AS non_applied,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_outbox
      WHERE state NOT IN ('pending', 'processing', 'retry_wait', 'applied', 'dead_letter')
         OR desired_state NOT IN ('granted', 'revoked')) AS unknown,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_desired
      WHERE version <> applied_version
         OR desired_state IS DISTINCT FROM applied_state
         OR applied_at IS NULL) AS desired_not_converged,
    (SELECT pg_catalog.count(*)::text
       FROM public.architecture_finance_access_desired AS desired
       LEFT JOIN public.architecture_product_entitlements AS entitlement
         ON entitlement.subject_digest = desired.subject_digest
        AND entitlement.product_code = desired.product_code
      WHERE (
        desired.desired_state = 'revoked'
        AND (
          entitlement.subject_digest IS NULL
          OR entitlement.status <> 'blocked'
          OR entitlement.active_from IS NOT NULL
          OR entitlement.active_until IS NOT NULL
        )
      ) OR (
        desired.desired_state = 'granted'
        AND (
          entitlement.subject_digest IS NULL
          OR entitlement.status NOT IN ('active', 'trial', 'manual')
        )
      )) AS managed_gate_mismatch
)
SELECT CURRENT_USER::text AS database_role,
       ${DATABASE_CLOCK_SQL} AS database_clock,
       (SELECT pg_catalog.count(*)::text FROM target_outbox) AS event_count,
       (SELECT event_id::text FROM target_outbox) AS outbox_event_id,
       (SELECT pg_catalog.encode(subject_digest, 'hex') FROM target_outbox) AS subject_digest,
       (SELECT version::text FROM target_outbox) AS outbox_version,
       (SELECT desired_state FROM target_outbox) AS outbox_desired_state,
       (SELECT state FROM target_outbox) AS outbox_state,
       (SELECT ${TIMESTAMP_SQL("created_at")} FROM target_outbox) AS outbox_created_at,
       (SELECT ${TIMESTAMP_SQL("updated_at")} FROM target_outbox) AS outbox_updated_at,
       (SELECT ${TIMESTAMP_SQL("applied_at")} FROM target_outbox) AS outbox_applied_at,
       (SELECT pg_catalog.count(*)::text FROM target_desired) AS desired_count,
       (SELECT last_event_id::text FROM target_desired) AS desired_last_event_id,
       (SELECT version::text FROM target_desired) AS desired_version,
       (SELECT desired_state FROM target_desired) AS desired_state,
       (SELECT applied_version::text FROM target_desired) AS desired_applied_version,
       (SELECT applied_state FROM target_desired) AS desired_applied_state,
       (SELECT ${TIMESTAMP_SQL("applied_at")} FROM target_desired) AS desired_applied_at,
       (SELECT ${TIMESTAMP_SQL("updated_at")} FROM target_desired) AS desired_updated_at,
       (SELECT pg_catalog.count(*)::text FROM target_entitlement) AS entitlement_count,
       (SELECT status FROM target_entitlement) AS entitlement_status,
       (SELECT ${TIMESTAMP_SQL("active_from")} FROM target_entitlement) AS entitlement_active_from,
       (SELECT ${TIMESTAMP_SQL("active_until")} FROM target_entitlement) AS entitlement_active_until,
       (SELECT ${TIMESTAMP_SQL("updated_at")} FROM target_entitlement) AS entitlement_updated_at,
       pg_catalog.jsonb_build_object(
         'pending', global_counts.pending,
         'retry_wait', global_counts.retry_wait,
         'processing', global_counts.processing,
         'dead_letter', global_counts.dead_letter,
         'non_applied', global_counts.non_applied,
         'unknown', global_counts.unknown,
         'desired_not_converged', global_counts.desired_not_converged,
         'managed_gate_mismatch', global_counts.managed_gate_mismatch
       ) AS global_counts
FROM global_counts`;

const FINANCE_FINAL_SQL = `WITH
${CATALOG_CT},
${SNAPSHOT_CT},
target_event AS (
  SELECT event.event_id,
         event.subject_digest,
         event.product_code,
         event.event_version,
         event.event_action,
         event.requested_active_until,
         event.event_occurred_at,
         event.profile_id,
         event.outcome,
         event.error_code,
         event.resulting_status,
         event.processed_at
  FROM public.finance_entitlement_subject_events_v2 AS event
  WHERE event.event_id = $1::uuid
),
target_binding AS (
  SELECT binding.subject_digest,
         binding.product_code,
         binding.profile_id,
         binding.last_event_version,
         binding.last_event_id,
         binding.last_action,
         binding.current_status,
         binding.active_until,
         binding.last_event_occurred_at,
         binding.updated_at
  FROM public.finance_entitlement_subject_bindings_v2 AS binding
  JOIN target_event AS event
    ON event.subject_digest = binding.subject_digest
   AND event.product_code = binding.product_code
),
target_entitlement AS (
  SELECT entitlement.profile_id,
         entitlement.product_code,
         entitlement.source,
         entitlement.status,
         entitlement.active_from,
         entitlement.active_until,
         entitlement.updated_at
  FROM public.finance_entitlements AS entitlement
  JOIN target_event AS event
    ON event.profile_id = entitlement.profile_id
   AND event.product_code = entitlement.product_code
  WHERE entitlement.source = 'architecture_main_v1'
),
target_auth_users AS (
  SELECT device.auth_user_id
  FROM public.finance_connected_devices AS device
  JOIN target_event AS event
    ON event.profile_id = device.profile_id
  UNION
  SELECT code_row.consumed_by_auth_user_id
  FROM public.finance_device_codes_v2 AS code_row
  JOIN target_event AS event
    ON event.profile_id = code_row.profile_id
   AND event.product_code = code_row.product_code
  WHERE code_row.consumed_by_auth_user_id IS NOT NULL
),
target_sessions AS (
  SELECT session.id,
         session.user_id
  FROM auth.sessions AS session
  WHERE session.user_id IN (
    SELECT auth_user_id
    FROM target_auth_users
  )
),
target_factors AS (
  SELECT factor.id
  FROM auth.mfa_factors AS factor
  WHERE factor.user_id IN (
    SELECT auth_user_id
    FROM target_auth_users
  )
),
target_flow_states AS (
  SELECT flow.id
  FROM auth.flow_state AS flow
  WHERE flow.user_id IN (
    SELECT auth_user_id
    FROM target_auth_users
  )
),
active_counts AS (
  SELECT
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_entitlements
      WHERE source = 'architecture_main_v1'
        AND status <> 'blocked') AS active_entitlements,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_device_codes_v2
      WHERE state = 'active') AS active_v2_codes,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_device_codes
      WHERE used_at IS NULL
        AND expires_at > pg_catalog.statement_timestamp()) AS active_legacy_codes,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_connected_devices
      WHERE revoked_at IS NULL) AS active_devices,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_device_code_issuer_requests
      WHERE outcome = 'pending') AS pending_issuer_requests,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_entitlement_apply_authorizations_v2) AS apply_authorizations,
    (SELECT pg_catalog.count(*)::text
       FROM public.finance_entitlement_rebind_authorizations_v2) AS rebind_authorizations,
    (SELECT pg_catalog.count(*)::text
       FROM auth.sessions AS session
      WHERE session.user_id IN (SELECT auth_user_id FROM target_auth_users)
    ) AS auth_sessions,
    (SELECT pg_catalog.count(*)::text
       FROM auth.refresh_tokens AS token
      WHERE token.session_id IN (SELECT id FROM target_sessions)
         OR token.user_id::text IN (
           SELECT auth_user_id::text
           FROM target_auth_users
         )) AS refresh_tokens,
    (SELECT pg_catalog.count(*)::text
       FROM auth.mfa_amr_claims AS claim
      WHERE claim.session_id IN (SELECT id FROM target_sessions)
    ) AS mfa_amr_claims,
    (SELECT pg_catalog.count(*)::text
       FROM auth.one_time_tokens AS token
      WHERE token.user_id IN (SELECT auth_user_id FROM target_auth_users)
    ) AS one_time_tokens,
    (SELECT pg_catalog.count(*)::text
       FROM auth.mfa_challenges AS challenge
      WHERE challenge.factor_id IN (SELECT id FROM target_factors)
    ) AS mfa_challenges,
    (SELECT pg_catalog.count(*)::text
       FROM auth.flow_state AS flow
      WHERE flow.user_id IN (SELECT auth_user_id FROM target_auth_users)
    ) AS flow_states,
    (SELECT pg_catalog.count(*)::text
       FROM auth.saml_relay_states AS relay
      WHERE relay.flow_state_id IN (SELECT id FROM target_flow_states)
    ) AS saml_relay_states
)
SELECT CURRENT_USER::text AS database_role,
       ${DATABASE_CLOCK_SQL} AS database_clock,
       catalog_proof.table_count AS catalog_table_count,
       catalog_proof.catalog_sha256,
       preservation_proof.table_count AS manifest_table_count,
       preservation_proof.manifest_sha256,
       preservation_proof.preservation_snapshot,
       (SELECT pg_catalog.count(*)::text FROM target_event) AS event_count,
       (SELECT event_id::text FROM target_event) AS event_id,
       (SELECT pg_catalog.encode(subject_digest, 'hex') FROM target_event) AS subject_digest,
       (SELECT product_code FROM target_event) AS product_code,
       (SELECT event_version::text FROM target_event) AS event_version,
       (SELECT event_action FROM target_event) AS event_action,
       (SELECT ${TIMESTAMP_SQL("requested_active_until")} FROM target_event) AS requested_active_until,
       (SELECT ${TIMESTAMP_SQL("event_occurred_at")} FROM target_event) AS event_occurred_at,
       (SELECT profile_id::text FROM target_event) AS profile_id,
       (SELECT outcome FROM target_event) AS outcome,
       (SELECT error_code FROM target_event) AS error_code,
       (SELECT resulting_status FROM target_event) AS resulting_status,
       (SELECT ${TIMESTAMP_SQL("processed_at")} FROM target_event) AS processed_at,
       (SELECT pg_catalog.count(*)::text FROM target_binding) AS binding_count,
       (SELECT profile_id::text FROM target_binding) AS binding_profile_id,
       (SELECT last_event_version::text FROM target_binding) AS binding_last_event_version,
       (SELECT last_event_id::text FROM target_binding) AS binding_last_event_id,
       (SELECT last_action FROM target_binding) AS binding_last_action,
       (SELECT current_status FROM target_binding) AS binding_current_status,
       (SELECT ${TIMESTAMP_SQL("active_until")} FROM target_binding) AS binding_active_until,
       (SELECT ${TIMESTAMP_SQL("last_event_occurred_at")} FROM target_binding) AS binding_last_event_occurred_at,
       (SELECT ${TIMESTAMP_SQL("updated_at")} FROM target_binding) AS binding_updated_at,
       (SELECT pg_catalog.count(*)::text FROM target_entitlement) AS entitlement_count,
       (SELECT status FROM target_entitlement) AS entitlement_status,
       (SELECT ${TIMESTAMP_SQL("active_from")} FROM target_entitlement) AS entitlement_active_from,
       (SELECT ${TIMESTAMP_SQL("active_until")} FROM target_entitlement) AS entitlement_active_until,
       (SELECT ${TIMESTAMP_SQL("updated_at")} FROM target_entitlement) AS entitlement_updated_at,
       (SELECT pg_catalog.count(*)::text FROM target_auth_users) AS target_auth_user_count,
       pg_catalog.jsonb_build_object(
         'active_entitlements', active_counts.active_entitlements,
         'active_v2_codes', active_counts.active_v2_codes,
         'active_legacy_codes', active_counts.active_legacy_codes,
         'active_devices', active_counts.active_devices,
         'pending_issuer_requests', active_counts.pending_issuer_requests,
         'apply_authorizations', active_counts.apply_authorizations,
         'rebind_authorizations', active_counts.rebind_authorizations,
         'auth_sessions', active_counts.auth_sessions,
         'refresh_tokens', active_counts.refresh_tokens,
         'mfa_amr_claims', active_counts.mfa_amr_claims,
         'one_time_tokens', active_counts.one_time_tokens,
         'mfa_challenges', active_counts.mfa_challenges,
         'flow_states', active_counts.flow_states,
         'saml_relay_states', active_counts.saml_relay_states
       ) AS active_counts
FROM catalog_proof
CROSS JOIN preservation_proof
CROSS JOIN active_counts`;

export const STAGING_REVOKE_SQL = Object.freeze({
  financeBaseline: FINANCE_BASELINE_SQL,
  mainFinal: MAIN_FINAL_SQL,
  financeFinal: FINANCE_FINAL_SQL,
});

export const STAGING_REVOKE_SQL_SHA256 = Object.freeze({
  financeBaseline:
    "ac80bd5c8c30789d73ff9b5fa92d5cfb7ec9e7884ba638066b72b96052dac28c",
  mainFinal:
    "fe9d65115ef53966770503a03db58f26493e29ae3fc0b2d8d9c7550c75c214e1",
  financeFinal:
    "319a776c0ef819e2d897ec23002c93269a32a4e23d8b27063cff86a703162803",
});

for (const [queryId, query] of Object.entries(STAGING_REVOKE_SQL)) {
  if (sha256(query) !== STAGING_REVOKE_SQL_SHA256[queryId]) {
    fail(`compiled ${queryId} SQL hash differs`);
  }
}

function assertBoundary(projectRef) {
  if (
    ![
      STAGING_REVOKE_BOUNDARY.financeProjectRef,
      STAGING_REVOKE_BOUNDARY.mainProjectRef,
    ].includes(projectRef)
    || STAGING_REVOKE_BOUNDARY.productionDenyRefs.includes(projectRef)
  ) fail("project ref is outside the exact staging boundary");
}

async function boundedBody(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    fail("Management API response body differs");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        fail("Management API response stream differs");
      }
      length += value.byteLength;
      if (length > MAXIMUM_RESPONSE_BYTES) {
        await reader.cancel();
        fail("Management API response exceeds the reviewed limit");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Staging revoke live proof refused:")
    ) throw error;
    fail("Management API response read failed");
  }
  const bytes = Buffer.concat(chunks.map(chunk =>
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes) || source.includes("\0")) {
    fail("Management API response encoding differs");
  }
  return Object.freeze({ bytes, source });
}

async function executeReadOnlyQuery({
  projectRef,
  queryId,
  query,
  parameters,
  accessToken,
  fetchImpl,
}) {
  assertBoundary(projectRef);
  if (
    typeof accessToken !== "string"
    || accessToken.length < 20
    || /[\s\u007f]/u.test(accessToken)
  ) fail("Management API access token differs");
  if (typeof fetchImpl !== "function") {
    fail("Management API fetch dependency differs");
  }
  if (
    typeof query !== "string"
    || query !== STAGING_REVOKE_SQL[queryId]
    || sha256(query) !== STAGING_REVOKE_SQL_SHA256[queryId]
    || !Array.isArray(parameters)
  ) fail("pinned read-only SQL contract differs");
  const endpointPath = `/v1/projects/${projectRef}${READ_ONLY_ENDPOINT_SUFFIX}`;
  const url = `${MANAGEMENT_API_ORIGIN}${endpointPath}`;
  const body = canonicalJson({ parameters, query });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("query timeout", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  let raw;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const contentType = response?.headers?.get?.("content-type")?.toLowerCase()
      ?? "";
    if (
      response?.status !== 201
      || response.redirected !== false
      || ![
        "application/json",
        "application/json; charset=utf-8",
      ].includes(contentType)
    ) fail("Management API read-only response boundary differs");
    raw = await boundedBody(response);
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Staging revoke live proof refused:")
    ) throw error;
    fail("Management API read-only request failed");
  } finally {
    clearTimeout(timeout);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.source);
  } catch {
    fail("Management API response JSON differs");
  }
  if (
    !Array.isArray(parsed)
    || parsed.length !== 1
    || parsed[0] === null
    || typeof parsed[0] !== "object"
    || Array.isArray(parsed[0])
  ) fail("Management API must return exactly one row");
  return Object.freeze({
    queryId,
    projectRef,
    endpointPath,
    sqlSha256: STAGING_REVOKE_SQL_SHA256[queryId],
    parametersSha256: sha256(canonicalJson(parameters)),
    responseSha256: sha256(raw.bytes),
    canonicalResponseSha256: sha256(canonicalJson(parsed)),
    responseBytes: raw.bytes.byteLength,
    row: Object.freeze(parsed[0]),
  });
}

const CATALOG_KEYS = [
  "database_role",
  "database_clock",
  "catalog_table_count",
  "catalog_sha256",
  "manifest_table_count",
  "manifest_sha256",
  "preservation_snapshot",
];

function validateSnapshot(snapshot, label) {
  if (!Array.isArray(snapshot) || snapshot.length !== 129) {
    fail(`${label} table count differs`);
  }
  const normalized = snapshot.map((entry, index) => {
    exactKeys(entry, ["table", "rowCount", "contentSha256"], `${label} row`);
    if (
      entry.table !== PRESERVATION_MANIFEST.preservedTables[index]
      || !exactDecimal(entry.rowCount)
      || typeof entry.contentSha256 !== "string"
      || !SHA256.test(entry.contentSha256)
    ) fail(`${label} row differs`);
    return Object.freeze({ ...entry });
  });
  return Object.freeze(normalized);
}

function validateCatalogRow(row, expectedKeys, label) {
  exactKeys(row, expectedKeys, label);
  if (
    row.database_role !== EXPECTED_DATABASE_ROLE
    || !canonicalTimestamp(row.database_clock)
    || row.catalog_table_count !== EXPECTED_FINANCE_CATALOG_COUNT
    || row.catalog_sha256 !== EXPECTED_FINANCE_CATALOG_SHA256
    || row.manifest_table_count !== "129"
    || row.manifest_sha256 !== PRESERVATION_MANIFEST.manifestSha256
  ) fail(`${label} catalog contract differs`);
  return validateSnapshot(row.preservation_snapshot, `${label} snapshot`);
}

function queryEvidence(query, row, snapshot = null) {
  return Object.freeze({
    queryId: query.queryId,
    projectRef: query.projectRef,
    endpointPath: query.endpointPath,
    sqlSha256: query.sqlSha256,
    parametersSha256: query.parametersSha256,
    responseSha256: query.responseSha256,
    canonicalResponseSha256: query.canonicalResponseSha256,
    responseBytes: query.responseBytes,
    databaseClock: row.database_clock,
    result: Object.freeze({ ...row }),
    snapshotSha256: snapshot === null
      ? null
      : sha256(canonicalJson(snapshot)),
  });
}

function validateStoredQueryEvidence(value, {
  queryId,
  projectRef,
  parameters,
  snapshot = null,
}) {
  exactKeys(value, [
    "queryId",
    "projectRef",
    "endpointPath",
    "sqlSha256",
    "parametersSha256",
    "responseSha256",
    "canonicalResponseSha256",
    "responseBytes",
    "databaseClock",
    "result",
    "snapshotSha256",
  ], `stored ${queryId} query`);
  const expectedSnapshotSha256 = snapshot === null
    ? null
    : sha256(canonicalJson(snapshot));
  if (
    value.queryId !== queryId
    || value.projectRef !== projectRef
    || value.endpointPath
      !== `/v1/projects/${projectRef}${READ_ONLY_ENDPOINT_SUFFIX}`
    || value.sqlSha256 !== STAGING_REVOKE_SQL_SHA256[queryId]
    || value.parametersSha256 !== sha256(canonicalJson(parameters))
    || typeof value.responseSha256 !== "string"
    || !SHA256.test(value.responseSha256)
    || value.canonicalResponseSha256
      !== sha256(canonicalJson([value.result]))
    || !Number.isInteger(value.responseBytes)
    || value.responseBytes < 2
    || value.responseBytes > MAXIMUM_RESPONSE_BYTES
    || value.databaseClock !== value.result?.database_clock
    || value.snapshotSha256 !== expectedSnapshotSha256
  ) fail(`stored ${queryId} query contract differs`);
}

function validateMainRow(row, eventId) {
  const keys = [
    "database_role",
    "database_clock",
    "event_count",
    "outbox_event_id",
    "subject_digest",
    "outbox_version",
    "outbox_desired_state",
    "outbox_state",
    "outbox_created_at",
    "outbox_updated_at",
    "outbox_applied_at",
    "desired_count",
    "desired_last_event_id",
    "desired_version",
    "desired_state",
    "desired_applied_version",
    "desired_applied_state",
    "desired_applied_at",
    "desired_updated_at",
    "entitlement_count",
    "entitlement_status",
    "entitlement_active_from",
    "entitlement_active_until",
    "entitlement_updated_at",
    "global_counts",
  ];
  exactKeys(row, keys, "Main proof row");
  exactKeys(row.global_counts, [
    "pending",
    "retry_wait",
    "processing",
    "dead_letter",
    "non_applied",
    "unknown",
    "desired_not_converged",
    "managed_gate_mismatch",
  ], "Main global counts");
  if (
    row.database_role !== EXPECTED_DATABASE_ROLE
    || !canonicalTimestamp(row.database_clock)
    || row.event_count !== "1"
    || row.outbox_event_id !== eventId
    || typeof row.subject_digest !== "string"
    || !SHA256.test(row.subject_digest)
    || !exactDecimal(row.outbox_version)
    || row.outbox_version === "0"
    || row.outbox_desired_state !== "revoked"
    || row.outbox_state !== "applied"
    || !canonicalTimestamp(row.outbox_created_at)
    || !canonicalTimestamp(row.outbox_updated_at)
    || !canonicalTimestamp(row.outbox_applied_at)
    || row.desired_count !== "1"
    || row.desired_last_event_id !== eventId
    || row.desired_version !== row.outbox_version
    || row.desired_state !== "revoked"
    || row.desired_applied_version !== row.outbox_version
    || row.desired_applied_state !== "revoked"
    || !canonicalTimestamp(row.desired_applied_at)
    || !canonicalTimestamp(row.desired_updated_at)
    || row.entitlement_count !== "1"
    || row.entitlement_status !== "blocked"
    || row.entitlement_active_from !== null
    || row.entitlement_active_until !== null
    || !canonicalTimestamp(row.entitlement_updated_at)
    || !Object.values(row.global_counts).every(exactDecimal)
    || !allZero(row.global_counts)
  ) fail("Main revoke state differs");
  const created = Date.parse(row.outbox_created_at);
  const applied = Date.parse(row.outbox_applied_at);
  const databaseClock = Date.parse(row.database_clock);
  if (
    created > applied
    || applied > databaseClock
    || row.outbox_applied_at !== row.desired_applied_at
    || row.outbox_updated_at !== row.outbox_applied_at
    || row.desired_updated_at !== row.desired_applied_at
    || Date.parse(row.entitlement_updated_at) > databaseClock
  ) fail("Main revoke lifecycle differs");
  return Object.freeze({ ...row, global_counts: Object.freeze({ ...row.global_counts }) });
}

function validateFinanceRow(row, eventId) {
  const keys = [
    ...CATALOG_KEYS,
    "event_count",
    "event_id",
    "subject_digest",
    "product_code",
    "event_version",
    "event_action",
    "requested_active_until",
    "event_occurred_at",
    "profile_id",
    "outcome",
    "error_code",
    "resulting_status",
    "processed_at",
    "binding_count",
    "binding_profile_id",
    "binding_last_event_version",
    "binding_last_event_id",
    "binding_last_action",
    "binding_current_status",
    "binding_active_until",
    "binding_last_event_occurred_at",
    "binding_updated_at",
    "entitlement_count",
    "entitlement_status",
    "entitlement_active_from",
    "entitlement_active_until",
    "entitlement_updated_at",
    "target_auth_user_count",
    "active_counts",
  ];
  const snapshot = validateCatalogRow(row, keys, "Finance proof row");
  exactKeys(row.active_counts, [
    "active_entitlements",
    "active_v2_codes",
    "active_legacy_codes",
    "active_devices",
    "pending_issuer_requests",
    "apply_authorizations",
    "rebind_authorizations",
    "auth_sessions",
    "refresh_tokens",
    "mfa_amr_claims",
    "one_time_tokens",
    "mfa_challenges",
    "flow_states",
    "saml_relay_states",
  ], "Finance active counts");
  if (
    row.event_count !== "1"
    || row.event_id !== eventId
    || typeof row.subject_digest !== "string"
    || !SHA256.test(row.subject_digest)
    || row.product_code !== "architecture_finance"
    || !exactDecimal(row.event_version)
    || row.event_version === "0"
    || row.event_action !== "revoke"
    || row.requested_active_until !== null
    || !canonicalTimestamp(row.event_occurred_at)
    || typeof row.profile_id !== "string"
    || !UUID_V4.test(row.profile_id)
    || row.outcome !== "applied"
    || row.error_code !== null
    || row.resulting_status !== "blocked"
    || !canonicalTimestamp(row.processed_at)
    || row.binding_count !== "1"
    || row.binding_profile_id !== row.profile_id
    || row.binding_last_event_version !== row.event_version
    || row.binding_last_event_id !== eventId
    || row.binding_last_action !== "revoke"
    || row.binding_current_status !== "blocked"
    || row.binding_active_until !== null
    || row.binding_last_event_occurred_at !== row.event_occurred_at
    || !canonicalTimestamp(row.binding_updated_at)
    || row.entitlement_count !== "1"
    || row.entitlement_status !== "blocked"
    || !nullableTimestamp(row.entitlement_active_from)
    || !nullableTimestamp(row.entitlement_active_until)
    || !canonicalTimestamp(row.entitlement_updated_at)
    || !exactDecimal(row.target_auth_user_count)
    || row.target_auth_user_count === "0"
    || !Object.values(row.active_counts).every(exactDecimal)
    || !allZero(row.active_counts)
  ) fail("Finance revoke state differs");
  const occurred = Date.parse(row.event_occurred_at);
  const processed = Date.parse(row.processed_at);
  const clock = Date.parse(row.database_clock);
  if (
    occurred > processed
    || processed > clock
    || Date.parse(row.binding_updated_at) < processed
    || Date.parse(row.binding_updated_at) > clock
    || Date.parse(row.entitlement_updated_at) < occurred
    || Date.parse(row.entitlement_updated_at) > clock
  ) fail("Finance revoke lifecycle differs");
  return Object.freeze({
    ...row,
    active_counts: Object.freeze({ ...row.active_counts }),
    preservation_snapshot: snapshot,
  });
}

function validateProofFreshness(databaseClocks, now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("operator clock differs");
  }
  for (const value of databaseClocks) {
    const milliseconds = Date.parse(value);
    if (
      now.getTime() - milliseconds > MAXIMUM_PROOF_AGE_MS
      || milliseconds - now.getTime() > MAXIMUM_FUTURE_SKEW_MS
    ) fail("live proof database clock is stale or in the future");
  }
}

export async function captureLiveRevokeBaseline({
  eventId,
  accessToken,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof eventId !== "string" || !UUID_V4.test(eventId)) {
    fail("revoke event id must be UUIDv4");
  }
  const query = await executeReadOnlyQuery({
    projectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    queryId: "financeBaseline",
    query: STAGING_REVOKE_SQL.financeBaseline,
    parameters: [],
    accessToken,
    fetchImpl,
  });
  const snapshot = validateCatalogRow(
    query.row,
    CATALOG_KEYS,
    "Finance baseline row",
  );
  return Object.freeze({
    schemaVersion: 1,
    kind: "staging-revoke-live-baseline-v1",
    eventId,
    financeProjectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    preservationManifestSha256: PRESERVATION_MANIFEST.manifestSha256,
    preservationSnapshotSha256: sha256(canonicalJson(snapshot)),
    databaseClock: query.row.database_clock,
    query: queryEvidence(query, query.row, snapshot),
  });
}

export function validateLiveRevokeBaseline(value, eventId) {
  exactKeys(value, [
    "schemaVersion",
    "kind",
    "eventId",
    "financeProjectRef",
    "preservationManifestSha256",
    "preservationSnapshotSha256",
    "databaseClock",
    "query",
  ], "live revoke baseline");
  if (
    value.schemaVersion !== 1
    || value.kind !== "staging-revoke-live-baseline-v1"
    || value.eventId !== eventId
    || value.financeProjectRef !== STAGING_REVOKE_BOUNDARY.financeProjectRef
    || value.preservationManifestSha256 !== PRESERVATION_MANIFEST.manifestSha256
    || typeof value.preservationSnapshotSha256 !== "string"
    || !SHA256.test(value.preservationSnapshotSha256)
    || !canonicalTimestamp(value.databaseClock)
    || value.query?.databaseClock !== value.databaseClock
  ) fail("live revoke baseline contract differs");
  const snapshot = validateCatalogRow(
    value.query.result,
    CATALOG_KEYS,
    "stored Finance baseline row",
  );
  validateStoredQueryEvidence(value.query, {
    queryId: "financeBaseline",
    projectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    parameters: [],
    snapshot,
  });
  if (
    sha256(canonicalJson(snapshot)) !== value.preservationSnapshotSha256
    || value.query.snapshotSha256 !== value.preservationSnapshotSha256
  ) fail("stored Finance baseline hash differs");
  return Object.freeze(value);
}

export async function verifyLiveRevoke({
  eventId,
  baseline,
  accessToken,
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  validateLiveRevokeBaseline(baseline, eventId);
  const mainAQuery = await executeReadOnlyQuery({
    projectRef: STAGING_REVOKE_BOUNDARY.mainProjectRef,
    queryId: "mainFinal",
    query: STAGING_REVOKE_SQL.mainFinal,
    parameters: [eventId],
    accessToken,
    fetchImpl,
  });
  const mainA = validateMainRow(mainAQuery.row, eventId);
  const financeQuery = await executeReadOnlyQuery({
    projectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    queryId: "financeFinal",
    query: STAGING_REVOKE_SQL.financeFinal,
    parameters: [eventId],
    accessToken,
    fetchImpl,
  });
  const finance = validateFinanceRow(financeQuery.row, eventId);
  const mainBQuery = await executeReadOnlyQuery({
    projectRef: STAGING_REVOKE_BOUNDARY.mainProjectRef,
    queryId: "mainFinal",
    query: STAGING_REVOKE_SQL.mainFinal,
    parameters: [eventId],
    accessToken,
    fetchImpl,
  });
  const mainB = validateMainRow(mainBQuery.row, eventId);
  const { database_clock: _mainAClock, ...mainAState } = mainA;
  const { database_clock: _mainBClock, ...mainBState } = mainB;
  const mainStateSha256 = sha256(canonicalJson(mainAState));
  if (
    mainStateSha256 !== sha256(canonicalJson(mainBState))
    || mainA.subject_digest !== finance.subject_digest
    || mainA.outbox_version !== finance.event_version
    || mainA.outbox_created_at !== finance.event_occurred_at
    || baseline.preservationSnapshotSha256
      !== sha256(canonicalJson(finance.preservation_snapshot))
  ) fail("cross-project revoke proof differs");
  const baselineClock = Date.parse(baseline.databaseClock);
  const processed = Date.parse(finance.processed_at);
  const mainAClock = Date.parse(mainA.database_clock);
  const financeClock = Date.parse(finance.database_clock);
  const mainBClock = Date.parse(mainB.database_clock);
  if (
    !(baselineClock < processed)
    || processed > financeClock
    || mainAClock > financeClock
    || financeClock > mainBClock
  ) fail("cross-project revoke timing differs");
  validateProofFreshness(
    [mainA.database_clock, finance.database_clock, mainB.database_clock],
    now,
  );
  const queries = Object.freeze({
    mainA: queryEvidence(mainAQuery, mainA),
    finance: queryEvidence(
      financeQuery,
      finance,
      finance.preservation_snapshot,
    ),
    mainB: queryEvidence(mainBQuery, mainB),
  });
  return Object.freeze({
    schemaVersion: 1,
    kind: "staging-revoke-live-proof-v1",
    eventId,
    mainProjectRef: STAGING_REVOKE_BOUNDARY.mainProjectRef,
    financeProjectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    subjectDigest: mainA.subject_digest,
    eventVersion: mainA.outbox_version,
    baselineDatabaseClock: baseline.databaseClock,
    processedAt: finance.processed_at,
    verifiedAt: mainB.database_clock,
    preservationManifestSha256: PRESERVATION_MANIFEST.manifestSha256,
    preservationSnapshotSha256: baseline.preservationSnapshotSha256,
    mainStateSha256,
    queries,
  });
}

export function validateLiveRevokeProof(value, { baseline, eventId, now }) {
  exactKeys(value, [
    "schemaVersion",
    "kind",
    "eventId",
    "mainProjectRef",
    "financeProjectRef",
    "subjectDigest",
    "eventVersion",
    "baselineDatabaseClock",
    "processedAt",
    "verifiedAt",
    "preservationManifestSha256",
    "preservationSnapshotSha256",
    "mainStateSha256",
    "queries",
  ], "live revoke proof");
  if (
    value.schemaVersion !== 1
    || value.kind !== "staging-revoke-live-proof-v1"
    || value.eventId !== eventId
    || value.mainProjectRef !== STAGING_REVOKE_BOUNDARY.mainProjectRef
    || value.financeProjectRef !== STAGING_REVOKE_BOUNDARY.financeProjectRef
    || typeof value.subjectDigest !== "string"
    || !SHA256.test(value.subjectDigest)
    || !exactDecimal(value.eventVersion)
    || !canonicalTimestamp(value.baselineDatabaseClock)
    || !canonicalTimestamp(value.processedAt)
    || !canonicalTimestamp(value.verifiedAt)
    || value.preservationManifestSha256 !== PRESERVATION_MANIFEST.manifestSha256
    || !SHA256.test(value.preservationSnapshotSha256)
    || !SHA256.test(value.mainStateSha256)
  ) fail("live revoke proof contract differs");
  validateLiveRevokeBaseline(baseline, eventId);
  if (
    value.baselineDatabaseClock !== baseline.databaseClock
    || value.preservationSnapshotSha256
      !== baseline.preservationSnapshotSha256
  ) fail("live revoke proof baseline binding differs");
  exactKeys(value.queries, ["mainA", "finance", "mainB"], "live proof queries");
  const mainA = validateMainRow(value.queries.mainA.result, eventId);
  const finance = validateFinanceRow(value.queries.finance.result, eventId);
  const mainB = validateMainRow(value.queries.mainB.result, eventId);
  validateStoredQueryEvidence(value.queries.mainA, {
    queryId: "mainFinal",
    projectRef: STAGING_REVOKE_BOUNDARY.mainProjectRef,
    parameters: [eventId],
  });
  validateStoredQueryEvidence(value.queries.finance, {
    queryId: "financeFinal",
    projectRef: STAGING_REVOKE_BOUNDARY.financeProjectRef,
    parameters: [eventId],
    snapshot: finance.preservation_snapshot,
  });
  validateStoredQueryEvidence(value.queries.mainB, {
    queryId: "mainFinal",
    projectRef: STAGING_REVOKE_BOUNDARY.mainProjectRef,
    parameters: [eventId],
  });
  const { database_clock: _mainAClock, ...mainAState } = mainA;
  const { database_clock: _mainBClock, ...mainBState } = mainB;
  if (
    sha256(canonicalJson(mainAState)) !== value.mainStateSha256
    || sha256(canonicalJson(mainBState)) !== value.mainStateSha256
    || mainA.subject_digest !== value.subjectDigest
    || finance.subject_digest !== value.subjectDigest
    || mainA.outbox_version !== value.eventVersion
    || finance.event_version !== value.eventVersion
    || finance.processed_at !== value.processedAt
    || mainB.database_clock !== value.verifiedAt
    || sha256(canonicalJson(finance.preservation_snapshot))
      !== value.preservationSnapshotSha256
  ) fail("stored live revoke proof differs");
  const baselineClock = Date.parse(baseline.databaseClock);
  const processed = Date.parse(finance.processed_at);
  const mainAClock = Date.parse(mainA.database_clock);
  const financeClock = Date.parse(finance.database_clock);
  const mainBClock = Date.parse(mainB.database_clock);
  if (
    mainA.outbox_created_at !== finance.event_occurred_at
    || !(baselineClock < processed)
    || processed > financeClock
    || mainAClock > financeClock
    || financeClock > mainBClock
  ) fail("stored cross-project revoke timing differs");
  if (now !== null && now !== undefined) {
    validateProofFreshness(
      [mainA.database_clock, finance.database_clock, mainB.database_clock],
      now,
    );
  }
  return Object.freeze(value);
}
