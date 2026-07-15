-- DRAFT / NOT APPLIED / STAGING ONLY
-- Service-only exact Main Telegram subject resolver for Finance entitlement delivery.
--
-- The durable outbox stores only a Main user UUID and a keyed subject digest.
-- This boundary reads the already existing, Telegram-verified Main identity only
-- while a private worker is processing an event. It returns the bigint as text
-- so JavaScript can never round a high-range identifier.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL client_min_messages = warning;

DO $preflight$
DECLARE
  v_id_attribute smallint;
  v_telegram_attribute smallint;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance subject resolver preflight failed: migration must run as postgres.';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.architecture_finance_access_outbox') IS NULL
     OR to_regprocedure(
       'public.architecture_claim_finance_access_outbox_internal(uuid,text,integer)'
     ) IS NULL
     OR to_regprocedure('auth.role()') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance subject resolver preflight failed: reviewed Main outbox foundation is missing.';
  END IF;

  IF to_regprocedure(
    'public.architecture_resolve_finance_subject_internal(uuid)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance subject resolver already exists; this one-shot staging migration rejects drift and reruns.';
  END IF;

  SELECT attribute.attnum
  INTO v_id_attribute
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.users'::regclass
    AND attribute.attname = 'id'
    AND attribute.atttypid = 'uuid'::regtype
    AND attribute.attnotnull
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT attribute.attnum
  INTO v_telegram_attribute
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.users'::regclass
    AND attribute.attname = 'telegram_id'
    AND attribute.atttypid = 'bigint'::regtype
    AND attribute.attnotnull
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_id_attribute IS NULL OR v_telegram_attribute IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance subject resolver preflight failed: public.users identity columns drifted.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    WHERE index_row.indrelid = 'public.users'::regclass
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indpred IS NULL
      AND index_row.indexprs IS NULL
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = v_id_attribute
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    WHERE index_row.indrelid = 'public.users'::regclass
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indpred IS NULL
      AND index_row.indexprs IS NULL
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = v_telegram_attribute
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance subject resolver preflight failed: public.users identity uniqueness drifted.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance subject resolver preflight failed: service_role cannot use schema public.';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.architecture_resolve_finance_subject_internal(
  p_main_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_telegram_id text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;

  IF p_main_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  SELECT user_row.telegram_id::text
  INTO v_telegram_id
  FROM public.users AS user_row
  WHERE user_row.id = p_main_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'main_user_not_found');
  END IF;

  IF v_telegram_id !~ '^[1-9][0-9]{0,18}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'main_user_identity_invalid');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'main_user_id', p_main_user_id,
    'telegram_id', v_telegram_id
  );
END;
$function$;

ALTER FUNCTION public.architecture_resolve_finance_subject_internal(uuid)
OWNER TO postgres;

-- A Supabase project can define additional default function grants. Revoke
-- every ACL entry discovered from the catalog before granting the one intended
-- service boundary; a fixed role list would leave project-specific grantees
-- able to execute this SECURITY DEFINER function.
DO $acl_hardening$
DECLARE
  v_function regprocedure :=
    'public.architecture_resolve_finance_subject_internal(uuid)'::regprocedure;
  v_acl record;
  v_grantee_sql text;
BEGIN
  FOR v_acl IN
    SELECT DISTINCT exploded.grantee
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
    WHERE procedure.oid = v_function
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s CASCADE',
      v_function,
      v_grantee_sql
    );
  END LOOP;
END;
$acl_hardening$;

REVOKE ALL ON FUNCTION public.architecture_resolve_finance_subject_internal(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.architecture_resolve_finance_subject_internal(uuid)
TO service_role;

COMMENT ON FUNCTION public.architecture_resolve_finance_subject_internal(uuid) IS
  'Service-only resolver returning the existing verified Main Telegram bigint as an exact decimal string for Finance entitlement delivery.';

DO $postflight$
DECLARE
  v_function regprocedure :=
    'public.architecture_resolve_finance_subject_internal(uuid)'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_function
      AND procedure.prorettype = 'jsonb'::regtype
      AND procedure.pronargs = 1
      AND pg_catalog.oidvectortypes(procedure.proargtypes) = 'uuid'
      AND procedure.prosecdef
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND NOT procedure.proleakproof
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance subject resolver postflight failed: function metadata drifted.';
  END IF;

  IF EXISTS (
    WITH expected(grantee_name, grantor_name, privilege_type, is_grantable) AS (
      VALUES ('service_role', 'postgres', 'EXECUTE', false)
    ),
    actual AS (
      SELECT
        CASE
          WHEN exploded.grantee = 0 THEN 'PUBLIC'
          ELSE pg_catalog.pg_get_userbyid(exploded.grantee)
        END AS grantee_name,
        pg_catalog.pg_get_userbyid(exploded.grantor) AS grantor_name,
        exploded.privilege_type,
        exploded.is_grantable
      FROM pg_catalog.pg_proc AS procedure
      CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
      WHERE procedure.oid = v_function
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
    )
    WHERE expected.grantee_name IS NULL
       OR actual.grantee_name IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance subject resolver postflight failed: exact function ACL differs.';
  END IF;
END;
$postflight$;

COMMIT;
