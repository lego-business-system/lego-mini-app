#!/bin/sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
migration="$repo_root/supabase/migrations/20260714235900_finance_integration_foundation.sql"
expected_migration_sha256="01c8cf16ab237c8e0c746575169fdc0ce48af20a66c597d0d9e40360dce4bb09"

fail() {
  printf '%s\n' "finance integration draft validation failed: $1" >&2
  exit 1
}

[ -f "$migration" ] || fail "migration is missing"
if command -v shasum >/dev/null 2>&1; then
  migration_sha256=$(shasum -a 256 "$migration" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  migration_sha256=$(sha256sum "$migration" | awk '{print $1}')
else
  fail "no SHA-256 implementation is available"
fi
[ "$migration_sha256" = "$expected_migration_sha256" ] ||
  fail "migration bytes differ from the independently reviewed draft"
[ "$(rg -c '^BEGIN;$' "$migration")" = "1" ] || fail "migration must have one BEGIN"
[ "$(rg -c '^COMMIT;$' "$migration")" = "1" ] || fail "migration must have one COMMIT"
[ "$(rg -c '^CREATE OR REPLACE FUNCTION public\.' "$migration")" = "4" ] ||
  fail "reviewed function count changed"
[ "$(rg -c '^\$function\$;$' "$migration")" = "4" ] ||
  fail "function terminator count changed"
[ "$(rg -c 'ENABLE ROW LEVEL SECURITY;$' "$migration")" = "3" ] ||
  fail "all three integration tables must enable RLS"
[ "$(rg -c '^CREATE TABLE public\.architecture_' "$migration")" = "3" ] ||
  fail "reviewed table count changed"
[ "$(rg -c '^CREATE INDEX idx_architecture_' "$migration")" = "4" ] ||
  fail "reviewed index count changed"
[ "$(rg -c '^  CONSTRAINT architecture_' "$migration")" = "19" ] ||
  fail "reviewed constraint count changed"
[ "$(rg -c '^ALTER TABLE public\.architecture_.* OWNER TO postgres;$' "$migration")" = "3" ] ||
  fail "reviewed table ownership changed"
[ "$(rg -c '^VOLATILE$' "$migration")" = "4" ] || fail "function volatility changed"
[ "$(rg -c '^CALLED ON NULL INPUT$' "$migration")" = "4" ] || fail "function strictness changed"
[ "$(rg -c '^PARALLEL UNSAFE$' "$migration")" = "4" ] || fail "function parallel mode changed"
[ "$(rg -c '^NOT LEAKPROOF$' "$migration")" = "4" ] || fail "function leakproof mode changed"

rg -q '^-- DRAFT / NOT APPLIED / STAGING ONLY$' "$migration" ||
  fail "staging-only warning is missing"
rg -q 'architecture_product_entitlements' "$migration" ||
  fail "product entitlement source is missing"
rg -q 'architecture_finance_issue_replay_guard' "$migration" ||
  fail "replay guard is missing"
rg -Fq "coalesce(auth.role(), '') <> 'service_role'" "$migration" ||
  fail "service-only runtime guard is missing"
rg -q "product_code = 'architecture_finance'" "$migration" ||
  fail "exact Finance product constraint is missing"
rg -Fq 'octet_length(init_data_digest) = 32' "$migration" ||
  fail "initData pseudonym constraint is missing"
rg -Fq 'CHECK (attempt_count BETWEEN 1 AND 5)' "$migration" ||
  fail "bounded retry constraint is missing"
rg -Fq "v_recent_subject_requests >= 3" "$migration" ||
  fail "persistent subject rate limit is missing"
rg -Fq "v_table_count <> 0" "$migration" ||
  fail "one-shot table preflight is missing"
rg -Fq "v_function_count <> 0" "$migration" ||
  fail "one-shot function preflight is missing"
rg -Fq "current_user IS DISTINCT FROM 'postgres'" "$migration" ||
  fail "postgres execution-context preflight is missing"
rg -Fq 'DO $acl_hardening$' "$migration" ||
  fail "actual-grantee ACL cleanup is missing"
rg -Fq 'pg_catalog.aclexplode(relation.relacl)' "$migration" ||
  fail "relation ACL catalog inspection is missing"
rg -Fq 'pg_catalog.aclexplode(attribute.attacl)' "$migration" ||
  fail "column ACL catalog inspection is missing"
rg -Fq 'pg_catalog.aclexplode(procedure.proacl)' "$migration" ||
  fail "function ACL catalog inspection is missing"
rg -Fq 'the exact nineteen-constraint contract differs' "$migration" ||
  fail "exact constraint postflight is missing"
rg -Fq "'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true)" "$migration" ||
  fail "constraint mismatch diagnostics are missing"
rg -Fq "actual.connoinherit IS DISTINCT FROM (expected.constraint_type <> 'c')" "$migration" ||
  fail "constraint inheritance metadata contract is missing"
rg -Fq 'the exact four-index contract differs' "$migration" ||
  fail "exact index postflight is missing"
rg -Fq 'overloads or exact function metadata differ' "$migration" ||
  fail "exact function postflight is missing"
rg -Fq 'the exact two-trigger contract differs' "$migration" ||
  fail "exact trigger postflight is missing"
rg -Fq 'table or column ACL allow-list is not empty' "$migration" ||
  fail "exact table/column ACL postflight is missing"
rg -Fq 'exact function ACL allow-list differs' "$migration" ||
  fail "exact function ACL postflight is missing"
rg -q 'FROM PUBLIC, anon, authenticated, service_role;' "$migration" ||
  fail "table/function ACL hardening is missing"

if rg -q '^CREATE (TABLE|INDEX) IF NOT EXISTS|^DROP TABLE |^TRUNCATE TABLE |ALTER TABLE (ONLY )?public\.users|DISABLE ROW LEVEL SECURITY' "$migration"; then
  fail "migration contains a forbidden destructive or existing-user mutation"
fi
if rg -q '\btelegram_id\b|code_hash|raw_init_data|bot_token|issuer_hmac_secret' "$migration"; then
  fail "migration appears to store a raw identity, code or secret"
fi
if rg -q '\bAS[[:space:]]+(collation|constraint)\b' "$migration"; then
  fail "migration uses a PostgreSQL reserved parser keyword as an alias"
fi

printf '%s\n' "finance integration draft validation passed"
