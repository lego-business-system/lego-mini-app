-- MAIN FINANCE / SECURITY DEFINER OWNER ACL V1
-- Additive, idempotent correction for hosted PostgreSQL roles where the
-- postgres owner is intentionally not a superuser.

BEGIN;

SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $preflight$
DECLARE
  v_relation regclass;
  v_relation_name text;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance owner ACL correction requires postgres.';
  END IF;

  FOREACH v_relation IN ARRAY ARRAY[
    'public.architecture_product_entitlements'::regclass,
    'public.architecture_finance_issue_requests'::regclass,
    'public.architecture_finance_issue_replay_guard'::regclass,
    'public.architecture_finance_access_desired'::regclass,
    'public.architecture_finance_access_outbox'::regclass
  ]
  LOOP
    SELECT relation.relname
    INTO v_relation_name
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_relation
      AND relation.relkind = 'r'
      AND relation.relowner = (
        SELECT role.oid
        FROM pg_catalog.pg_roles AS role
        WHERE role.rolname = 'postgres'
      )
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity;

    IF v_relation_name IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Main Finance owner ACL correction refused: protected table contract differs.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
      WHERE relation.oid = v_relation
        AND (
          pg_catalog.pg_get_userbyid(acl.grantee) IS DISTINCT FROM 'postgres'
          OR pg_catalog.pg_get_userbyid(acl.grantor) IS DISTINCT FROM 'postgres'
          OR acl.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE')
          OR acl.is_grantable
        )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
      WHERE attribute.attrelid = v_relation
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Main Finance owner ACL correction refused: unexpected direct ACL exists.';
    END IF;
  END LOOP;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'architecture_upsert_product_entitlement_internal',
        'architecture_begin_finance_issue_internal',
        'architecture_finish_finance_issue_internal',
        'architecture_set_finance_access_desired_internal',
        'architecture_get_finance_access_status_internal',
        'architecture_claim_finance_access_outbox_internal',
        'architecture_finish_finance_access_outbox_internal',
        'architecture_resolve_finance_subject_internal'
      )
      AND procedure.prosecdef
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) <> 8 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance owner ACL correction refused: SECURITY DEFINER contract differs.';
  END IF;
END;
$preflight$;

GRANT SELECT, INSERT, UPDATE
ON TABLE
  public.architecture_product_entitlements,
  public.architecture_finance_issue_requests,
  public.architecture_finance_issue_replay_guard,
  public.architecture_finance_access_desired,
  public.architecture_finance_access_outbox
TO postgres;

DO $postflight$
DECLARE
  v_relation regclass;
  v_postgres_is_superuser boolean;
BEGIN
  SELECT role.rolsuper
  INTO STRICT v_postgres_is_superuser
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'postgres';

  FOREACH v_relation IN ARRAY ARRAY[
    'public.architecture_product_entitlements'::regclass,
    'public.architecture_finance_issue_requests'::regclass,
    'public.architecture_finance_issue_replay_guard'::regclass,
    'public.architecture_finance_access_desired'::regclass,
    'public.architecture_finance_access_outbox'::regclass
  ]
  LOOP
    IF NOT v_postgres_is_superuser AND (
      NOT pg_catalog.has_table_privilege('postgres', v_relation, 'SELECT')
      OR NOT pg_catalog.has_table_privilege('postgres', v_relation, 'INSERT')
      OR NOT pg_catalog.has_table_privilege('postgres', v_relation, 'UPDATE')
      OR pg_catalog.has_table_privilege('postgres', v_relation, 'DELETE')
      OR pg_catalog.has_table_privilege('postgres', v_relation, 'TRUNCATE')
      OR pg_catalog.has_table_privilege('postgres', v_relation, 'REFERENCES')
      OR pg_catalog.has_table_privilege('postgres', v_relation, 'TRIGGER')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Main Finance owner ACL correction failed: owner DML allow-list differs.';
    END IF;

    IF pg_catalog.has_table_privilege('service_role', v_relation, 'SELECT')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'INSERT')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'UPDATE')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'DELETE')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'TRUNCATE')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'REFERENCES')
       OR pg_catalog.has_table_privilege('service_role', v_relation, 'TRIGGER')
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Main Finance owner ACL correction failed: service_role received direct table access.';
    END IF;
  END LOOP;
END;
$postflight$;

COMMIT;
