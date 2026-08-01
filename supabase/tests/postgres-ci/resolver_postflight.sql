\set ON_ERROR_STOP on

DO $resolver_external_postflight$
DECLARE
  v_function regprocedure :=
    'public.architecture_resolve_finance_subject_internal(uuid)'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_function
      AND procedure.prorettype = 'jsonb'::regtype
      AND pg_catalog.oidvectortypes(procedure.proargtypes) = 'uuid'
      AND procedure.prosecdef
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND NOT procedure.proleakproof
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Resolver external postflight failed: exact function metadata differs.';
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
      MESSAGE = 'Resolver external postflight failed: exact function ACL differs.';
  END IF;
END;
$resolver_external_postflight$;
