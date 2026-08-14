WITH
  preflight_clock AS MATERIALIZED (
    SELECT pg_catalog.clock_timestamp() AS value
  ),
  expected_tables(name) AS (
    VALUES
      ('architecture_product_entitlements'),
      ('architecture_finance_issue_requests'),
      ('architecture_finance_issue_replay_guard'),
      ('architecture_finance_access_desired'),
      ('architecture_finance_access_outbox')
  ),
  desired_rows AS MATERIALIZED (
    SELECT
      desired.main_user_id,
      desired.last_event_id AS event_id,
      desired.desired_state,
      desired.version,
      desired.applied_state,
      desired.applied_version,
      outbox.state AS event_state,
      desired.changed_by,
      desired.change_reason
    FROM public.architecture_finance_access_desired AS desired
    JOIN public.architecture_finance_access_outbox AS outbox
      ON outbox.event_id = desired.last_event_id
     AND outbox.main_user_id = desired.main_user_id
     AND outbox.product_code = desired.product_code
     AND outbox.subject_digest = desired.subject_digest
     AND outbox.version = desired.version
     AND outbox.desired_state = desired.desired_state
    WHERE desired.product_code = 'architecture_finance'
    ORDER BY desired.main_user_id
  ),
  relation_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', relation.relname,
          'kind', relation.relkind,
          'owner', pg_catalog.pg_get_userbyid(relation.relowner),
          'rls', relation.relrowsecurity,
          'force_rls', relation.relforcerowsecurity,
          'column_count', (
            SELECT pg_catalog.count(*)::text
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = relation.oid
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
          ),
          'constraint_count', (
            SELECT pg_catalog.count(*)::text
            FROM pg_catalog.pg_constraint AS constraint_row
            WHERE constraint_row.conrelid = relation.oid
          ),
          'index_count', (
            SELECT pg_catalog.count(*)::text
            FROM pg_catalog.pg_index AS index_row
            WHERE index_row.indrelid = relation.oid
          ),
          'trigger_count', (
            SELECT pg_catalog.count(*)::text
            FROM pg_catalog.pg_trigger AS trigger_row
            WHERE trigger_row.tgrelid = relation.oid
              AND NOT trigger_row.tgisinternal
          ),
          'policy_count', (
            SELECT pg_catalog.count(*)::text
            FROM pg_catalog.pg_policy AS policy
            WHERE policy.polrelid = relation.oid
          )
        ) ORDER BY relation.relname
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  column_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'column_name', attribute.attname,
          'position', attribute.attnum,
          'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
          'not_null', attribute.attnotnull,
          'default_expression', pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid),
          'identity', attribute.attidentity::text,
          'generated', attribute.attgenerated::text
        ) ORDER BY relation.relname, attribute.attnum
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef AS default_row
      ON default_row.adrelid = relation.oid
     AND default_row.adnum = attribute.attnum
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  constraint_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'constraint_name', constraint_row.conname,
          'type', constraint_row.contype::text,
          'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
          'deferrable', constraint_row.condeferrable,
          'deferred', constraint_row.condeferred,
          'validated', constraint_row.convalidated
        ) ORDER BY relation.relname, constraint_row.conname
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  index_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'index_name', index_relation.relname,
          'definition', pg_catalog.pg_get_indexdef(index_row.indexrelid, 0, false),
          'unique', index_row.indisunique,
          'primary', index_row.indisprimary,
          'valid', index_row.indisvalid,
          'ready', index_row.indisready,
          'live', index_row.indislive
        ) ORDER BY relation.relname, index_relation.relname
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = index_row.indrelid
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = index_row.indexrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  trigger_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'trigger_name', trigger_row.tgname,
          'definition', pg_catalog.pg_get_triggerdef(trigger_row.oid, false),
          'enabled', trigger_row.tgenabled::text
        ) ORDER BY relation.relname, trigger_row.tgname
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_trigger AS trigger_row
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = trigger_row.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
      AND NOT trigger_row.tgisinternal
  ),
  policy_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'policy_name', policy.polname,
          'command', policy.polcmd::text,
          'permissive', policy.polpermissive,
          'roles', policy.polroles::text,
          'using_expression', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          'check_expression', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
        ) ORDER BY relation.relname, policy.polname
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  function_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', procedure.proname,
          'identity_arguments', pg_catalog.oidvectortypes(procedure.proargtypes),
          'result_type', pg_catalog.format_type(procedure.prorettype, NULL),
          'volatility', procedure.provolatile::text,
          'security_definer', procedure.prosecdef,
          'argument_defaults', procedure.pronargdefaults,
          'body_md5', pg_catalog.md5(procedure.prosrc),
          'function_kind', procedure.prokind::text,
          'strict', procedure.proisstrict,
          'parallel_mode', procedure.proparallel::text,
          'leakproof', procedure.proleakproof,
          'config', procedure.proconfig,
          'owner', pg_catalog.pg_get_userbyid(procedure.proowner),
          'language', language.lanname
        ) ORDER BY procedure.proname, pg_catalog.oidvectortypes(procedure.proargtypes)
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE namespace.nspname = 'public'
      AND (
        procedure.proname IN (
          'architecture_finance_set_updated_at_internal',
          'architecture_upsert_product_entitlement_internal',
          'architecture_begin_finance_issue_internal',
          'architecture_finish_finance_issue_internal',
          'architecture_set_finance_access_desired_internal',
          'architecture_get_finance_access_status_internal',
          'architecture_claim_finance_access_outbox_internal',
          'architecture_finish_finance_access_outbox_internal',
          'architecture_resolve_finance_subject_internal'
        )
        OR procedure.proname LIKE 'architecture%finance%internal'
      )
  ),
  table_acl AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation_name', relation.relname,
          'grantee', CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END,
          'grantor', pg_catalog.pg_get_userbyid(exploded.grantor),
          'privilege', exploded.privilege_type,
          'grantable', exploded.is_grantable
        ) ORDER BY relation.relname, exploded.privilege_type,
          CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname::text IN (SELECT name FROM expected_tables)
  ),
  function_acl AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', procedure.proname,
          'identity_arguments', pg_catalog.oidvectortypes(procedure.proargtypes),
          'grantee', CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END,
          'grantor', pg_catalog.pg_get_userbyid(exploded.grantor),
          'privilege', exploded.privilege_type,
          'grantable', exploded.is_grantable
        ) ORDER BY procedure.proname,
          pg_catalog.oidvectortypes(procedure.proargtypes),
          CASE WHEN exploded.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(exploded.grantee) END
      ),
      '[]'::jsonb
    ) AS value
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND (
        procedure.proname IN (
          'architecture_finance_set_updated_at_internal',
          'architecture_upsert_product_entitlement_internal',
          'architecture_begin_finance_issue_internal',
          'architecture_finish_finance_issue_internal',
          'architecture_set_finance_access_desired_internal',
          'architecture_get_finance_access_status_internal',
          'architecture_claim_finance_access_outbox_internal',
          'architecture_finish_finance_access_outbox_internal',
          'architecture_resolve_finance_subject_internal'
        )
        OR procedure.proname LIKE 'architecture%finance%internal'
      )
  ),
  migration_catalog AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'version', migration.version,
          'name', migration.name
        ) ORDER BY migration.version
      ),
      '[]'::jsonb
    ) AS value
    FROM supabase_migrations.schema_migrations AS migration
  ),
  current_invalid AS (
    SELECT pg_catalog.count(*)::text AS value
    FROM public.architecture_finance_access_desired AS desired
    LEFT JOIN public.users AS user_row
      ON user_row.id = desired.main_user_id
    LEFT JOIN public.architecture_finance_access_outbox AS outbox
      ON outbox.event_id = desired.last_event_id
    WHERE desired.product_code <> 'architecture_finance'
       OR pg_catalog.octet_length(desired.subject_digest) <> 32
       OR user_row.id IS NULL
       OR desired.applied_version <> desired.version
       OR desired.applied_state IS DISTINCT FROM desired.desired_state
       OR desired.applied_at IS NULL
       OR outbox.event_id IS NULL
       OR outbox.main_user_id IS DISTINCT FROM desired.main_user_id
       OR outbox.subject_digest IS DISTINCT FROM desired.subject_digest
       OR outbox.product_code IS DISTINCT FROM desired.product_code
       OR outbox.version IS DISTINCT FROM desired.version
       OR outbox.desired_state IS DISTINCT FROM desired.desired_state
       OR outbox.state IS DISTINCT FROM 'applied'
       OR outbox.applied_at IS NULL
  ),
  entitlement_invalid AS (
    SELECT pg_catalog.count(*)::text AS value
    FROM public.architecture_finance_access_desired AS desired
    LEFT JOIN public.architecture_product_entitlements AS entitlement
      ON entitlement.subject_digest = desired.subject_digest
     AND entitlement.product_code = desired.product_code
    WHERE entitlement.subject_digest IS NULL
       OR entitlement.status IS DISTINCT FROM CASE desired.desired_state
         WHEN 'granted' THEN 'manual'
         ELSE 'blocked'
       END
  ),
  version_invalid AS (
    SELECT pg_catalog.count(*)::text AS value
    FROM public.architecture_finance_access_desired AS desired
    LEFT JOIN LATERAL (
      SELECT
        pg_catalog.count(*) AS event_count,
        pg_catalog.min(outbox.version) AS minimum_version,
        pg_catalog.max(outbox.version) AS maximum_version
      FROM public.architecture_finance_access_outbox AS outbox
      WHERE outbox.main_user_id = desired.main_user_id
        AND outbox.product_code = desired.product_code
    ) AS history ON true
    WHERE history.event_count <> desired.version
       OR history.minimum_version <> 1
       OR history.maximum_version <> desired.version
  )
SELECT
  pg_catalog.to_char(
    preflight_clock.value AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) AS database_clock,
  current_user::text AS database_role,
  pg_catalog.current_setting('server_version_num')::text AS server_version_num,
  (SELECT value FROM migration_catalog) AS migration_catalog,
  (SELECT value FROM relation_catalog) AS relation_catalog,
  (SELECT value FROM column_catalog) AS column_catalog,
  (SELECT value FROM constraint_catalog) AS constraint_catalog,
  (SELECT value FROM index_catalog) AS index_catalog,
  (SELECT value FROM trigger_catalog) AS trigger_catalog,
  (SELECT value FROM policy_catalog) AS policy_catalog,
  (SELECT value FROM function_catalog) AS function_catalog,
  (SELECT value FROM table_acl) AS table_acl,
  (SELECT value FROM function_acl) AS function_acl,
  pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE') AS service_role_schema_usage,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) AS column_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
  ) AS constraint_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_index AS index_row
    WHERE index_row.indrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
  ) AS index_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
      AND NOT trigger_row.tgisinternal
  ) AS trigger_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
  ) AS policy_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE attribute.attrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass,
      'public.architecture_finance_access_desired'::regclass,
      'public.architecture_finance_access_outbox'::regclass
    )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) AS column_acl_count,
  (SELECT pg_catalog.count(*)::text FROM public.architecture_finance_access_desired)
    AS desired_count,
  (SELECT pg_catalog.count(*)::text FROM desired_rows) AS current_row_count,
  (SELECT value FROM current_invalid) AS current_invalid_count,
  (SELECT value FROM entitlement_invalid) AS entitlement_invalid_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.architecture_product_entitlements AS entitlement
    WHERE entitlement.product_code = 'architecture_finance'
  ) AS entitlement_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.architecture_product_entitlements AS entitlement
    LEFT JOIN public.architecture_finance_access_desired AS desired
      ON desired.subject_digest = entitlement.subject_digest
     AND desired.product_code = entitlement.product_code
    WHERE entitlement.product_code = 'architecture_finance'
      AND desired.main_user_id IS NULL
  ) AS entitlement_extra_count,
  (SELECT value FROM version_invalid) AS version_invalid_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.architecture_finance_access_outbox
    WHERE state <> 'applied'
  ) AS nonterminal_outbox_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.architecture_finance_issue_requests AS request
    WHERE request.state IN ('pending', 'upstream_error')
       OR (
         request.state = 'succeeded'
         AND request.response_expires_at > preflight_clock.value
       )
  ) AS active_issue_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.architecture_finance_issue_replay_guard AS replay
    WHERE replay.expires_at > preflight_clock.value
  ) AS active_replay_count,
  coalesce(
    (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'main_user_id', desired_rows.main_user_id::text,
          'event_id', desired_rows.event_id::text,
          'desired_state', desired_rows.desired_state,
          'version', desired_rows.version::text,
          'applied_state', desired_rows.applied_state,
          'applied_version', desired_rows.applied_version::text,
          'event_state', desired_rows.event_state,
          'changed_by', desired_rows.changed_by,
          'change_reason', desired_rows.change_reason
        ) ORDER BY desired_rows.main_user_id
      )
      FROM desired_rows
    ),
    '[]'::jsonb
  ) AS rows
FROM preflight_clock;
