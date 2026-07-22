#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
harness_dir="$repo_root/supabase/tests/postgres-ci"
foundation_migration="$repo_root/supabase/migrations/20260714235900_finance_integration_foundation.sql"
outbox_migration="$repo_root/supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql"
resolver_migration="$repo_root/supabase/migrations/20260715020000_finance_subject_resolver_v1.sql"
release_postflight="$repo_root/supabase/releases/main-finance-pilot-v1/postflight.sql"

readonly -a required_harness_files=(
  README.md
  behavior_smoke.sql
  bootstrap.sql
  catalog_fingerprint.sql
  outbox_behavior_smoke.sql
  outbox_postflight.sql
  postflight.sql
  resolver_behavior_smoke.sql
  resolver_postflight.sql
  run.sh
  static_guard.test.mjs
)

readonly -a forbidden_libpq_variables=(
  PGAPPNAME
  PGCHANNELBINDING
  PGCLIENTENCODING
  PGDATESTYLE
  PGGEQO
  PGGSSDELEGATION
  PGGSSENCMODE
  PGGSSLIB
  PGHOSTADDR
  PGKRBSRVNAME
  PGLOADBALANCEHOSTS
  PGLOCALEDIR
  PGMAXPROTOCOLVERSION
  PGMINPROTOCOLVERSION
  PGPASSFILE
  PGOPTIONS
  PGREQUIREPEER
  PGREQUIREAUTH
  PGREQUIRESSL
  PGREALM
  PGSERVICE
  PGSERVICEFILE
  PGSSLCERT
  PGSSLCERTMODE
  PGSSLCOMPRESSION
  PGSSLCRL
  PGSSLCRLDIR
  PGSSLKEY
  PGSSLMAXPROTOCOLVERSION
  PGSSLMINPROTOCOLVERSION
  PGSSLROOTCERT
  PGSSLNEGOTIATION
  PGSSLSNI
  PGSYSCONFDIR
  PGTARGETSESSIONATTRS
  PGREPLICATION
  PGTZ
)

fail() {
  printf '%s\n' "main-postgres-ci failed: $1" >&2
  exit 1
}

[[ "${CI:-}" == "true" ]] || fail "CI=true is required"
[[ "${MAIN_FINANCE_CI_ALLOW_EPHEMERAL:-}" == "1" ]] ||
  fail "MAIN_FINANCE_CI_ALLOW_EPHEMERAL=1 is required"
[[ "${PGHOST:-}" == "127.0.0.1" ]] ||
  fail "PGHOST must be exactly 127.0.0.1; remote databases are forbidden"
[[ "${PGDATABASE:-}" == "main_finance_ci" ]] ||
  fail "PGDATABASE must be main_finance_ci"
[[ "${PGUSER:-}" == "postgres" ]] || fail "PGUSER must be postgres"
[[ "${PGPASSWORD:-}" == "main-finance-ci-ephemeral-only" ]] ||
  fail "PGPASSWORD must be the fixed ephemeral CI credential"
[[ "${PGPORT:-}" =~ ^[0-9]{1,5}$ ]] ||
  fail "PGPORT must be an integer from 1 through 65535"
(( 10#$PGPORT >= 1 && 10#$PGPORT <= 65535 )) ||
  fail "PGPORT must be an integer from 1 through 65535"
[[ "${PGSSLMODE:-disable}" == "disable" ]] ||
  fail "PGSSLMODE must be disable for the local service"
[[ "${PGCONNECT_TIMEOUT:-}" == "5" ]] ||
  fail "PGCONNECT_TIMEOUT must be exactly 5"

for variable_name in "${forbidden_libpq_variables[@]}"; do
  [[ -z "${!variable_name:-}" ]] ||
    fail "$variable_name must be unset; libpq connection overrides are forbidden"
done

[[ -d "$harness_dir" && ! -L "$harness_dir" ]] ||
  fail "harness directory must be a real non-symlink directory"
for migration_path in "$foundation_migration" "$outbox_migration" "$resolver_migration"; do
  [[ -f "$migration_path" && ! -L "$migration_path" ]] ||
    fail "reviewed migration must be a regular non-symlink file"
done
[[ -f "$release_postflight" && ! -L "$release_postflight" ]] ||
  fail "hosted staging postflight must be a regular non-symlink file"
for relative_path in "${required_harness_files[@]}"; do
  path="$harness_dir/$relative_path"
  [[ -f "$path" && ! -L "$path" ]] ||
    fail "harness file must be a regular non-symlink file: $relative_path"
done
command -v psql >/dev/null 2>&1 || fail "psql is required"

psql_ci() {
  psql \
    -X \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --dbname="$PGDATABASE" \
    --username="$PGUSER" \
    --set=ON_ERROR_STOP=1 \
    --no-align \
    --tuples-only \
    "$@"
}

IFS='|' read -r actual_database actual_user server_port version_number < <(
  psql_ci --field-separator='|' --command="
    SELECT
      current_database(),
      session_user,
      inet_server_port(),
      current_setting('server_version_num');
  "
)

[[ "$actual_database" == "main_finance_ci" ]] ||
  fail "connected database is not main_finance_ci"
[[ "$actual_user" == "postgres" ]] || fail "session user is not postgres"
[[ "$server_port" == "5432" ]] ||
  fail "PostgreSQL service is not listening on its container port 5432"
[[ "$version_number" =~ ^[0-9]+$ ]] || fail "invalid server_version_num"
(( version_number >= 170000 && version_number < 180000 )) ||
  fail "PostgreSQL major 17 is required"

pristine_state="$(psql_ci --command="
  SELECT
    (SELECT count(*) FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'anon',
        'authenticated',
        'service_role',
        'main_finance_ci_unknown'
      )),
    (SELECT count(*) FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p', 'S', 'v', 'm')),
    (to_regnamespace('auth') IS NOT NULL)::integer;
")"
[[ "$pristine_state" == "0|0|0" ]] ||
  fail "database is not a pristine disposable PostgreSQL service"

apply_file() {
  local path=$1
  printf 'main-postgres-ci: applying %s\n' "${path#"$repo_root/"}"
  psql_ci --file="$path" >/dev/null
}

catalog_fingerprint() {
  psql_ci --file="$harness_dir/catalog_fingerprint.sql" | tr -d '[:space:]'
}

data_fingerprint() {
  psql_ci --command="
    SELECT md5(jsonb_build_object(
      'users', coalesce((
        SELECT jsonb_agg(to_jsonb(user_row) ORDER BY user_row.id)
        FROM public.users AS user_row
      ), '[]'::jsonb),
      'entitlements', coalesce((
        SELECT jsonb_agg(to_jsonb(entitlement_row)
          ORDER BY entitlement_row.subject_digest, entitlement_row.product_code)
        FROM public.architecture_product_entitlements AS entitlement_row
      ), '[]'::jsonb),
      'requests', coalesce((
        SELECT jsonb_agg(to_jsonb(request_row) ORDER BY request_row.request_id)
        FROM public.architecture_finance_issue_requests AS request_row
      ), '[]'::jsonb),
      'replay_guard', coalesce((
        SELECT jsonb_agg(to_jsonb(replay_row) ORDER BY replay_row.init_data_digest)
        FROM public.architecture_finance_issue_replay_guard AS replay_row
      ), '[]'::jsonb),
      'access_desired', coalesce((
        SELECT jsonb_agg(to_jsonb(desired_row)
          ORDER BY desired_row.main_user_id, desired_row.product_code)
        FROM public.architecture_finance_access_desired AS desired_row
      ), '[]'::jsonb),
      'access_outbox', coalesce((
        SELECT jsonb_agg(to_jsonb(outbox_row) ORDER BY outbox_row.event_id)
        FROM public.architecture_finance_access_outbox AS outbox_row
      ), '[]'::jsonb)
    )::text);
  " | tr -d '[:space:]'
}

apply_file "$harness_dir/bootstrap.sql"
apply_file "$foundation_migration"
apply_file "$harness_dir/postflight.sql"
apply_file "$harness_dir/behavior_smoke.sql"
apply_file "$harness_dir/postflight.sql"
apply_file "$outbox_migration"
apply_file "$harness_dir/outbox_postflight.sql"
apply_file "$resolver_migration"
apply_file "$harness_dir/resolver_postflight.sql"

psql_ci --command="
  CREATE SCHEMA supabase_migrations AUTHORIZATION postgres;
  CREATE TABLE supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text
  );
  INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
  VALUES
    ('20260714235900', ARRAY[]::text[], 'finance_integration_foundation'),
    ('20260715010000', ARRAY[]::text[], 'finance_entitlement_outbox_v1'),
    ('20260715020000', ARRAY[]::text[], 'finance_subject_resolver_v1'),
    ('20260722120000', ARRAY[]::text[], 'remote_schema');
  DELETE FROM public.users;
" >/dev/null
apply_file "$release_postflight"
psql_ci --command="
  DROP SCHEMA supabase_migrations CASCADE;
  INSERT INTO public.users (id, telegram_id)
  VALUES (
    '00000000-0000-4000-8000-000000000001'::uuid,
    9000000000000000001
  );
" >/dev/null

stable_catalog_fingerprint="$(catalog_fingerprint)"
stable_data_fingerprint="$(data_fingerprint)"
[[ "$stable_catalog_fingerprint" =~ ^[0-9a-f]{32}$ ]] ||
  fail "catalog fingerprint after first application is invalid"
[[ "$stable_data_fingerprint" =~ ^[0-9a-f]{32}$ ]] ||
  fail "data fingerprint after first application is invalid"

apply_file "$harness_dir/outbox_behavior_smoke.sql"
apply_file "$harness_dir/resolver_behavior_smoke.sql"
apply_file "$harness_dir/outbox_postflight.sql"
apply_file "$harness_dir/resolver_postflight.sql"

if psql_ci --command="
  SET ROLE authenticated;
  SET request.jwt.claim.role = 'authenticated';
  SELECT public.architecture_upsert_product_entitlement_internal(
    decode(repeat('aa', 32), 'hex'),
    'architecture_finance',
    'active'
  );
" >/dev/null 2>&1; then
  fail "authenticated unexpectedly executed the service-only entitlement RPC"
fi

if psql_ci --command="
  SET ROLE authenticated;
  SET request.jwt.claim.role = 'authenticated';
  SELECT public.architecture_set_finance_access_desired_internal(
    '79999999-9999-4999-8999-999999999999'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    decode(repeat('aa', 32), 'hex'),
    'granted',
    'system:unauthorized',
    'This call must fail',
    0
  );
" >/dev/null 2>&1; then
  fail "authenticated unexpectedly executed the service-only outbox RPC"
fi

if psql_ci --command="
  SET ROLE authenticated;
  SET request.jwt.claim.role = 'authenticated';
  SELECT public.architecture_get_finance_access_status_internal(
    '00000000-0000-4000-8000-000000000001'::uuid,
    NULL
  );
" >/dev/null 2>&1; then
  fail "authenticated unexpectedly executed the service-only Finance access status RPC"
fi

if psql_ci --command="
  SET ROLE service_role;
  SET request.jwt.claim.role = 'service_role';
  SELECT public.architecture_upsert_product_entitlement_internal(
    decode(repeat('aa', 32), 'hex'),
    'architecture_finance',
    'active'
  );
" >/dev/null 2>&1; then
  fail "service_role unexpectedly bypassed the outbox through legacy upsert"
fi

if psql_ci --command="
  SET ROLE authenticated;
  SET request.jwt.claim.role = 'authenticated';
  SELECT public.architecture_resolve_finance_subject_internal(
    '00000000-0000-4000-8000-000000000001'::uuid
  );
" >/dev/null 2>&1; then
  fail "authenticated unexpectedly executed the service-only subject resolver"
fi

if psql_ci --command="
  SET ROLE service_role;
  SET request.jwt.claim.role = 'service_role';
  SELECT count(*) FROM public.architecture_product_entitlements;
" >/dev/null 2>&1; then
  fail "service_role unexpectedly received direct integration-table access"
fi

if psql_ci --command="
  SET ROLE service_role;
  SET request.jwt.claim.role = 'service_role';
  SELECT count(*) FROM public.architecture_finance_access_outbox;
" >/dev/null 2>&1; then
  fail "service_role unexpectedly received direct outbox-table access"
fi

smoke_catalog_fingerprint="$(catalog_fingerprint)"
smoke_data_fingerprint="$(data_fingerprint)"
[[ "$smoke_catalog_fingerprint" == "$stable_catalog_fingerprint" ]] ||
  fail "catalog changed during rollback or access-denial smoke tests"
[[ "$smoke_data_fingerprint" == "$stable_data_fingerprint" ]] ||
  fail "data changed during rollback or access-denial smoke tests"

if foundation_retry_output="$(psql_ci --set=VERBOSITY=verbose --file="$foundation_migration" 2>&1)"; then
  fail "foundation one-shot migration unexpectedly accepted a second application"
fi
[[ "$foundation_retry_output" == *"55000"* ]] ||
  fail "rejected foundation retry did not report SQLSTATE 55000"
[[ "$foundation_retry_output" == *"integration tables already exist; this one-shot migration will not accept drift or reruns."* ]] ||
  fail "rejected foundation retry did not report the reviewed one-shot preflight error"

if outbox_retry_output="$(psql_ci --set=VERBOSITY=verbose --file="$outbox_migration" 2>&1)"; then
  fail "outbox one-shot migration unexpectedly accepted a second application"
fi
[[ "$outbox_retry_output" == *"55000"* ]] ||
  fail "rejected outbox retry did not report SQLSTATE 55000"
[[ "$outbox_retry_output" == *"Finance entitlement outbox objects already exist; this one-shot staging migration rejects drift and reruns."* ]] ||
  fail "rejected outbox retry did not report the reviewed one-shot preflight error"

if resolver_retry_output="$(psql_ci --set=VERBOSITY=verbose --file="$resolver_migration" 2>&1)"; then
  fail "resolver one-shot migration unexpectedly accepted a second application"
fi
[[ "$resolver_retry_output" == *"55000"* ]] ||
  fail "rejected resolver retry did not report SQLSTATE 55000"
[[ "$resolver_retry_output" == *"Finance subject resolver already exists; this one-shot staging migration rejects drift and reruns."* ]] ||
  fail "rejected resolver retry did not report the reviewed one-shot preflight error"

apply_file "$harness_dir/outbox_postflight.sql"
apply_file "$harness_dir/resolver_postflight.sql"
final_catalog_fingerprint="$(catalog_fingerprint)"
final_data_fingerprint="$(data_fingerprint)"
[[ "$final_catalog_fingerprint" == "$stable_catalog_fingerprint" ]] ||
  fail "catalog changed during the rejected migration retry"
[[ "$final_data_fingerprint" == "$stable_data_fingerprint" ]] ||
  fail "data changed during the rejected migration retry"

printf '%s\n' "main-postgres-ci passed on disposable PostgreSQL major 17"
