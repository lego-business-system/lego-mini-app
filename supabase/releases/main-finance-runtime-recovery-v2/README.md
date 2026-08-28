# Main Finance runtime recovery v2 — staging

## Current authority

`staging.manifest.json` is the release gate. It is now
`READY_FOR_SOURCE_ATTESTATION`: the successful read-only measurement has frozen
the exact database catalog SHA-256 together with the tracked release bytes,
deployment closure, workflow blob, changed-path set and tracked-file count.
The pre-commit `measure` path is therefore closed.
The same-SHA workflow guard is part of the exact eight-path successor delta: it
requires sole parent `a30dedf20e977d9794a8ac9e54abc48b076c9d45`, base tree
`92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf` and those eight paths only.

READY is not mutation approval. Before `plan` can proceed, the exact tracked state
must become the sole direct-child commit, a canonical owner-private provenance
file must bind that commit/tree to the remote branch and a successful same-SHA
GitHub Actions run, and the reviewed staging target must pass again. `apply`
then additionally requires the exact owner approval token bound to that fresh
plan. The only authorized hosted mutation is one exact three-name `secrets set`;
no Function deploy, retry or resume plan exists in schema 3. The successor
Finance verifier and authoritative live staging result
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
- `finance-manage-access-v2` is already the exact sole target addition in the
  imported 13-row Function baseline; deploy authority is absent;
- no migration, database write, `config push`, prune, all-functions deploy or
  production operation.

This secrets-only successor does not generate replacement random values. A fresh
successor plan adopts exactly the two generated values already sealed by the
exact pinned terminal predecessor bundle: the v2 operator secret and sync
trigger secret. It rebuilds all eleven stable runtime values from the fresh
successor commit, tree, manifest and snapshot. Full predecessor receipt-chain,
provenance, durable-bundle and owner-private device/inode validation completes
before either plaintext value is read; a second complete predecessor check
must remain identical after the new durable bundle is written. The old root is
read-only and remains terminal. Its terminal 13-row Function inventory must be
the exact target-v1 sole addition to the deterministic 12-row, all-existing
`version + 1` projection of the private predecessor bundle before adoption is
accepted. The operator never reads the
privacy key value locally, never prints it and never includes
`MAIN_FINANCE_PRIVACY_HMAC_KEY` in `secrets set`. Secret inventory evidence is
digest-only. The mutation file contains only
`MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA`,
`MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA` and
`MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256`. The two inherited generated
values and the remaining eight rebuilt stable values exist only in the private
13-row proof bundle and are never sent to `secrets set`.

Main inventory names and value digests must remain exact outside those three
source-bound rows. Only `updated_at` may differ, and only for the ordered exact
allowlist `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`,
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Finance is exact. Two complete
read rounds must be byte-identical before any state is accepted. Before any
successor runtime plaintext is read, the durable
successor bundle preinstall baseline is bound exactly to predecessor-terminal
Main `b98949ec772990f98b26471ed4e6ff4356d289709b51fd707419ffdbb1570139`,
stable Finance `89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e`
and the 13-row Function inventory
`ad7075e78470642d731f628e722efb2f498c31760148b362a6e51ce7225b17e1`.
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
   minutes. A fresh plan requires all four predecessor flags below and binds the
   exact pinned operational predecessor into both the durable bundle and plan.
   These flags are plan-only and all-or-none. A schema-3 plan is fresh and has
   exactly the `secrets-set` scope; it cannot be resumed or retried.
3. `apply` accepts the exact owner approval bound to Main ref, source commit,
   source tree, GitHub run ID, both provenance hashes and plan-receipt SHA. It
   requires that fresh scoped plan to be the latest receipt.
   The single mutation has a persisted intent first, then immediate TTL, live
   CI, full inventory and exact three-name local-input rechecks. It performs one
   `secrets set` and never calls `functions deploy`. An accepted verified result
   is followed immediately by a fresh D0/proof/D1 and `release-complete`.
4. `reconcile` never retries a mutation. It performs two complete read rounds.
   For an uncertain secret set it records observation, not causality:
   `installed_observed` / `state_satisfied` or `baseline_observed` /
   `state_unsatisfied`, always with `causalAttribution=false`; unstable or other
   state is `diverged`. `state_satisfied` is attested and finalized read-only.
   Both `state_unsatisfied` and `diverged` are terminal NO-GO for this successor:
   there is no automatic retry, fresh resume plan or Function deployment.
5. `verify` is the authoritative read-only consumer of a terminal completion.
   It re-reads the private bundle and frozen source, revalidates live GitHub
   authority and full hosted inventories, and obtains a new authenticated
   D0/proof/D1 sandwich. A `release-complete` JSON/hash chain by itself is
   persisted evidence, not deploy or GO authority.

The secret-set boundary has its own function-inventory phase contract. Two
complete post-call reads must be identical. Relative to the plan baseline, the
only accepted dispositions are `unchanged` or
`exact-all-existing-plus-one`: same function count and slugs, every version
either unchanged as a complete inventory or increased by exactly one for every
existing row, and every other key/value unchanged. Mixed, partial, `+2`,
missing/extra-row and non-version drift are terminally divergent. The observed
disposition and full inventory SHA-256 become the completion baseline.
D0/proof/D1, completion and later verify all use that exact complete baseline.
The target is already present and exact at version 1 in the imported baseline;
under the all-existing-plus-one disposition it is therefore version 2.

Every function row must contain canonical `id`, `name`, `slug`,
`ezbr_sha256`, `entrypoint_path`, `status`, `verify_jwt`, `version`,
`created_at` and `updated_at` fields. UUID/hash/path/timestamp types are
validated, `name` must equal `slug`, and every additional or future CLI field
is retained and compared exactly. A missing mandatory field, duplicate ID,
changed extra field or version that cannot be safely incremented is divergent.
`state_unsatisfied` is terminal even when both secret inventories and the
function inventory remain at the unchanged plan baseline. Preinstall secrets
combined with a `+1` function transition are `diverged`, never relabelled as a
safe retry state.

The recovery approval is one exact colon-delimited line:

The fresh successor `plan` additionally requires these four plan-only inputs:

```text
--prior-state-dir <exact owner-private predecessor state directory>
--prior-receipt-dir <exact owner-private predecessor receipt directory>
--prior-release-provenance <exact owner-private predecessor provenance file>
--prior-terminal-receipt-sha256 098731b6054f305cb4d211f5658122696400486947dfe31091e5abc937fada0e
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

The predecessor state directory, receipt directory and provenance file share a
separate real, owner-private `0700` predecessor root outside the repository.
The current and predecessor roots must be distinct and non-nested in both
directions. The READY manifest is checked first; then the current-root topology
and, for plan-only adoption, the predecessor-root topology are checked before
the operation lease or any runtime plaintext read. No plaintext, absolute path
or automatic-retry claim enters a receipt; only canonical identity and subject
hashes do.

```text
MAIN_FINANCE_RUNTIME_RECOVERY_V2_APPROVED=DEPLOY:<MAIN_REF>:<SOURCE_COMMIT>:<SOURCE_TREE>:<GITHUB_RUN_ID>:<PROVENANCE_FILE_SHA256>:<PROVENANCE_DESCRIPTOR_SHA256>:<PLAN_RECEIPT_SHA256>
```

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

No failed, interrupted or malformed CLI result is retried automatically. An
intent with no verified result, a non-success result, a post-call local-input
change or Supabase CLI home drift produces `unknown` and stops. Reconciliation
is read-only. Access reconciliation accepts an `unknown` receipt only when its
deterministic append-only `0600` intent file still exists and its canonical
bytes, inode/type/mode, file/content hashes, request/descriptor/plan/token-hash
bindings and causal timestamps all match. A self-rehashed receipt with a
missing, substituted or pre-plan intent has no authority.

Schema 3 has no resume scope. A verified secret result or a read-only
`state_satisfied` reconciliation may proceed only to fresh D0/proof/D1 and
completion. `state_unsatisfied` and `diverged` terminate the chain. Generated
secrets are never regenerated or rewritten. Unexpected
Supabase CLI home contents are retained as evidence; a later reconciled session
uses a new append-only owner-private recovery home and never cleans the old one.

## Canonical D0/proof/D1

`scripts/main-finance-runtime-recovery-v2-snapshot.mjs` is the sole reusable
Management query and descriptor builder for both recovery and the access
operator. It validates the exact SQL response, complete sorted desired rows,
entitlement cardinality, table/function ACLs, migrations and detailed ordered
column, constraint, index, trigger and empty-policy catalogs. READY mode requires
the measured catalog hash to equal the manifest pin.

Postflight order is strict:

1. full secret and function inventory plus canonical D0;
2. signed Edge `attest`, including a 13-digit millisecond timestamp and verified
   HMAC response;
3. full secret and function inventory plus canonical D1;
4. require `D0 clock < proof clock < D1 clock`, stable descriptor/state/catalog,
   byte-identical complete Main/Finance secret inventory fingerprints, exact
   held-bundle secret digests and the exact selected 13-row Function
   disposition, unchanged or all-existing-plus-one.

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
