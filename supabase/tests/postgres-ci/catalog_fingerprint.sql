\set ON_ERROR_STOP on

-- OID-independent semantic fingerprint for the prerequisite and every object
-- owned by the reviewed main Finance migrations.
WITH catalog_items(kind, item) AS (
  SELECT
    'relation',
    format(
      '%I.%I|kind=%s|owner=%I|persistence=%s|rls=%s|force_rls=%s|acl=%s|comment=%s',
      namespace.nspname,
      relation.relname,
      relation.relkind,
      owner_role.rolname,
      relation.relpersistence,
      relation.relrowsecurity,
      relation.relforcerowsecurity,
      coalesce(relation.relacl::text, ''),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = relation.relowner
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = relation.oid
   AND description.classoid = 'pg_catalog.pg_class'::regclass
   AND description.objsubid = 0
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'users',
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
    AND relation.relkind IN ('r', 'p')

  UNION ALL

  SELECT
    'column',
    format(
      '%I.%I.%I|number=%s|type=%s|not_null=%s|identity=%s|generated=%s|collation=%s|default=%s|acl=%s|comment=%s',
      namespace.nspname,
      relation.relname,
      attribute.attname,
      attribute.attnum,
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      attribute.attnotnull,
      attribute.attidentity,
      attribute.attgenerated,
      CASE
        WHEN attribute.attcollation = 0 THEN ''
        ELSE format('%I.%I', collation_namespace.nspname, collation_row.collname)
      END,
      coalesce(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true), ''),
      coalesce(attribute.attacl::text, ''),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef AS default_value
    ON default_value.adrelid = attribute.attrelid
   AND default_value.adnum = attribute.attnum
  LEFT JOIN pg_catalog.pg_collation AS collation_row
    ON collation_row.oid = attribute.attcollation
  LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
    ON collation_namespace.oid = collation_row.collnamespace
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = relation.oid
   AND description.classoid = 'pg_catalog.pg_class'::regclass
   AND description.objsubid = attribute.attnum
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'users',
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped

  UNION ALL

  SELECT
    'constraint',
    format(
      '%I.%I.%I|type=%s|key=%s|foreign_key=%s|validated=%s|deferrable=%s|deferred=%s|no_inherit=%s|definition=%s|comment=%s',
      namespace.nspname,
      relation.relname,
      constraint_row.conname,
      constraint_row.contype,
      coalesce(constraint_row.conkey::text, ''),
      coalesce(constraint_row.confkey::text, ''),
      constraint_row.convalidated,
      constraint_row.condeferrable,
      constraint_row.condeferred,
      constraint_row.connoinherit,
      pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS relation
    ON relation.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = constraint_row.oid
   AND description.classoid = 'pg_catalog.pg_constraint'::regclass
   AND description.objsubid = 0
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'users',
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )

  UNION ALL

  SELECT
    'index',
    format(
      '%I.%I|table=%I|owner=%I|unique=%s|primary=%s|valid=%s|ready=%s|live=%s|nulls_not_distinct=%s|definition=%s|comment=%s',
      namespace.nspname,
      index_relation.relname,
      table_relation.relname,
      owner_role.rolname,
      index_row.indisunique,
      index_row.indisprimary,
      index_row.indisvalid,
      index_row.indisready,
      index_row.indislive,
      index_row.indnullsnotdistinct,
      pg_catalog.pg_get_indexdef(index_row.indexrelid),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_index AS index_row
  JOIN pg_catalog.pg_class AS index_relation
    ON index_relation.oid = index_row.indexrelid
  JOIN pg_catalog.pg_class AS table_relation
    ON table_relation.oid = index_row.indrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = table_relation.relnamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = index_relation.relowner
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = index_relation.oid
   AND description.classoid = 'pg_catalog.pg_class'::regclass
   AND description.objsubid = 0
  WHERE namespace.nspname = 'public'
    AND table_relation.relname IN (
      'users',
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )

  UNION ALL

  SELECT
    'function',
    format(
      '%I.%I(%s)|owner=%I|result=%s|language=%s|kind=%s|volatility=%s|strict=%s|security_definer=%s|parallel=%s|leakproof=%s|defaults=%s|config=%s|acl=%s|body_md5=%s|definition_md5=%s|comment=%s',
      namespace.nspname,
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid),
      owner_role.rolname,
      pg_catalog.pg_get_function_result(procedure.oid),
      language.lanname,
      procedure.prokind,
      procedure.provolatile,
      procedure.proisstrict,
      procedure.prosecdef,
      procedure.proparallel,
      procedure.proleakproof,
      coalesce(pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true), ''),
      coalesce(procedure.proconfig::text, ''),
      coalesce(procedure.proacl::text, ''),
      md5(procedure.prosrc),
      md5(pg_catalog.pg_get_functiondef(procedure.oid)),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = procedure.proowner
  JOIN pg_catalog.pg_language AS language
    ON language.oid = procedure.prolang
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = procedure.oid
   AND description.classoid = 'pg_catalog.pg_proc'::regclass
   AND description.objsubid = 0
  WHERE (
    namespace.nspname = 'public'
    AND procedure.proname IN (
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
  ) OR (
    namespace.nspname = 'auth'
    AND procedure.proname = 'role'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = ''
  )

  UNION ALL

  SELECT
    'trigger',
    format(
      '%I.%I.%I|function=%I.%I|type=%s|enabled=%s|internal=%s|constraint=%s|deferrable=%s|initially_deferred=%s|definition=%s|comment=%s',
      namespace.nspname,
      relation.relname,
      trigger_row.tgname,
      procedure_namespace.nspname,
      procedure.proname,
      trigger_row.tgtype,
      trigger_row.tgenabled,
      trigger_row.tgisinternal,
      '<none>',
      trigger_row.tgdeferrable,
      trigger_row.tginitdeferred,
      pg_catalog.pg_get_triggerdef(trigger_row.oid, true),
      coalesce(description.description, '')
    )
  FROM pg_catalog.pg_trigger AS trigger_row
  JOIN pg_catalog.pg_class AS relation
    ON relation.oid = trigger_row.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  JOIN pg_catalog.pg_proc AS procedure
    ON procedure.oid = trigger_row.tgfoid
  JOIN pg_catalog.pg_namespace AS procedure_namespace
    ON procedure_namespace.oid = procedure.pronamespace
  LEFT JOIN pg_catalog.pg_description AS description
    ON description.objoid = trigger_row.oid
   AND description.classoid = 'pg_catalog.pg_trigger'::regclass
   AND description.objsubid = 0
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
    AND NOT trigger_row.tgisinternal

  UNION ALL

  -- Internal FK trigger names contain generated OIDs. Record the referenced
  -- constraint identity and behavior instead of those unstable names.
  SELECT
    'internal_trigger',
    format(
      'trigger_table=%I.%I|constraint=%I.%I.%I|constraint_type=%s|function=%I.%I|type=%s|enabled=%s|deferrable=%s|initially_deferred=%s',
      trigger_namespace.nspname,
      trigger_relation.relname,
      constraint_namespace.nspname,
      constraint_relation.relname,
      constraint_row.conname,
      constraint_row.contype,
      procedure_namespace.nspname,
      procedure.proname,
      trigger_row.tgtype,
      trigger_row.tgenabled,
      trigger_row.tgdeferrable,
      trigger_row.tginitdeferred
    )
  FROM pg_catalog.pg_trigger AS trigger_row
  JOIN pg_catalog.pg_class AS trigger_relation
    ON trigger_relation.oid = trigger_row.tgrelid
  JOIN pg_catalog.pg_namespace AS trigger_namespace
    ON trigger_namespace.oid = trigger_relation.relnamespace
  JOIN pg_catalog.pg_constraint AS constraint_row
    ON constraint_row.oid = trigger_row.tgconstraint
  JOIN pg_catalog.pg_class AS constraint_relation
    ON constraint_relation.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS constraint_namespace
    ON constraint_namespace.oid = constraint_relation.relnamespace
  JOIN pg_catalog.pg_proc AS procedure
    ON procedure.oid = trigger_row.tgfoid
  JOIN pg_catalog.pg_namespace AS procedure_namespace
    ON procedure_namespace.oid = procedure.pronamespace
  WHERE trigger_row.tgisinternal
    AND constraint_namespace.nspname = 'public'
    AND constraint_relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )

  UNION ALL

  SELECT
    'policy',
    format(
      '%I.%I.%I|command=%s|permissive=%s|roles=%s|using=%s|check=%s',
      namespace.nspname,
      relation.relname,
      policy.polname,
      policy.polcmd,
      policy.polpermissive,
      policy.polroles::text,
      coalesce(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true), ''),
      coalesce(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, true), '')
    )
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS relation
    ON relation.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
)
SELECT md5(
  string_agg(kind || '|' || item, E'\n' ORDER BY kind, item)
)
FROM catalog_items;
