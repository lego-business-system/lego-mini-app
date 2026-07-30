\set ON_ERROR_STOP on

DO $outbox_external_postflight$
DECLARE
  v_table_count integer;
  v_column_count integer;
  v_constraint_count integer;
  v_index_count integer;
  v_function_count integer;
  v_trigger_count integer;
  v_policy_count integer;
  v_table_acl_count integer;
  v_table_acl_differs boolean;
BEGIN
  SELECT count(*)
  INTO v_table_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname IN (
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
    AND relation.relrowsecurity
    AND NOT relation.relforcerowsecurity
    AND pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres';

  SELECT count(*)
  INTO v_column_count
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid IN (
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT count(*)
  INTO v_constraint_count
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid IN (
    'public.architecture_finance_access_desired'::regclass,
    'public.architecture_finance_access_outbox'::regclass
  );

  SELECT count(*)
  INTO v_index_count
  FROM pg_catalog.pg_index AS index_row
  WHERE index_row.indrelid IN (
    'public.architecture_finance_access_desired'::regclass,
    'public.architecture_finance_access_outbox'::regclass
  );

  SELECT count(*)
  INTO v_function_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname IN (
      'architecture_set_finance_access_desired_internal',
      'architecture_get_finance_access_status_internal',
      'architecture_claim_finance_access_outbox_internal',
      'architecture_finish_finance_access_outbox_internal'
    )
    AND procedure.prosecdef
    AND procedure.proparallel = 'u'
    AND (
      (procedure.proname = 'architecture_get_finance_access_status_internal'
        AND procedure.provolatile = 's')
      OR
      (procedure.proname <> 'architecture_get_finance_access_status_internal'
        AND procedure.provolatile = 'v')
    )
    AND NOT procedure.proleakproof
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres';

  SELECT count(*)
  INTO v_trigger_count
  FROM pg_catalog.pg_trigger AS trigger_row
  WHERE trigger_row.tgrelid IN (
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
    AND NOT trigger_row.tgisinternal;

  SELECT count(*)
  INTO v_policy_count
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid IN (
    'public.architecture_finance_access_desired'::regclass,
    'public.architecture_finance_access_outbox'::regclass
  );

  IF v_table_count <> 2
     OR v_column_count <> 33
     OR v_constraint_count <> 30
     OR v_index_count <> 10
     OR v_function_count <> 4
     OR v_trigger_count <> 2
     OR v_policy_count <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'Outbox external postflight count mismatch: tables=%s columns=%s constraints=%s indexes=%s functions=%s triggers=%s policies=%s',
        v_table_count,
        v_column_count,
        v_constraint_count,
        v_index_count,
        v_function_count,
        v_trigger_count,
        v_policy_count
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid IN (
        'public.architecture_finance_access_desired'::regclass,
        'public.architecture_finance_access_outbox'::regclass
      )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname ~ '(telegram|init_data|code_hash|secret|email|phone)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Outbox external postflight failed: a forbidden identity or secret column exists.';
  END IF;

  WITH expected(
    relation_name,
    grantee_name,
    grantor_name,
    privilege_type,
    is_grantable
  ) AS (
    VALUES
      ('architecture_finance_access_desired', 'postgres', 'postgres', 'SELECT', false),
      ('architecture_finance_access_desired', 'postgres', 'postgres', 'INSERT', false),
      ('architecture_finance_access_desired', 'postgres', 'postgres', 'UPDATE', false),
      ('architecture_finance_access_outbox', 'postgres', 'postgres', 'SELECT', false),
      ('architecture_finance_access_outbox', 'postgres', 'postgres', 'INSERT', false),
      ('architecture_finance_access_outbox', 'postgres', 'postgres', 'UPDATE', false)
  ),
  actual AS (
    SELECT
      relation.relname AS relation_name,
      CASE
        WHEN exploded.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.pg_get_userbyid(exploded.grantee)
      END AS grantee_name,
      pg_catalog.pg_get_userbyid(exploded.grantor) AS grantor_name,
      exploded.privilege_type,
      exploded.is_grantable
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND relation.relname IN (
        'architecture_finance_access_desired',
        'architecture_finance_access_outbox'
      )
  ),
  difference AS (
    SELECT 1
    FROM expected
    FULL JOIN actual USING (
      relation_name,
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
    )
    WHERE expected.relation_name IS NULL
       OR actual.relation_name IS NULL
  )
  SELECT
    (SELECT count(*) FROM actual),
    EXISTS (SELECT 1 FROM difference)
  INTO v_table_acl_count, v_table_acl_differs;

  IF v_table_acl_count NOT IN (0, 6)
     OR (v_table_acl_count = 6 AND v_table_acl_differs)
     OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE attribute.attrelid IN (
        'public.architecture_finance_access_desired'::regclass,
        'public.architecture_finance_access_outbox'::regclass
      )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = format(
        'Outbox external postflight failed: table ACL must be empty or the exact six-entry postgres DML allow-list, and column ACL must be empty (table_acl_count=%s).',
        v_table_acl_count
      );
  END IF;

  IF EXISTS (
    WITH expected(function_name, identity_arguments, grantee_name, grantor_name, privilege_type, is_grantable) AS (
      VALUES
        ('architecture_set_finance_access_desired_internal', 'uuid, uuid, bytea, text, text, text, bigint', 'service_role', 'postgres', 'EXECUTE', false),
        ('architecture_get_finance_access_status_internal', 'uuid, uuid', 'service_role', 'postgres', 'EXECUTE', false),
        ('architecture_claim_finance_access_outbox_internal', 'uuid, text, integer, uuid', 'service_role', 'postgres', 'EXECUTE', false),
        ('architecture_finish_finance_access_outbox_internal', 'uuid, uuid, text, text', 'service_role', 'postgres', 'EXECUTE', false)
    ),
    actual AS (
      SELECT
        procedure.proname AS function_name,
        pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
        CASE
          WHEN exploded.grantee = 0 THEN 'PUBLIC'
          ELSE pg_catalog.pg_get_userbyid(exploded.grantee)
        END AS grantee_name,
        pg_catalog.pg_get_userbyid(exploded.grantor) AS grantor_name,
        exploded.privilege_type,
        exploded.is_grantable
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
      WHERE namespace.nspname = 'public'
        AND procedure.proname IN (
          'architecture_set_finance_access_desired_internal',
          'architecture_get_finance_access_status_internal',
          'architecture_claim_finance_access_outbox_internal',
          'architecture_finish_finance_access_outbox_internal'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (
      function_name,
      identity_arguments,
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
    )
    WHERE expected.function_name IS NULL
       OR actual.function_name IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Outbox external postflight failed: exact function ACL allow-list differs.';
  END IF;

  IF pg_catalog.has_function_privilege(
    'service_role',
    'public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Outbox external postflight failed: service_role can bypass the outbox through legacy upsert.';
  END IF;

  IF (SELECT count(*) FROM public.architecture_finance_access_desired) <> 0
     OR (SELECT count(*) FROM public.architecture_finance_access_outbox) <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Outbox external postflight failed: migration or rollback left data behind.';
  END IF;
END;
$outbox_external_postflight$;
