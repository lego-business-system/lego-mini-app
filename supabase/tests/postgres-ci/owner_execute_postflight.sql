\set ON_ERROR_STOP on

DO $owner_execute_external_postflight$
DECLARE
  v_function regprocedure :=
    'public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure;
  v_acl_count integer;
BEGIN
  IF NOT pg_catalog.has_function_privilege('postgres', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Owner EXECUTE external postflight failed: owner cannot execute nested entitlement primitive.';
  END IF;

  IF pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Owner EXECUTE external postflight failed: external role can execute nested entitlement primitive.';
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
      MESSAGE = 'Owner EXECUTE external postflight failed: exact owner ACL count differs.';
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
      MESSAGE = 'Owner EXECUTE external postflight failed: unexpected nested entitlement primitive ACL exists.';
  END IF;
END;
$owner_execute_external_postflight$;
