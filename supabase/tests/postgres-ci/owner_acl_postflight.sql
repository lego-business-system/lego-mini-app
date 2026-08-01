\set ON_ERROR_STOP on

DO $owner_acl_external_postflight$
DECLARE
  v_relation regclass;
  v_postgres_is_superuser boolean;
  v_acl_count integer;
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
        MESSAGE = 'Owner ACL external postflight failed: owner DML allow-list differs.';
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
        MESSAGE = 'Owner ACL external postflight failed: service_role has direct table access.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
      WHERE attribute.attrelid = v_relation
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Owner ACL external postflight failed: column ACL exists.';
    END IF;
  END LOOP;

  SELECT count(*)
  INTO v_acl_count
  FROM pg_catalog.pg_class AS relation
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  WHERE relation.oid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  )
    AND pg_catalog.pg_get_userbyid(acl.grantee) = 'postgres'
    AND pg_catalog.pg_get_userbyid(acl.grantor) = 'postgres'
    AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE')
    AND NOT acl.is_grantable;

  IF v_acl_count <> 15 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Owner ACL external postflight failed: exact owner table ACL count differs.';
  END IF;

  SELECT count(*)
  INTO v_acl_count
  FROM pg_catalog.pg_class AS relation
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  WHERE relation.oid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  )
    AND (
      pg_catalog.pg_get_userbyid(acl.grantee) IS DISTINCT FROM 'postgres'
      OR pg_catalog.pg_get_userbyid(acl.grantor) IS DISTINCT FROM 'postgres'
      OR acl.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE')
      OR acl.is_grantable
    );

  IF v_acl_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Owner ACL external postflight failed: unexpected table ACL exists.';
  END IF;
END;
$owner_acl_external_postflight$;
