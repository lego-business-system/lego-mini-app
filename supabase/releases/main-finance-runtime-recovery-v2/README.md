# Main Finance runtime recovery v2 — staging

## Current authority

`staging.manifest.json` is the release gate. It is now
`READY_FOR_SOURCE_ATTESTATION`: the successful read-only measurement has frozen
the exact database catalog SHA-256 together with the tracked release bytes,
deployment closure, workflow blob, changed-path set and tracked-file count.
The pre-commit `measure` path is therefore closed.
The same-SHA workflow guard is part of the exact 13-path schema-4 successor
delta: it
requires sole parent `42c647aaeb3a6cededb49f073ac001678dcb3582`, base tree
`dd05940dbc3f06e8577a6406c6e64e470049c818` and these paths only:

- `.github/workflows/verify-finance-integration.yml`;
- `scripts/main-finance-runtime-recovery-v2-snapshot.mjs`;
- `scripts/manage-finance-access-v2.mjs`;
- `scripts/prepare-main-finance-runtime-recovery-v2.mjs`;
- `supabase/functions/finance-manage-access-v2/index.ts`;
- `supabase/releases/main-finance-runtime-recovery-v2/environment.contract.json`;
- `supabase/releases/main-finance-runtime-recovery-v2/postflight.contract.json`;
- `supabase/releases/main-finance-runtime-recovery-v2/README.md`;
- `supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json`;
- `supabase/tests/finance_integration_ci.test.mjs`;
- `supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs`;
- `supabase/tests/main_finance_runtime_secret_recovery_v2.test.mjs`;
- `supabase/tests/manage_finance_access_v2.test.mjs`.

READY is not mutation approval. Before `plan` can proceed, the exact tracked state
must become the sole direct-child commit, a canonical owner-private provenance
file must bind that commit/tree to the remote branch and a successful same-SHA
GitHub Actions run, and the reviewed staging target must pass again. `apply`
then additionally requires the exact owner approval token bound to that fresh
plan. Schema 4 authorizes exactly two separately planned and approved hosted
mutations: one exact four-name `secrets set`, followed by one exact target-only
replacement deploy of `finance-manage-access-v2`. Each stage requires a fresh
plan and a fresh owner approval. Neither stage may be retried automatically.
The successor Finance verifier and authoritative live staging result
remain downstream release gates; production remains outside this release.

The reviewed privileged-channel exact-token mechanism for the access
`--prepare`/`--execute` path and the original-request/unknown-receipt-bound
target reconcile snapshot builder remain mandatory. A self-hash is integrity
evidence, not owner authorization; the per-request token is issued only after
prepare.

An older Main hosted receipt does not authorize this successor mutation.
The tracked manifest intentionally has no expected final commit or tree field.
Its tracked `READY_FOR_SOURCE_ATTESTATION` form is complete and committable
before the sole direct-child commit is created. The post-commit provenance is
external evidence; neither its path nor its mutable live values enter Git.

## Exact boundary

- Main staging: `bljeoovhydhjhdzwplxh`;
- Finance staging: `makgsbjduobcphuqzaoq`;
- production deny: `soxtekhspohkddpdidvp`, `koibxwgtihwajocxfetb`;
- `finance-manage-access-v2` is already present in the immutable predecessor's
  13-row Function baseline; exactly one replacement deploy of this target is
  authorized, while all twelve non-target rows must remain exact;
- its ingress accepts only the exact public `/functions/v1/finance-manage-access-v2`
  and Supabase runtime-internal `/finance-manage-access-v2` paths; query,
  fragment, trailing-path and other-function variants fail closed;
- no migration, database write, `config push`, prune, all-functions deploy or
  production operation.

This schema-4 successor does not generate replacement random values. Its first
fresh successor plan adopts exactly the two generated values already sealed by the
exact pinned partial-secret predecessor bundle: the v2 operator secret and sync
trigger secret. It rebuilds all eleven stable runtime values from the fresh
successor deployment closure, commit, tree, manifest and snapshot. Full
predecessor receipt-chain,
provenance, durable-bundle and owner-private device/inode validation completes
before either plaintext value is read; a second complete predecessor check
must remain identical after the new durable bundle is written. The old root is
read-only and contains exactly three immutable receipts: plan, secret intent
and verified/state-satisfied secret effect. Its chain hash is
`ae7bfa301eb6ae13f10d59b5c010c3950fc7da72d8531b3a1be5b2d4d6b3204c`.
It has no completion receipt, is never completed by this successor and is never
used as deploy authority. Its successful source-CI receipt, provenance,
attestation, bundle commit, archive, runtime and hosted-inventory pins are all
validated before adoption. The operator never reads the
privacy key value locally, never prints it and never includes
`MAIN_FINANCE_PRIVACY_HMAC_KEY` in `secrets set`. Secret inventory evidence is
digest-only. The mutation file contains only
`MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256`,
`MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA`,
`MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA` and
`MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256`. The two inherited generated
values and the remaining seven rebuilt stable values exist only in the private
13-row proof bundle and are never sent to `secrets set`.

Main inventory names and value digests must remain exact outside those four
source-bound rows. Only `updated_at` may differ, and only for the ordered exact
allowlist `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`,
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Finance is exact. Two complete
read rounds must be byte-identical before any state is accepted. Before any
successor runtime plaintext is read, the durable
successor bundle preinstall baseline is bound exactly to predecessor preinstall
Main `b98949ec772990f98b26471ed4e6ff4356d289709b51fd707419ffdbb1570139`,
installed raw Main
`3cb8a92d36e5ef9ced75e21200339d9538d54ecce4de50703cf99ddb0cadfa37`,
installed semantic Main
`6ca2371545e0ec957e05ae64adf6cadf1dfda3f4618833b755bd783371d8352d`,
stable Finance `89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e`,
preinstall 13-row Function
`ad7075e78470642d731f628e722efb2f498c31760148b362a6e51ce7225b17e1`
and installed 13-row Function
`0efefe20bb441b2f5ce1eafd9fe401e47f4cea793c9e6fa834cc6fbc87afd936`.
That immutable bundle preinstall subject is distinct from stage-specific
current plan inventories after the successor `secrets-set` operation. For
pinned Supabase CLI 2.109.1, both operators request secret and
function inventories with legacy `--output json`: that renderer returns the raw
JSON arrays consumed by the strict parsers. The distinct `--output-format json`
renderer returns structured envelopes and is therefore forbidden at these five
inventory call sites.

## State machine

The direct CLI entrypoint in
`scripts/prepare-main-finance-runtime-recovery-v2.mjs` supports five modes.
Its effectful operator is module-private and runs only when
`import.meta.main === true`. Imports expose only synchronous pure hash,
canonical-validation, function-inventory and declarative-transition helpers;
they accept no process, filesystem, network, tool or callback authority.

1. `measure` runs the exact pinned SQL through Supabase Management API
   `/database/query/read-only`. It is valid only while the manifest is NOT READY
   and binds the manifest-declared source branch, exact base commit/tree and the
   complete dirty reviewed successor allowlist, including manifest/preflight
   bytes and the frozen Git/Node/Supabase CLI/archive boundary. It neither
   accepts nor reads the post-commit `--release-provenance` or `--gh-cli`;
   GitHub CLI and provenance evidence are required only by `plan`, `apply`,
   `reconcile` and `verify`. It emits only catalog hash, counts and a read-only
   receipt.
2. `plan` validates the clean direct-child source lineage, exact deployment
   closure, live same-SHA GitHub CI and branch ref, reviewed staging target,
   phase-specific secret/function inventories and canonical database snapshot.
   It creates one owner-private held bundle and a plan valid for at most four
   minutes. The initial fresh plan requires all five predecessor flags below and
   binds the exact pinned incomplete predecessor into both the durable bundle
   and plan. These flags are plan-only and all-or-none. Schema 4 requires two
   fresh plans in strict order: first exact four-name `secrets-set`, then exact
   target-only `function-deploy`. The second plan is issued only from verified
   or read-only reconciled secret-stage evidence; neither plan is a retry.
3. `apply` accepts the exact owner approval bound to Main ref, source commit,
   source tree, GitHub run ID, both provenance hashes and plan-receipt SHA. It
   requires that fresh scoped plan to be the latest receipt.
   Each of the two stages has its own persisted intent, immediate TTL, live CI,
   full inventory and local-input rechecks. The first owner approval authorizes
   exactly one four-name `secrets set`. The second, independently reviewed
   owner approval authorizes exactly one replacement deploy of
   `finance-manage-access-v2`. A verified deploy result requires its own fresh
   D0/proof/D1 sandwich. Release completion then requires a second, distinct
   fresh D0/proof/D1 sandwich before `release-complete`.
4. `reconcile` never retries a mutation. It performs two complete read rounds.
   For an uncertain secret set or target deploy it records observation, not
   causality: `installed_observed` / `state_satisfied` or
   `baseline_observed` / `state_unsatisfied`, always with
   `causalAttribution=false`; unstable or other state is `diverged`.
   `state_satisfied` advances only through the same required fresh downstream
   plan or completion proof, read-only. `state_unsatisfied` and `diverged` are
   terminal NO-GO for this exact successor. No mutation is automatically
   retried and no owner approval is reused.
5. `verify` is the authoritative read-only consumer of a terminal completion.
   It re-reads the private bundle and frozen source, revalidates live GitHub
   authority and full hosted inventories, and obtains a new authenticated
   D0/proof/D1 sandwich. A `release-complete` JSON/hash chain by itself is
   persisted evidence, not deploy or GO authority.

`hostedMutationCount` and `functionDeployCount` are cumulative counts of
mutation invocation attempts proved by the receipt-chain prefix, not counts of
successful effects and not action-local counters. An `unknown` receipt with
`invocationAttempted=true` increments the corresponding count; `not_invoked`
and `invocation_unproven` do not. The exact progression is: initial plan and
secret intent `0/0`; attempted secret result or reconciliation `1/0`; deploy
plan, deploy intent and any pre-invocation terminal `1/0`; attempted deploy
result or reconciliation and release completion `2/1`. A later receipt may
never erase or decrement an earlier proved attempt.

The two mutation boundaries share one exact full-inventory contract. Two
complete read rounds must be identical at every plan and result boundary. The
secret stage may change only the four ordered source-bound Main rows:
deployment, commit, tree and manifest. Its Function inventory may remain
unchanged or show the exact platform-wide all-existing-rows version `+1`
transition already proved for a secrets update; every row and non-version field
must otherwise remain exact. The deploy stage may replace only
`finance-manage-access-v2`. Relative to the chain-bound deploy-plan target row,
its version must increase by exactly one and its replacement source fields must
match the successor deployment closure. No caller supplies or predicts an
absolute target version. Every non-target row and every additional field remain
exact. Unchanged target after a claimed deploy, any non-target change, target
`+2`, missing/extra rows, wrong closure or mixed inventory is terminally
divergent. The verified target-only disposition becomes the completion
baseline used by the distinct completion D0/proof/D1 and later `verify`.

Target source identity is proved independently of the Function inventory row.
After the replacement, the operator reads the Management API body endpoint
`/v1/projects/<MAIN_REF>/functions/finance-manage-access-v2/body` twice. Each
bounded multipart response must contain exactly four authored file parts and
one metadata part, with no duplicate or extra part. The four paths are
`functions/_shared/main-edge-runtime.ts`,
`functions/_shared/main-finance-protocol.mjs`,
`functions/finance-manage-access-v2/deno.json` and
`functions/finance-manage-access-v2/index.ts`; every byte digest and their
ordered aggregate must equal the manifest-pinned hosted closure. Metadata has
exactly `deployment_id`, `deno2_entrypoint_path`, `module_count`,
`compressed_size` and `original_size`; deployment ID binds the Main project,
target UUID and target version, entrypoint and module count are exact, and both
size fields are positive bounded transport observations. The two semantic
rounds must be identical. `hostedSourceClosureSha256` is source authority;
`hostedSourceMetadataSha256` records the stable observed deployment envelope.
Multipart file MIME labels, optional HTTP `Content-Length` and the two size
values are transport sanity evidence, not an alternative source identity: the
exact path-and-byte closure remains authoritative.

Every function row must contain canonical `id`, `name`, `slug`,
`ezbr_sha256`, `entrypoint_path`, `status`, `verify_jwt`, `version`,
`created_at` and `updated_at` fields. UUID/hash/path/timestamp types are
validated, `name` must equal `slug`, and every additional or future CLI field
is retained and compared exactly. A missing mandatory field, duplicate ID,
changed extra field or version that cannot be safely incremented is divergent.
`state_unsatisfied` is terminal even when both secret inventories and the
function inventory remain at the unchanged plan baseline. Any function change
before the separately approved deploy stage other than the exact all-existing
version `+1` transition is `diverged`, never relabelled as a safe retry state.

The predecessor-adoption inputs and recovery approval are exact.

The initial fresh successor `plan` additionally requires these five plan-only
inputs:

```text
--prior-state-dir <exact owner-private predecessor state directory>
--prior-receipt-dir <exact owner-private predecessor receipt directory>
--prior-release-provenance <exact owner-private predecessor provenance file>
--prior-source-ci-receipt <exact owner-private predecessor source-CI receipt>
--prior-effect-receipt-sha256 1953ea7f1cb30b7a4de01f0cd8722e3798471f2ab864267c6853fa42298f6703
```

Every non-measure action (`plan`, `apply`, `reconcile`, `verify`) uses one new
current authority root outside the repository. That root is a real,
owner-private, non-symlink `0700` directory. `--receipt-dir` is its existing
direct-child, real, owner-private, non-symlink `0700` directory before the
lease. For a fresh plan, the normalized direct-child `--state-dir` path must be
absent; it is created owner-private `0700` only after the lease. Apply,
reconcile and verify require that state directory to already be a
real owner-private non-symlink `0700` directory. `--release-provenance`,
`--production-boundary` and `--target-config` are direct-child regular files;
each is owner-private `0600`, non-symlink and has exactly one hard link.
Splitting these five authority paths across parents or nesting them is refused.

The predecessor state directory, receipt directory, provenance file and
source-CI receipt share a separate real, owner-private `0700` predecessor root
outside the repository.
The current and predecessor roots must be distinct and non-nested in both
directions. The READY manifest is checked first; then the current-root topology
and, for plan-only adoption, the predecessor-root topology are checked before
the operation lease or any runtime plaintext read. No plaintext, absolute path
or automatic-retry claim enters a receipt; only canonical identity and subject
hashes do.

```text
MAIN_FINANCE_RUNTIME_RECOVERY_V2_APPROVED=DEPLOY:<MAIN_REF>:<SOURCE_COMMIT>:<SOURCE_TREE>:<GITHUB_RUN_ID>:<PROVENANCE_FILE_SHA256>:<PROVENANCE_DESCRIPTOR_SHA256>:<PLAN_RECEIPT_SHA256>
```

The same grammar is used twice, but the first and second tokens bind different
fresh plan-receipt hashes and stage scopes. A secret-stage token cannot
authorize the target deploy.

`PROVENANCE_FILE_SHA256` hashes the exact canonical UTF-8 JSON file bytes,
including its single terminal newline. `PROVENANCE_DESCRIPTOR_SHA256` hashes
the canonical descriptor fields without the descriptor hash itself. The file
cannot contain its own file hash. Both hashes, the commit/tree/run binding and
the plan receipt are rechecked before either persisted intent and again before
the corresponding CLI mutation.

The recovery inventory phase accepts only legacy Finance v1 disabled and either
the proven pre-restore vector (Finance v2 enabled, Telegram/Main gates disabled)
or the all-disabled compatibility vector. It preserves Finance v2 enabled. The
reusable snapshot API has a distinct access phase requiring Finance v2,
Telegram and both Main gates enabled while legacy v1 remains disabled.
Supported snapshot phases are exactly `recovery`, `access` and `reconcile`.
`reconcile` uses the exact access gate fingerprint; it is not a permissive
global exception. Its context is derived only from the original canonical
grant/revoke request plus that request's append-only `unknown` receipt. The
unknown receipt must resolve to its original latest prepare-plan bytes, hashes
and exact approval-token hash. That plan anchors both complete secret
inventories and the complete target/unrelated function inventory. The reviewed
pre-request rows remain the baseline: every non-target row, every catalog and
both complete inventories must remain exact. Only the target may be either the
exact successor event or the exact original row. The result is classified as
`absent`, `applied`, `nonterminal` or `wait`; zero legacy rows remain outside
this Stage-B recovery contract. `absent` and `nonterminal` produce a canonical
`0600` `NO_GO` observation, while `wait` produces the same bounded observation
with no execution authority. Only `applied` can produce a reconcile request and
owner token.

## Access prepare and execute

`scripts/manage-finance-access-v2.mjs` has three exclusive modes. `--plan` is
side-effect free. `--prepare` performs the live reads and writes a canonical
request; `--execute` sends only that reviewed request. There is no
`--approval-file`: a locally rehashed JSON file is never owner authority.

Every invocation supplies the compiled refs and deployment closure:

```text
--main-project-ref bljeoovhydhjhdzwplxh
--finance-project-ref makgsbjduobcphuqzaoq
--source-deployment-sha256 <64 lowercase hex>
```

The exact `--prepare` inputs are:

```text
--prepare --action status|grant|revoke
--source-commit-sha <40 lowercase hex>
--source-tree-sha <40 lowercase hex>
--descriptor-file <existing absolute 0600 owner-private descriptor>
--receipt-directory <existing absolute 0700 append-only directory>
--access-token-file <existing absolute 0600 Management token file>
--supabase-cli <compiled pinned Supabase CLI 2.109.1 path>
--supabase-home <new absolute owner-private directory path>
--output-directory <new absolute owner-private directory path>
--main-user-id <UUIDv4> --event-id <new UUIDv4>
```

The receipt directory, new output directory and new Supabase home must be
pairwise disjoint and non-nested; each new directory's parent must already be
an owner-private `0700` real directory.

`grant` and `revoke` additionally require `--changed-by <reviewed actor>`.
Reconcile replaces the three identity/actor flags with
`--original-request-file <canonical 0600 request>` and
`--unknown-receipt-file <matching append-only 0600 unknown receipt>`. The
identity, event, OCC version, actor and original plan are derived from those
two artifacts and cannot be supplied independently.

Access preparation consumes raw schema-4 release authority from the verified
recovery chain. For a target mutation, the expected Function version is derived
only from the chain-bound current target row and the exact target-only `+1`
replacement rule. There is no caller-supplied absolute target-version literal.

For status/grant/revoke, prepare takes evidence in the strict order
`F0 -> S0 -> D0 -> signed Edge attest -> S1 -> D1 -> F1`. The attestation
response is HMAC-verified, and the raw proof can be extracted only from the
privately branded proof/D0 pair. Complete function and secret inventories must
remain canonical and identical across the sandwich. Reconcile cannot perform a
global attestation over an intentionally nonterminal target; instead it uses
the narrower target-bound `F0 -> S0 -> D1 -> S1 -> F1` contract above.

Successful prepare creates only:

- a canonical `0600` request under the new output directory;
- a canonical append-only `0600` prepare-plan receipt, valid for no more than
  four minutes, under the receipt directory and bound to that directory's
  device/inode identity;
- an exact privileged-channel owner token template bound to action, both refs,
  source commit/tree/deployment, production and target descriptors, user,
  event, OCC version, action-plan hash, request-body hash, prepare-plan receipt
  hash and expiry millisecond.

Prepare publishes a plan only while holding the receipt directory's exclusive
fail-closed lease and only at a clock later than every existing append-only
plan. Execute holds that same lease from its first latest-plan read through the
terminal receipt. A concurrent prepare therefore cannot supersede the selected
plan between authorization and the hosted call; an occupied or stale lease
stops the operation before a new intent or plan is written.

There is no circular hash: the canonical request is finalized first, the plan
receipt hashes the request and action authority, and only then is the token
template formed from the immutable plan-receipt hash. Neither request nor plan
contains that token.

The token grammar is one exact colon-delimited line:

```text
MAIN_FINANCE_ACCESS_V2_APPROVED=<ACTION>:<MAIN_REF>:<FINANCE_REF>:<SOURCE_COMMIT>:<SOURCE_TREE>:<SOURCE_DEPLOYMENT_SHA256>:<PRODUCTION_BOUNDARY_SHA256>:<TARGET_DESCRIPTOR_SHA256>:<MAIN_USER_UUID>:<EVENT_UUID>:<EXPECTED_VERSION>:<ACTION_AUTHORITY_SHA256>:<REQUEST_BODY_SHA256>:<PLAN_RECEIPT_SHA256>:<EXPIRES_AT_MS>
```

The owner must return that exact token through the privileged approval channel.
It is explicit authorization of the reviewed request and latest plan, not a
hash that the local operator may put in a self-authored approval file. Execute
requires:

```text
--execute
--descriptor-file <same descriptor>
--request-file <prepare output>
--plan-receipt-file <latest unexpired prepare-plan receipt>
--receipt-directory <same append-only directory>
--owner-approval-token <exact privileged token>   # grant/revoke/reconcile only
--status-out <new absolute 0600 path>              # optional, status only
```

Before intent reservation or network access, execute re-reads the latest plan,
checks TTL, every boundary and request hash, OCC/event binding, action authority
and the exact token with constant-time comparison. A mutation/reconcile then
persists and fsyncs its append-only intent. It rechecks the live clock, TTL,
latest plan, directory identity and lease again after that fsync and immediately
before the hosted call. Terminal receipts take a fresh completion clock, so the
causal order is `plan.prepared_at <= intent.recorded_at <= receipt.recorded_at`.
Network uncertainty creates one `unknown` receipt and permanently forbids
automatic retry. Receipts contain only the approval-token hash and plan hashes,
never the token or raw proof.

The runtime-recovery CLI also holds one sibling `O_EXCL` operation lease for
the complete receipt-producing action. Any existing lease, including one whose
recorded owner is no longer running, fails closed with
`operation_lease_present`. The operator never deletes, renames or takes over
that file automatically. Recovery is a separate manual review: preserve the
lease bytes and receipt directories, establish that no operation remains live,
and resolve the lease outside this CLI before a new attempt.

The CLI child environment is constructed from a fixed locale, isolation flags
and the single Management access token; no ambient variable is inherited.
`HOME`, privacy HMAC keys, Supabase
service-role keys and sync-trigger secrets are not inherited or accepted as
operator inputs. Supabase runs only from the compiled path/hash/version pin,
with a new empty owner-private `0500` sealed home, telemetry disabled, and exact read-only
`functions list` / `secrets list` arguments. The isolated home is also the CLI
working directory, and keyring lookup is disabled, so repository `.env` files,
project-local state and ambient credentials are outside the child process.
The sealed home is checked before and after every Supabase invocation. The
pinned legacy telemetry writer therefore cannot create local state; any other
unexpected write or metadata change is an `unknown` outcome and is preserved
for explicit reconciliation rather than cleaned or retried.
Production refs remain compiled deny targets in all modes.

## Unknown outcomes and terminal reconciliation

No failed, interrupted or malformed mutation-capable Supabase CLI result is
retried automatically. An intent with no verified result, a non-success result,
a post-call local-input change or Supabase CLI home drift produces `unknown` and
stops. Reconciliation is read-only. Access reconciliation accepts an `unknown`
receipt only when its
deterministic append-only `0600` intent file still exists and its canonical
bytes, inode/type/mode, file/content hashes, request/descriptor/plan/token-hash
bindings and causal timestamps all match. A self-rehashed receipt with a
missing, substituted or pre-plan intent has no authority.

The sole transport exception is pre-receipt live source-CI attestation. Each
exact read-only GitHub `GET` may use at most three identical attempts with the
same endpoint, headers and isolated environment. The sealed GitHub XDG boundary
is checked before and after every attempt. Only an invoked non-success result or
a non-authority runner exception is eligible for another attempt. A local
authority refusal, config or XDG drift, `cliInvoked: false`, an oversized or
malformed successful response, and any valid response with the wrong semantics
are terminal without retry. This exception writes no receipt, invokes no
Supabase command, authorizes no hosted change and does not retry a mutation.

Schema 4 has no retry scope. A verified or read-only reconciled secret result
may proceed only through a new function-deploy plan and a new owner approval.
A verified or read-only reconciled deploy result may proceed only through its
required deploy-result sandwich and a distinct completion sandwich.
`state_unsatisfied` and `diverged` terminate the chain. Generated secrets are
never regenerated or rewritten. The immutable predecessor root remains exactly
its original three-receipt plan/intent/effect chain and is never given a
completion receipt. Unexpected
Supabase CLI home contents are retained as evidence; a later reconciled session
uses a new append-only owner-private recovery home and never cleans the old one.

## Canonical D0/proof/D1

`scripts/main-finance-runtime-recovery-v2-snapshot.mjs` is the sole reusable
Management query and descriptor builder for both recovery and the access
operator. It validates the exact SQL response, complete sorted desired rows,
entitlement cardinality, table/function ACLs, migrations and detailed ordered
column, constraint, index, trigger and empty-policy catalogs. READY mode requires
the measured catalog hash to equal the manifest pin.

Postflight order is strict and occurs twice after the target-only deploy: once
for the deploy result and once again, with distinct fresh snapshots and proof,
for completion.

1. full secret and function inventory plus canonical D0;
2. signed Edge `attest`, including a 13-digit millisecond timestamp and verified
   HMAC response;
3. full secret and function inventory plus canonical D1;
4. require `D0 clock < proof clock < D1 clock`, stable descriptor/state/catalog,
   byte-identical complete Main/Finance secret inventory fingerprints, exact
   held-bundle 13-row secret digests and the exact 13-row Function disposition:
   only `finance-manage-access-v2` replaced, relative version exactly `+1`, all
   non-target rows exact.

The deploy-result D0, proof and D1 cannot be reused as the completion D0, proof
or D1. Completion revalidates live source-CI authority, all inventories and the
same target-only successor state before a release-complete receipt is written.

Both snapshots and the verified proof are privately branded by the builder;
caller-fabricated D0, D1 or proof objects are rejected. The raw
`attestation_proof` is available only through
`extractMainFinanceRuntimeRecoveryVerifiedAttestationProof({ proof, d0 })`
after HMAC verification and hash rebinding. It may enter an owner-private
request but never a receipt or stdout.

Recovery completion receipts contain only hashes, counts, clocks and source
lineage. The owner-private access prepare plan additionally carries the exact
Main user/event UUIDs and OCC version needed for review. No receipt contains a
secret value, request signature, raw proof, subject digest, Telegram identifier
or desired-row payload.

## Local and tool boundary

State and receipt roots are absolute, disjoint, non-nested owner-private `0700`
directories outside the repository and are durably bound by path/device/inode.
Receipt writes use a `0600` pending record, file fsync, atomic rename and
receipt-directory fsync; a safe zero/partial trailing pending record is retained
under an append-only invalid-evidence name, while unsafe metadata fails closed.
The private bundle uses a marker-last durable commit after file and bottom-up
directory fsync. Runtime env and recursive deploy-workdir
inventories bind type, mode, device, inode, link count, size, mtime, ctime and
SHA-256 and are rechecked immediately before and after each CLI mutation. Extra
files, directories, symlinks and hardlinks are rejected.

Git, bundled Node 24.14.0, Supabase CLI 2.109.1 plus its archive, and gh 2.97.0
are pinned by exact path/version/SHA in the manifest and compiled constants.
The reviewed Supabase executable is copied and fsynced once into a sealed
owner-private `0500` directory, bound into the durable bundle, and only that
copy receives the access-token environment and mutation arguments.
Canonical owner-private provenance supplies the post-commit expected
commit/tree, remote ref and GitHub run ID. Its raw file hash and independent
descriptor hash are copied into each release plan, exact owner approval and
terminal completion. It cannot define tool or CI authority by itself: the
operator still re-derives Git bytes, live remote/ref and same-SHA successful CI.
Supabase receives no ambient `HOME`; it uses an empty owner-private `0500`
`SUPABASE_HOME`, telemetry disabled and `DO_NOT_TRACK=1`. GitHub uses the
validated owner-private `GH_CONFIG_DIR`, no ambient `HOME`, telemetry and update
notifications disabled, and three separate empty owner-private `0500`
`XDG_STATE_HOME`, `XDG_CACHE_HOME` and `XDG_DATA_HOME` directories. Their
metadata and emptiness are checked before and after every GitHub CLI call. The
source commit, tree, remote binding and clean status are then re-read after the
complete live CI attestation and must match the pre-CI snapshot. Any XDG drift
stops the current operation and remains preserved. A later explicit
reconciliation may select one new append-only sealed XDG generation, while all
calls inside that reconciliation remain bound to that single generation.

## CI and downstream handoff

The existing integration workflow discovers the dedicated Node tests through
its frozen test closure; no separate recovery-only CI step is required. The
same workflow verifies the frozen Deno graph. The final Main completion exposes
the sole parent, exact changed paths, external-provenance file/descriptor
hashes, commit/tree, workflow blob/live CI hashes, deployment closure/archive
hashes and hosted evidence needed by an additive Finance successor verifier.
Finance must consume the authoritative `verify` result; the legacy Main receipt
alone is insufficient.
