-- MAIN FINANCE / SECURITY DEFININER NESTED EXECUTE ACL V1
-- Hosted PostgreSQL keeps the postgres project role non-superuser. The
-- outbox setter and finisher execute as postgres and call the legacy
-- entitlement primitive internally, so that owner needs one narrow EXECUTE
-- privilege. service_role remains unable to call the primitive directly.

BEGIN;

SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $preflight$
DECLARE
  v_function regprocedure :=
    'public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance nested EXECUTE correction requires postgres.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE procedure.oid = v_function
      AND namespace.nspname = 'public'
      AND procedure.proname = 'architecture_upsert_product_entitlement_internal'
      AND procedure.prosecdef
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
      AND pg_catalog.pg_get_function_identity_arguments(procedure.oid)
        = 'p_subject_digest bytea, p_product_code text, p_status text, p_active_from timestamp with time zone, p_active_until timestamp with time zone'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance nested EXECUTE correction refused: function contract differs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
    WHERE procedure.oid = v_function
      AND (
        pg_catalog.pg_get_userbyid(acl.grantee) IS DISTINCT FROM 'postgres'
        OR pg_catalog.pg_get_userbyid(acl.grantor) IS DISTINCT FROM 'postgres'
        OR acl.privilege_type IS DISTINCT FROM 'EXECUTE'
        OR acl.is_grantable
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance nested EXECUTE correction refused: unexpected function ACL exists.';
  END IF;

  IF pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance nested EXECUTE correction refused: external execution path exists.';
  END IF;
END;
$preflight$;

GRANT EXECUTE ON FUNCTION
  public.architecture_upsert_product_entitlement_internal(
    bytea,
    text,
    text,
    timestamp with time zone,
    timestamp with time zone
  )
TO postgres;

DO $postflight$
DECLARE
  v_function regprocedure :=
    'public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure;
  v_acl_count integer;
BEGIN
  IF NOT pg_catalog.has_function_privilege('postgres', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance nested EXECUTE correction failed: execution boundary differs.';
  END IF;

  SELECT count(*)
  INTO v_acl_count
  FROM pg_catalog.pg_proc AS procedure
  CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
  WHERE procedure.oid = v_function
    AND pg_catalog.pg_get_userbyid(acl.grantee) = 'postgres'
    AND pg_catalog.pg_get_userbyid(acl.grantor) = 'postgres'
    AND acl.privilege_type = 'EXECUTE'
    AND NOT acl.is_grantable;

  IF v_acl_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance nested EXECUTE correction failed: owner ACL differs.';
  END IF;
END;
$postflight$;

COMMIT;
