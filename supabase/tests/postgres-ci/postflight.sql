\set ON_ERROR_STOP on

DO $external_postflight$
DECLARE
  v_table_count integer;
  v_column_count integer;
  v_constraint_count integer;
  v_index_count integer;
  v_function_count integer;
  v_user_trigger_count integer;
  v_policy_count integer;
BEGIN
  SELECT count(*)
  INTO v_table_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard'
    )
    AND relation.relrowsecurity
    AND NOT relation.relforcerowsecurity
    AND pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres';

  SELECT count(*)
  INTO v_column_count
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass
    )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT count(*)
  INTO v_constraint_count
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid IN (
    'public.architecture_product_entitlements'::regclass,
    'public.architecture_finance_issue_requests'::regclass,
    'public.architecture_finance_issue_replay_guard'::regclass
  );

  SELECT count(*)
  INTO v_index_count
  FROM pg_catalog.pg_index AS index_row
  WHERE index_row.indrelid IN (
    'public.architecture_product_entitlements'::regclass,
    'public.architecture_finance_issue_requests'::regclass,
    'public.architecture_finance_issue_replay_guard'::regclass
  );

  SELECT count(*)
  INTO v_function_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname IN (
      'architecture_finance_set_updated_at_internal',
      'architecture_upsert_product_entitlement_internal',
      'architecture_begin_finance_issue_internal',
      'architecture_finish_finance_issue_internal'
    );

  SELECT count(*)
  INTO v_user_trigger_count
  FROM pg_catalog.pg_trigger AS trigger_row
  WHERE trigger_row.tgrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass
    )
    AND NOT trigger_row.tgisinternal;

  SELECT count(*)
  INTO v_policy_count
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid IN (
    'public.architecture_product_entitlements'::regclass,
    'public.architecture_finance_issue_requests'::regclass,
    'public.architecture_finance_issue_replay_guard'::regclass
  );

  IF v_table_count <> 3
     OR v_column_count <> 24
     OR v_constraint_count <> 19
     OR v_index_count <> 10
     OR v_function_count <> 4
     OR v_user_trigger_count <> 2
     OR v_policy_count <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'External postflight count mismatch: tables=%s columns=%s constraints=%s indexes=%s functions=%s triggers=%s policies=%s',
        v_table_count,
        v_column_count,
        v_constraint_count,
        v_index_count,
        v_function_count,
        v_user_trigger_count,
        v_policy_count
      );
  END IF;

  IF EXISTS (
    WITH expected(function_name, identity_arguments, body_md5) AS (
      VALUES
        ('architecture_finance_set_updated_at_internal', '', '5bdc21b8fa8fb1231bdb021e09a5bc8e'),
        ('architecture_upsert_product_entitlement_internal', 'bytea, text, text, timestamp with time zone, timestamp with time zone', '4a4b56b2f6c340a6358dc4c826a29d31'),
        ('architecture_begin_finance_issue_internal', 'uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone', '5bb5e2613993f9f2cb97cda6c043722d'),
        ('architecture_finish_finance_issue_internal', 'uuid, bytea, text, timestamp with time zone', '224981384a3ef9c101a77a9d3eb7e638')
    ),
    actual AS (
      SELECT
        procedure.proname AS function_name,
        pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments,
        md5(procedure.prosrc) AS body_md5
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname IN (
          'architecture_finance_set_updated_at_internal',
          'architecture_upsert_product_entitlement_internal',
          'architecture_begin_finance_issue_internal',
          'architecture_finish_finance_issue_internal'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (function_name, identity_arguments, body_md5)
    WHERE expected.function_name IS NULL
       OR actual.function_name IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'External postflight failed: reviewed function bodies differ.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_product_entitlements',
        'architecture_finance_issue_requests',
        'architecture_finance_issue_replay_guard'
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE attribute.attrelid IN (
        'public.architecture_product_entitlements'::regclass,
        'public.architecture_finance_issue_requests'::regclass,
        'public.architecture_finance_issue_replay_guard'::regclass
      )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'External postflight failed: direct table or column ACL remains.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND procedure.proname LIKE 'architecture%finance%internal'
      AND exploded.grantee = 'main_finance_ci_unknown'::regrole
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'External postflight failed: unknown default function grant survived ACL hardening.';
  END IF;

  IF (SELECT count(*) FROM public.users) <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.users
       WHERE id = '00000000-0000-4000-8000-000000000001'::uuid
     )
     OR (SELECT count(*) FROM public.architecture_product_entitlements) <> 0
     OR (SELECT count(*) FROM public.architecture_finance_issue_requests) <> 0
     OR (SELECT count(*) FROM public.architecture_finance_issue_replay_guard) <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'External postflight failed: prerequisite or integration data changed.';
  END IF;
END;
$external_postflight$;
