-- MAIN FINANCE PILOT V1 / HOSTED STAGING POSTFLIGHT / READ ONLY
-- Allowed project ref (enforced by the plan-only operator): bljeoovhydhjhdzwplxh
-- Permanently denied production ref: soxtekhspohkddpdidvp

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $main_finance_staging_postflight$
DECLARE
  v_expected_tables constant text[] := ARRAY[
    'architecture_product_entitlements',
    'architecture_finance_issue_requests',
    'architecture_finance_issue_replay_guard',
    'architecture_finance_access_desired',
    'architecture_finance_access_outbox'
  ];
  v_expected_functions constant text[] := ARRAY[
    'architecture_finance_set_updated_at_internal',
    'architecture_upsert_product_entitlement_internal',
    'architecture_begin_finance_issue_internal',
    'architecture_finish_finance_issue_internal',
    'architecture_set_finance_access_desired_internal',
    'architecture_get_finance_access_status_internal',
    'architecture_claim_finance_access_outbox_internal',
    'architecture_finish_finance_access_outbox_internal',
    'architecture_resolve_finance_subject_internal'
  ];
  v_count bigint;
  v_has_rows boolean;
  v_relation record;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main staging postflight requires the postgres execution context.';
  END IF;

  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: migration history is missing.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM supabase_migrations.schema_migrations;

  IF v_count <> 6
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version = '20260714235900'
         AND name = 'finance_integration_foundation'
     )
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version = '20260715010000'
         AND name = 'finance_entitlement_outbox_v1'
     )
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version = '20260715020000'
         AND name = 'finance_subject_resolver_v1'
     )
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version = '20260729010000'
         AND name = 'finance_security_definer_owner_acl_v1'
     )
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version = '20260729020000'
         AND name = 'finance_security_definer_nested_execute_acl_v1'
     )
     OR (
       SELECT count(*)
       FROM supabase_migrations.schema_migrations
       WHERE name = 'remote_schema'
         AND version ~ '^[0-9]{14}$'
         AND version > '20260715020000'
         AND version < '20260729010000'
     ) <> 1
     OR EXISTS (
       SELECT 1
       FROM supabase_migrations.schema_migrations
       WHERE (version, name) NOT IN (
         ('20260714235900', 'finance_integration_foundation'),
         ('20260715010000', 'finance_entitlement_outbox_v1'),
         ('20260715020000', 'finance_subject_resolver_v1'),
         ('20260729010000', 'finance_security_definer_owner_acl_v1'),
         ('20260729020000', 'finance_security_definer_nested_execute_acl_v1')
       )
         AND name IS DISTINCT FROM 'remote_schema'
     )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: migration history is not one remote_schema plus the exact five staging migrations.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname::text = ANY (v_expected_tables)
    AND relation.relrowsecurity
    AND NOT relation.relforcerowsecurity
    AND pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres';

  IF v_count <> 5
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace
         ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = 'public'
         AND relation.relkind IN ('r', 'p')
         AND (
           relation.relname = 'architecture_product_entitlements'
           OR relation.relname LIKE 'architecture_finance_%'
         )
         AND relation.relname::text <> ALL (v_expected_tables)
     )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact five-table/RLS/owner contract differs.';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS attribute
       WHERE attribute.attrelid = 'public.users'::regclass
         AND attribute.attname = 'id'
         AND attribute.atttypid = 'uuid'::regtype
         AND attribute.attnotnull
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS attribute
       WHERE attribute.attrelid = 'public.users'::regclass
         AND attribute.attname = 'telegram_id'
         AND attribute.atttypid = 'bigint'::regtype
         AND attribute.attnotnull
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.users'::regclass
         AND constraint_row.contype IN ('p', 'u')
         AND constraint_row.conkey = ARRAY[(
           SELECT attribute.attnum
           FROM pg_catalog.pg_attribute AS attribute
           WHERE attribute.attrelid = 'public.users'::regclass
             AND attribute.attname = 'id'
             AND attribute.attnum > 0
             AND NOT attribute.attisdropped
         )]::smallint[]
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.users'::regclass
         AND constraint_row.contype IN ('p', 'u')
         AND constraint_row.conkey = ARRAY[(
           SELECT attribute.attnum
           FROM pg_catalog.pg_attribute AS attribute
           WHERE attribute.attrelid = 'public.users'::regclass
             AND attribute.attname = 'telegram_id'
             AND attribute.attnum > 0
             AND NOT attribute.attisdropped
         )]::smallint[]
     )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: public.users prerequisite differs.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;
  IF v_count <> 57 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact column count differs.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  );
  IF v_count <> 49 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact constraint count differs.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_index AS index_row
  WHERE index_row.indrelid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  );
  IF v_count <> 20 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact index count differs.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_trigger AS trigger_row
  WHERE trigger_row.tgrelid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  )
    AND NOT trigger_row.tgisinternal;
  IF v_count <> 4 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact trigger count differs.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid = ANY (
    ARRAY[
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    ]
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Main staging postflight failed: integration tables must have no RLS policies.';
  END IF;

  IF EXISTS (
    WITH expected(
      function_name,
      identity_arguments,
      result_type,
      volatility,
      security_definer,
      argument_defaults,
      body_md5
    ) AS (
      VALUES
        ('architecture_finance_set_updated_at_internal', '', 'trigger', 'v', false, 0, 'ba01fe3d1a916c7a8f497915431bbac5'),
        ('architecture_upsert_product_entitlement_internal', 'bytea, text, text, timestamp with time zone, timestamp with time zone', 'jsonb', 'v', true, 2, '4a4b56b2f6c340a6358dc4c826a29d31'),
        ('architecture_begin_finance_issue_internal', 'uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone', 'jsonb', 'v', true, 0, '292fd9c6cc750a291db0008e34b3d0bc'),
        ('architecture_finish_finance_issue_internal', 'uuid, bytea, text, timestamp with time zone', 'jsonb', 'v', true, 1, '224981384a3ef9c101a77a9d3eb7e638'),
        ('architecture_set_finance_access_desired_internal', 'uuid, uuid, bytea, text, text, text, bigint', 'jsonb', 'v', true, 0, 'a676ce7f658a6bc3652b074c1948e8e2'),
        ('architecture_get_finance_access_status_internal', 'uuid, uuid', 'jsonb', 's', true, 1, '2eac4225c64453659ed17233f8005c86'),
        ('architecture_claim_finance_access_outbox_internal', 'uuid, text, integer, uuid', 'jsonb', 'v', true, 2, '0f34d47992c44eb7328e73d67204126b'),
        ('architecture_finish_finance_access_outbox_internal', 'uuid, uuid, text, text', 'jsonb', 'v', true, 1, '1d1343aa890a46e2057dd181da497ba9'),
        ('architecture_resolve_finance_subject_internal', 'uuid', 'jsonb', 's', true, 0, 'fb834aa38d61b0cdbe51571ef80e661c')
    ),
    actual AS (
      SELECT
        procedure.proname AS function_name,
        pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
        pg_catalog.format_type(procedure.prorettype, NULL) AS result_type,
        procedure.provolatile::text AS volatility,
        procedure.prosecdef AS security_definer,
        procedure.pronargdefaults AS argument_defaults,
        md5(procedure.prosrc) AS body_md5,
        procedure.prokind::text AS function_kind,
        procedure.proisstrict,
        procedure.proparallel::text AS parallel_mode,
        procedure.proleakproof,
        procedure.proconfig,
        pg_catalog.pg_get_userbyid(procedure.proowner) AS owner_name,
        language.lanname AS language_name
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      JOIN pg_catalog.pg_language AS language
        ON language.oid = procedure.prolang
      WHERE namespace.nspname = 'public'
        AND (
          procedure.proname::text = ANY (v_expected_functions)
          OR procedure.proname LIKE 'architecture%finance%internal'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (
      function_name,
      identity_arguments,
      result_type,
      volatility,
      security_definer,
      argument_defaults,
      body_md5
    )
    WHERE expected.function_name IS NULL
       OR actual.function_name IS NULL
       OR actual.function_kind <> 'f'
       OR actual.proisstrict
       OR actual.parallel_mode <> 'u'
       OR actual.proleakproof
       OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
       OR actual.owner_name <> 'postgres'
       OR actual.language_name <> 'plpgsql'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Main staging postflight failed: exact nine-function contract differs.';
  END IF;

  IF EXISTS (
    WITH expected(relation_name, grantee_name, grantor_name, privilege_type, is_grantable) AS (
      SELECT
        relation_name,
        'postgres'::text,
        'postgres'::text,
        privilege_type,
        false
      FROM unnest(v_expected_tables) AS relation_name
      CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE']::text[]) AS privilege_type
    ),
    actual AS (
      SELECT
        relation.relname::text AS relation_name,
        CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
          ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END AS grantee_name,
        pg_catalog.pg_get_userbyid(exploded.grantor) AS grantor_name,
        exploded.privilege_type,
        exploded.is_grantable
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
      WHERE namespace.nspname = 'public'
        AND relation.relname::text = ANY (v_expected_tables)
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (
      relation_name,
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
    )
    WHERE expected.relation_name IS NULL OR actual.relation_name IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE attribute.attrelid = ANY (
      ARRAY[
        'public.architecture_product_entitlements'::regclass,
        'public.architecture_finance_issue_requests'::regclass,
        'public.architecture_finance_issue_replay_guard'::regclass,
        'public.architecture_finance_access_desired'::regclass,
        'public.architecture_finance_access_outbox'::regclass
      ]
    )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Main staging postflight failed: exact owner-only table or column ACL allow-list differs.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE')
     OR EXISTS (
       WITH expected(function_name, identity_arguments, grantee_name, grantor_name, privilege_type, is_grantable) AS (
         VALUES
           ('architecture_begin_finance_issue_internal', 'uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_finish_finance_issue_internal', 'uuid, bytea, text, timestamp with time zone', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_set_finance_access_desired_internal', 'uuid, uuid, bytea, text, text, text, bigint', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_get_finance_access_status_internal', 'uuid, uuid', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_claim_finance_access_outbox_internal', 'uuid, text, integer, uuid', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_finish_finance_access_outbox_internal', 'uuid, uuid, text, text', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_resolve_finance_subject_internal', 'uuid', 'service_role', 'postgres', 'EXECUTE', false),
           ('architecture_upsert_product_entitlement_internal', 'bytea, text, text, timestamp with time zone, timestamp with time zone', 'postgres', 'postgres', 'EXECUTE', false)
       ),
       actual AS (
         SELECT
           procedure.proname AS function_name,
           pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
           CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
             ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END AS grantee_name,
           pg_catalog.pg_get_userbyid(exploded.grantor) AS grantor_name,
           exploded.privilege_type,
           exploded.is_grantable
         FROM pg_catalog.pg_proc AS procedure
         JOIN pg_catalog.pg_namespace AS namespace
           ON namespace.oid = procedure.pronamespace
         CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
         WHERE namespace.nspname = 'public'
           AND (
             procedure.proname::text = ANY (v_expected_functions)
             OR procedure.proname LIKE 'architecture%finance%internal'
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
       WHERE expected.function_name IS NULL OR actual.function_name IS NULL
     )
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Main staging postflight failed: exact function ACL allow-list differs.';
  END IF;

  FOR v_relation IN
    SELECT namespace.nspname AS schema_name, relation.relname AS relation_name
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
    ORDER BY relation.relname
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)',
      v_relation.schema_name,
      v_relation.relation_name
    ) INTO v_has_rows;
    IF v_has_rows THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = format(
          'Main staging postflight failed: data-less public table %I.%I is not empty.',
          v_relation.schema_name,
          v_relation.relation_name
        );
    END IF;
  END LOOP;

  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users LIMIT 1)' INTO v_has_rows;
    IF v_has_rows THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'Main staging postflight failed: auth.users is not empty.';
    END IF;
  END IF;
END;
$main_finance_staging_postflight$;

SELECT jsonb_build_object(
  'ok', true,
  'environment', 'staging',
  'project_ref', 'bljeoovhydhjhdzwplxh',
  'production_ref_denied', 'soxtekhspohkddpdidvp',
  'migration_count', (SELECT count(*) FROM supabase_migrations.schema_migrations),
  'public_data_rows', 0,
  'auth_users', 0
) AS main_finance_staging_postflight;

ROLLBACK;
