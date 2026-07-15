-- ============================================================================
-- DRAFT / NOT APPLIED / STAGING ONLY
-- АРХИТЕКТУРА main -> АРХИТЕКТУРА: ФИНАНСЫ code-issuer foundation
-- Prepared: 2026-07-14
-- ============================================================================
--
-- This migration deliberately does not alter public.users, auth.users or the
-- existing check-access implementation. Live main identity is currently
-- Telegram initData, not Supabase Auth. Product entitlement is introduced as
-- a separate fail-closed source keyed by a server-derived HMAC pseudonym.
--
-- The database never receives raw Telegram initData, its verified hash, a raw
-- Telegram id, the outgoing nonce, the integration HMAC secret or a Finance
-- device code. It stores only 32-byte HMAC pseudonyms, timestamps and neutral
-- outcomes.
--
-- Apply only to a disposable main staging project after the corresponding
-- finance-issue-code Edge Function and Finance staging issuer exist.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL check_function_bodies = true;
SET LOCAL search_path = pg_catalog, public;

DO $preflight$
DECLARE
  v_table_count integer;
  v_function_count integer;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'Main Finance integration preflight failed: public.users is missing.';
  END IF;

  IF current_user IS DISTINCT FROM 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR to_regrole('postgres') IS NULL
     OR to_regprocedure('pg_catalog.aclexplode(aclitem[])') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR to_regrole('anon') IS NULL
     OR to_regrole('authenticated') IS NULL
     OR to_regrole('service_role') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration preflight failed: reviewed PostgreSQL 17 catalog, postgres execution context, ACL inspection, required Supabase roles or auth.role() are missing.';
  END IF;

  SELECT count(*)
  INTO v_table_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard'
    );

  IF v_table_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration preflight failed: integration tables already exist; this one-shot migration will not accept drift or reruns.';
  END IF;

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

  IF v_function_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration preflight failed: integration functions already exist; this one-shot migration will not replace unreviewed definitions.';
  END IF;
END;
$preflight$;

CREATE TABLE public.architecture_product_entitlements (
  subject_digest bytea NOT NULL,
  product_code text NOT NULL DEFAULT 'architecture_finance',
  status text NOT NULL,
  active_from timestamp with time zone,
  active_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT architecture_product_entitlements_pkey
    PRIMARY KEY (subject_digest, product_code),
  CONSTRAINT architecture_product_entitlements_subject_check
    CHECK (octet_length(subject_digest) = 32),
  CONSTRAINT architecture_product_entitlements_product_check
    CHECK (product_code = 'architecture_finance'),
  CONSTRAINT architecture_product_entitlements_status_check
    CHECK (status IN ('active', 'trial', 'manual', 'blocked')),
  CONSTRAINT architecture_product_entitlements_window_check
    CHECK (
      active_from IS NULL
      OR active_until IS NULL
      OR active_until > active_from
    )
);

CREATE TABLE public.architecture_finance_issue_requests (
  request_id uuid NOT NULL,
  subject_digest bytea NOT NULL,
  init_data_digest bytea NOT NULL,
  product_code text NOT NULL DEFAULT 'architecture_finance',
  network_nonce_digest bytea NOT NULL,
  request_fingerprint bytea NOT NULL,
  finance_timestamp bigint NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  response_expires_at timestamp with time zone,
  attempt_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT architecture_finance_issue_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT architecture_finance_issue_requests_digest_check
    CHECK (
      octet_length(subject_digest) = 32
      AND octet_length(init_data_digest) = 32
      AND octet_length(network_nonce_digest) = 32
      AND octet_length(request_fingerprint) = 32
    ),
  CONSTRAINT architecture_finance_issue_requests_product_check
    CHECK (product_code = 'architecture_finance'),
  CONSTRAINT architecture_finance_issue_requests_timestamp_check
    CHECK (finance_timestamp BETWEEN 1000000000 AND 9999999999999),
  CONSTRAINT architecture_finance_issue_requests_state_check
    CHECK (state IN ('pending', 'upstream_error', 'succeeded', 'rejected')),
  CONSTRAINT architecture_finance_issue_requests_attempt_check
    CHECK (attempt_count BETWEEN 1 AND 5),
  CONSTRAINT architecture_finance_issue_requests_state_fields_check
    CHECK (
      (state = 'succeeded' AND response_expires_at IS NOT NULL)
      OR (state <> 'succeeded' AND response_expires_at IS NULL)
    ),
  CONSTRAINT architecture_finance_issue_requests_fingerprint_unique
    UNIQUE (request_fingerprint)
);

CREATE TABLE public.architecture_finance_issue_replay_guard (
  init_data_digest bytea NOT NULL,
  request_id uuid NOT NULL,
  network_nonce_digest bytea NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT architecture_finance_issue_replay_guard_pkey
    PRIMARY KEY (init_data_digest),
  CONSTRAINT architecture_finance_issue_replay_guard_request_unique
    UNIQUE (request_id),
  CONSTRAINT architecture_finance_issue_replay_guard_nonce_unique
    UNIQUE (network_nonce_digest),
  CONSTRAINT architecture_finance_issue_replay_guard_digest_check
    CHECK (
      octet_length(init_data_digest) = 32
      AND octet_length(network_nonce_digest) = 32
    ),
  CONSTRAINT architecture_finance_issue_replay_guard_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT architecture_finance_issue_replay_guard_request_fkey
    FOREIGN KEY (request_id)
    REFERENCES public.architecture_finance_issue_requests(request_id)
    ON DELETE CASCADE
);

-- Default privileges in hosted projects may grant newly-created objects to
-- roles that do not appear in this migration. Pin ownership before ACL
-- cleanup, then inspect/revoke every ACL grantee from the actual catalogs.
ALTER TABLE public.architecture_product_entitlements OWNER TO postgres;
ALTER TABLE public.architecture_finance_issue_requests OWNER TO postgres;
ALTER TABLE public.architecture_finance_issue_replay_guard OWNER TO postgres;

CREATE INDEX idx_architecture_product_entitlements_status
ON public.architecture_product_entitlements (product_code, status, active_until);

CREATE INDEX idx_architecture_finance_issue_requests_created
ON public.architecture_finance_issue_requests (created_at);

CREATE INDEX idx_architecture_finance_issue_requests_subject_created
ON public.architecture_finance_issue_requests (subject_digest, created_at DESC);

CREATE INDEX idx_architecture_finance_replay_guard_expiry
ON public.architecture_finance_issue_replay_guard (expires_at);

CREATE OR REPLACE FUNCTION public.architecture_finance_set_updated_at_internal()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY INVOKER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.architecture_finance_set_updated_at_internal()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.architecture_finance_set_updated_at_internal()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_architecture_product_entitlements_updated_at
ON public.architecture_product_entitlements;
CREATE TRIGGER trg_architecture_product_entitlements_updated_at
BEFORE UPDATE ON public.architecture_product_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.architecture_finance_set_updated_at_internal();

DROP TRIGGER IF EXISTS trg_architecture_finance_issue_requests_updated_at
ON public.architecture_finance_issue_requests;
CREATE TRIGGER trg_architecture_finance_issue_requests_updated_at
BEFORE UPDATE ON public.architecture_finance_issue_requests
FOR EACH ROW
EXECUTE FUNCTION public.architecture_finance_set_updated_at_internal();

CREATE OR REPLACE FUNCTION public.architecture_upsert_product_entitlement_internal(
  p_subject_digest bytea,
  p_product_code text,
  p_status text,
  p_active_from timestamp with time zone DEFAULT NULL,
  p_active_until timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;
  IF octet_length(p_subject_digest) IS DISTINCT FROM 32
     OR p_product_code IS DISTINCT FROM 'architecture_finance'
     OR p_status IS NULL
     OR p_status NOT IN ('active', 'trial', 'manual', 'blocked')
     OR (
       p_active_from IS NOT NULL
       AND p_active_until IS NOT NULL
       AND p_active_until <= p_active_from
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_entitlement');
  END IF;

  INSERT INTO public.architecture_product_entitlements (
    subject_digest,
    product_code,
    status,
    active_from,
    active_until
  ) VALUES (
    p_subject_digest,
    p_product_code,
    p_status,
    p_active_from,
    p_active_until
  )
  ON CONFLICT (subject_digest, product_code) DO UPDATE
  SET status = EXCLUDED.status,
      active_from = EXCLUDED.active_from,
      active_until = EXCLUDED.active_until,
      updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$function$;

ALTER FUNCTION public.architecture_upsert_product_entitlement_internal(bytea, text, text, timestamp with time zone, timestamp with time zone)
OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.architecture_begin_finance_issue_internal(
  p_request_id uuid,
  p_subject_digest bytea,
  p_init_data_digest bytea,
  p_product_code text,
  p_network_nonce_digest bytea,
  p_request_fingerprint bytea,
  p_finance_timestamp bigint,
  p_replay_expires_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_request public.architecture_finance_issue_requests%ROWTYPE;
  v_replay public.architecture_finance_issue_replay_guard%ROWTYPE;
  v_entitlement public.architecture_product_entitlements%ROWTYPE;
  v_recent_subject_requests bigint;
  v_now_seconds bigint := floor(extract(epoch FROM clock_timestamp()))::bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;
  IF p_request_id IS NULL
     OR p_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR octet_length(p_subject_digest) IS DISTINCT FROM 32
     OR octet_length(p_init_data_digest) IS DISTINCT FROM 32
     OR p_product_code IS DISTINCT FROM 'architecture_finance'
     OR octet_length(p_network_nonce_digest) IS DISTINCT FROM 32
     OR octet_length(p_request_fingerprint) IS DISTINCT FROM 32
     OR p_finance_timestamp IS NULL
     OR p_finance_timestamp NOT BETWEEN v_now_seconds - 60 AND v_now_seconds + 30
     OR p_replay_expires_at IS NULL
     OR p_replay_expires_at <= clock_timestamp()
     OR p_replay_expires_at > clock_timestamp() + interval '15 minutes'
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  -- Request UUID first, verified-launch pseudonym second, subject pseudonym
  -- third: every begin path acquires locks in the same order. Hash collisions
  -- only serialize extra requests.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 7401001)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(encode(p_init_data_digest, 'hex'), 7401002)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(encode(p_subject_digest, 'hex'), 7401003)
  );

  SELECT entitlement.*
  INTO v_entitlement
    FROM public.architecture_product_entitlements AS entitlement
    WHERE entitlement.subject_digest = p_subject_digest
      AND entitlement.product_code = p_product_code
      AND entitlement.status IN ('active', 'trial', 'manual')
      AND (
        entitlement.active_from IS NULL
        OR entitlement.active_from <= clock_timestamp()
      )
      AND (
        entitlement.active_until IS NULL
        OR entitlement.active_until > clock_timestamp()
      )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
  END IF;

  SELECT request_row.*
  INTO v_request
  FROM public.architecture_finance_issue_requests AS request_row
  WHERE request_row.request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_request.subject_digest IS DISTINCT FROM p_subject_digest
       OR v_request.init_data_digest IS DISTINCT FROM p_init_data_digest
       OR v_request.product_code IS DISTINCT FROM p_product_code
       OR v_request.network_nonce_digest IS DISTINCT FROM p_network_nonce_digest
       OR v_request.request_fingerprint IS DISTINCT FROM p_request_fingerprint
    THEN
      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
    END IF;

    SELECT replay_row.*
    INTO v_replay
    FROM public.architecture_finance_issue_replay_guard AS replay_row
    WHERE replay_row.request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_replay.init_data_digest IS DISTINCT FROM p_init_data_digest
       OR v_replay.network_nonce_digest IS DISTINCT FROM p_network_nonce_digest
    THEN
      RETURN jsonb_build_object('ok', false, 'error', 'replay_state_invalid');
    END IF;

    -- A verified launch may recover the same idempotent Finance response, but
    -- it cannot create unbounded database/upstream work.
    IF v_request.attempt_count >= 5
       OR v_request.updated_at > clock_timestamp() - interval '1 second'
    THEN
      RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
    END IF;

    UPDATE public.architecture_finance_issue_requests
    SET attempt_count = attempt_count + 1,
        updated_at = now()
    WHERE request_id = p_request_id;

    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'state', v_request.state,
      'finance_timestamp', v_request.finance_timestamp::text
    );
  END IF;

  SELECT replay_row.*
  INTO v_replay
  FROM public.architecture_finance_issue_replay_guard AS replay_row
  WHERE replay_row.init_data_digest = p_init_data_digest
     OR replay_row.network_nonce_digest = p_network_nonce_digest
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'replay_conflict');
  END IF;

  -- This count includes every accepted request state, not just successes.
  -- The subject advisory lock above makes the rolling-window decision atomic
  -- across concurrent fresh Telegram launches for the same verified user.
  SELECT count(*)
  INTO v_recent_subject_requests
  FROM public.architecture_finance_issue_requests AS recent_request
  WHERE recent_request.subject_digest = p_subject_digest
    AND recent_request.created_at > clock_timestamp() - interval '10 minutes';

  IF v_recent_subject_requests >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.architecture_finance_issue_requests (
    request_id,
    subject_digest,
    init_data_digest,
    product_code,
    network_nonce_digest,
    request_fingerprint,
    finance_timestamp
  ) VALUES (
    p_request_id,
    p_subject_digest,
    p_init_data_digest,
    p_product_code,
    p_network_nonce_digest,
    p_request_fingerprint,
    p_finance_timestamp
  );

  INSERT INTO public.architecture_finance_issue_replay_guard (
    init_data_digest,
    request_id,
    network_nonce_digest,
    expires_at
  ) VALUES (
    p_init_data_digest,
    p_request_id,
    p_network_nonce_digest,
    p_replay_expires_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'state', 'pending',
    'finance_timestamp', p_finance_timestamp::text
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'replay_conflict');
END;
$function$;

ALTER FUNCTION public.architecture_begin_finance_issue_internal(uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone)
OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.architecture_finish_finance_issue_internal(
  p_request_id uuid,
  p_request_fingerprint bytea,
  p_outcome text,
  p_response_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_request public.architecture_finance_issue_requests%ROWTYPE;
  v_entitlement public.architecture_product_entitlements%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;
  IF p_request_id IS NULL
     OR octet_length(p_request_fingerprint) IS DISTINCT FROM 32
     OR p_outcome IS NULL
     OR p_outcome NOT IN ('succeeded', 'rejected', 'upstream_error')
     OR (
       p_outcome = 'succeeded'
       AND (
         p_response_expires_at IS NULL
         OR p_response_expires_at <= clock_timestamp() - interval '5 seconds'
         OR p_response_expires_at > clock_timestamp() + interval '30 minutes'
       )
     )
     OR (p_outcome <> 'succeeded' AND p_response_expires_at IS NOT NULL)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_result');
  END IF;

  -- Match begin's first lock so a request cannot be finished concurrently
  -- with itself. The entitlement lock is acquired before the request row lock
  -- to preserve the begin path's lock order.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 7401001)
  );

  SELECT request_row.*
  INTO v_request
  FROM public.architecture_finance_issue_requests AS request_row
  WHERE request_row.request_id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF v_request.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
  END IF;

  -- Entitlement may be revoked while Finance is issuing a code. Revalidate
  -- immediately before accepting any successful upstream response and hold
  -- the entitlement row lock through the request-state update.
  IF p_outcome = 'succeeded' THEN
    SELECT entitlement.*
    INTO v_entitlement
    FROM public.architecture_product_entitlements AS entitlement
    WHERE entitlement.subject_digest = v_request.subject_digest
      AND entitlement.product_code = v_request.product_code
      AND entitlement.status IN ('active', 'trial', 'manual')
      AND (
        entitlement.active_from IS NULL
        OR entitlement.active_from <= clock_timestamp()
      )
      AND (
        entitlement.active_until IS NULL
        OR entitlement.active_until > clock_timestamp()
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE public.architecture_finance_issue_requests
      SET state = 'rejected',
          response_expires_at = NULL,
          updated_at = now()
      WHERE request_id = p_request_id
        AND state IN ('pending', 'upstream_error');

      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  SELECT request_row.*
  INTO v_request
  FROM public.architecture_finance_issue_requests AS request_row
  WHERE request_row.request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF v_request.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
  END IF;

  IF v_request.state = 'succeeded' THEN
    IF p_outcome = 'succeeded'
       AND v_request.response_expires_at IS NOT DISTINCT FROM p_response_expires_at
    THEN
      RETURN jsonb_build_object('ok', true, 'replayed', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'terminal_state_conflict');
  ELSIF v_request.state = 'rejected' THEN
    IF p_outcome = 'rejected' THEN
      RETURN jsonb_build_object('ok', true, 'replayed', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'terminal_state_conflict');
  END IF;

  UPDATE public.architecture_finance_issue_requests
  SET state = p_outcome,
      response_expires_at = p_response_expires_at,
      updated_at = now()
  WHERE request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'replayed', false);
END;
$function$;

ALTER FUNCTION public.architecture_finish_finance_issue_internal(uuid, bytea, text, timestamp with time zone)
OWNER TO postgres;

ALTER TABLE public.architecture_product_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architecture_finance_issue_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architecture_finance_issue_replay_guard ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE
  public.architecture_product_entitlements,
  public.architecture_finance_issue_requests,
  public.architecture_finance_issue_replay_guard
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.architecture_upsert_product_entitlement_internal(bytea, text, text, timestamp with time zone, timestamp with time zone)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.architecture_begin_finance_issue_internal(uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.architecture_finish_finance_issue_internal(uuid, bytea, text, timestamp with time zone)
FROM PUBLIC, anon, authenticated, service_role;

-- Supabase projects can have project-specific default privileges. Revoke from
-- every grantee actually present on these new tables, columns and functions,
-- including grant options and roles unknown when this draft was written.
DO $acl_hardening$
DECLARE
  v_acl record;
  v_grantee_sql text;
  v_function_signature text;
BEGIN
  FOR v_acl IN
    SELECT DISTINCT
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      exploded.grantee
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
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %s CASCADE',
      v_acl.schema_name,
      v_acl.object_name,
      v_grantee_sql
    );
  END LOOP;

  FOR v_acl IN
    SELECT DISTINCT
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      attribute.attname AS column_name,
      exploded.grantee
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_product_entitlements',
        'architecture_finance_issue_requests',
        'architecture_finance_issue_replay_guard'
      )
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM %s CASCADE',
      v_acl.column_name,
      v_acl.schema_name,
      v_acl.object_name,
      v_grantee_sql
    );
  END LOOP;

  FOR v_acl IN
    SELECT DISTINCT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
      exploded.grantee
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'architecture_finance_set_updated_at_internal',
        'architecture_upsert_product_entitlement_internal',
        'architecture_begin_finance_issue_internal',
        'architecture_finish_finance_issue_internal'
      )
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    v_function_signature := format(
      '%I.%I(%s)',
      v_acl.schema_name,
      v_acl.function_name,
      v_acl.identity_arguments
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s CASCADE',
      v_function_signature,
      v_grantee_sql
    );
  END LOOP;
END;
$acl_hardening$;

GRANT EXECUTE ON FUNCTION public.architecture_upsert_product_entitlement_internal(bytea, text, text, timestamp with time zone, timestamp with time zone)
TO service_role;
GRANT EXECUTE ON FUNCTION public.architecture_begin_finance_issue_internal(uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone)
TO service_role;
GRANT EXECUTE ON FUNCTION public.architecture_finish_finance_issue_internal(uuid, bytea, text, timestamp with time zone)
TO service_role;

DO $postflight$
BEGIN
  -- Exact table identity, ownership and RLS mode. FORCE RLS is deliberately
  -- off because the owner-only SECURITY DEFINER functions must reach rows.
  IF EXISTS (
    WITH expected(table_name) AS (
      VALUES
        ('architecture_product_entitlements'::text),
        ('architecture_finance_issue_requests'::text),
        ('architecture_finance_issue_replay_guard'::text)
    ),
    actual AS (
      SELECT
        relation.relname AS table_name,
        owner_role.rolname AS owner_name,
        relation.relkind,
        relation.relpersistence,
        relation.relispartition,
        relation.relrowsecurity,
        relation.relforcerowsecurity
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_roles AS owner_role
        ON owner_role.oid = relation.relowner
      WHERE namespace.nspname = 'public'
        AND relation.relname IN (
          'architecture_product_entitlements',
          'architecture_finance_issue_requests',
          'architecture_finance_issue_replay_guard'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (table_name)
    WHERE expected.table_name IS NULL
       OR actual.table_name IS NULL
       OR actual.owner_name IS DISTINCT FROM 'postgres'
       OR actual.relkind IS DISTINCT FROM 'r'
       OR actual.relpersistence IS DISTINCT FROM 'p'
       OR actual.relispartition IS DISTINCT FROM false
       OR actual.relrowsecurity IS DISTINCT FROM true
       OR actual.relforcerowsecurity IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: table identity, ownership or RLS mode differs from the exact contract.';
  END IF;

  -- Exact ordered column catalog, including defaults, nullability, identity,
  -- generated state and collation. This also rejects added/dropped columns.
  IF EXISTS (
    WITH expected(
      table_name,
      column_number,
      column_name,
      type_name,
      is_not_null,
      default_expression,
      identity_kind,
      generated_kind,
      collation_name
    ) AS (
      VALUES
        ('architecture_product_entitlements', 1, 'subject_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_product_entitlements', 2, 'product_code', 'text', true, '''architecture_finance''::text', '', '', 'pg_catalog."default"'),
        ('architecture_product_entitlements', 3, 'status', 'text', true, NULL, '', '', 'pg_catalog."default"'),
        ('architecture_product_entitlements', 4, 'active_from', 'timestamp with time zone', false, NULL, '', '', NULL),
        ('architecture_product_entitlements', 5, 'active_until', 'timestamp with time zone', false, NULL, '', '', NULL),
        ('architecture_product_entitlements', 6, 'created_at', 'timestamp with time zone', true, 'now()', '', '', NULL),
        ('architecture_product_entitlements', 7, 'updated_at', 'timestamp with time zone', true, 'now()', '', '', NULL),
        ('architecture_finance_issue_requests', 1, 'request_id', 'uuid', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 2, 'subject_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 3, 'init_data_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 4, 'product_code', 'text', true, '''architecture_finance''::text', '', '', 'pg_catalog."default"'),
        ('architecture_finance_issue_requests', 5, 'network_nonce_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 6, 'request_fingerprint', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 7, 'finance_timestamp', 'bigint', true, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 8, 'state', 'text', true, '''pending''::text', '', '', 'pg_catalog."default"'),
        ('architecture_finance_issue_requests', 9, 'response_expires_at', 'timestamp with time zone', false, NULL, '', '', NULL),
        ('architecture_finance_issue_requests', 10, 'attempt_count', 'integer', true, '1', '', '', NULL),
        ('architecture_finance_issue_requests', 11, 'created_at', 'timestamp with time zone', true, 'now()', '', '', NULL),
        ('architecture_finance_issue_requests', 12, 'updated_at', 'timestamp with time zone', true, 'now()', '', '', NULL),
        ('architecture_finance_issue_replay_guard', 1, 'init_data_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_replay_guard', 2, 'request_id', 'uuid', true, NULL, '', '', NULL),
        ('architecture_finance_issue_replay_guard', 3, 'network_nonce_digest', 'bytea', true, NULL, '', '', NULL),
        ('architecture_finance_issue_replay_guard', 4, 'expires_at', 'timestamp with time zone', true, NULL, '', '', NULL),
        ('architecture_finance_issue_replay_guard', 5, 'created_at', 'timestamp with time zone', true, 'now()', '', '', NULL)
    ),
    actual AS (
      SELECT
        relation.relname AS table_name,
        attribute.attnum::integer AS column_number,
        attribute.attname AS column_name,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS type_name,
        attribute.attnotnull AS is_not_null,
        pg_catalog.pg_get_expr(attribute_default.adbin, attribute_default.adrelid, true) AS default_expression,
        attribute.attidentity::text AS identity_kind,
        attribute.attgenerated::text AS generated_kind,
        CASE
          WHEN attribute.attcollation = 0 THEN NULL
          ELSE format('%I.%I', collation_namespace.nspname, collation.collname)
        END AS collation_name
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = relation.oid
       AND attribute.attnum > 0
       AND NOT attribute.attisdropped
      LEFT JOIN pg_catalog.pg_attrdef AS attribute_default
        ON attribute_default.adrelid = attribute.attrelid
       AND attribute_default.adnum = attribute.attnum
      LEFT JOIN pg_catalog.pg_collation AS collation
        ON collation.oid = attribute.attcollation
      LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
        ON collation_namespace.oid = collation.collnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname IN (
          'architecture_product_entitlements',
          'architecture_finance_issue_requests',
          'architecture_finance_issue_replay_guard'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (table_name, column_number)
    WHERE expected.table_name IS NULL
       OR actual.table_name IS NULL
       OR actual.column_name IS DISTINCT FROM expected.column_name
       OR actual.type_name IS DISTINCT FROM expected.type_name
       OR actual.is_not_null IS DISTINCT FROM expected.is_not_null
       OR actual.default_expression IS DISTINCT FROM expected.default_expression
       OR actual.identity_kind IS DISTINCT FROM expected.identity_kind
       OR actual.generated_kind IS DISTINCT FROM expected.generated_kind
       OR actual.collation_name IS DISTINCT FROM expected.collation_name
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: ordered columns or defaults differ from the exact contract.';
  END IF;

  -- Exact nineteen constraints. pg_get_constraintdef covers each CHECK body,
  -- key order and FK action while the remaining flags reject deferred or
  -- unvalidated substitutions.
  IF EXISTS (
    WITH expected(table_name, constraint_name, constraint_type, key_columns, definition) AS (
      VALUES
        ('architecture_product_entitlements', 'architecture_product_entitlements_pkey', 'p', ARRAY[1,2]::smallint[], 'PRIMARY KEY (subject_digest, product_code)'),
        ('architecture_product_entitlements', 'architecture_product_entitlements_subject_check', 'c', ARRAY[1]::smallint[], 'CHECK (octet_length(subject_digest) = 32)'),
        ('architecture_product_entitlements', 'architecture_product_entitlements_product_check', 'c', ARRAY[2]::smallint[], 'CHECK (product_code = ''architecture_finance''::text)'),
        ('architecture_product_entitlements', 'architecture_product_entitlements_status_check', 'c', ARRAY[3]::smallint[], 'CHECK (status = ANY (ARRAY[''active''::text, ''trial''::text, ''manual''::text, ''blocked''::text]))'),
        ('architecture_product_entitlements', 'architecture_product_entitlements_window_check', 'c', ARRAY[4,5]::smallint[], 'CHECK (active_from IS NULL OR active_until IS NULL OR active_until > active_from)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_pkey', 'p', ARRAY[1]::smallint[], 'PRIMARY KEY (request_id)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_digest_check', 'c', ARRAY[2,3,5,6]::smallint[], 'CHECK (octet_length(subject_digest) = 32 AND octet_length(init_data_digest) = 32 AND octet_length(network_nonce_digest) = 32 AND octet_length(request_fingerprint) = 32)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_product_check', 'c', ARRAY[4]::smallint[], 'CHECK (product_code = ''architecture_finance''::text)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_timestamp_check', 'c', ARRAY[7]::smallint[], 'CHECK (finance_timestamp >= 1000000000 AND finance_timestamp <= ''9999999999999''::bigint)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_state_check', 'c', ARRAY[8]::smallint[], 'CHECK (state = ANY (ARRAY[''pending''::text, ''upstream_error''::text, ''succeeded''::text, ''rejected''::text]))'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_attempt_check', 'c', ARRAY[10]::smallint[], 'CHECK (attempt_count >= 1 AND attempt_count <= 5)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_state_fields_check', 'c', ARRAY[8,9]::smallint[], 'CHECK (state = ''succeeded''::text AND response_expires_at IS NOT NULL OR state <> ''succeeded''::text AND response_expires_at IS NULL)'),
        ('architecture_finance_issue_requests', 'architecture_finance_issue_requests_fingerprint_unique', 'u', ARRAY[6]::smallint[], 'UNIQUE (request_fingerprint)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_pkey', 'p', ARRAY[1]::smallint[], 'PRIMARY KEY (init_data_digest)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_request_unique', 'u', ARRAY[2]::smallint[], 'UNIQUE (request_id)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_nonce_unique', 'u', ARRAY[3]::smallint[], 'UNIQUE (network_nonce_digest)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_digest_check', 'c', ARRAY[1,3]::smallint[], 'CHECK (octet_length(init_data_digest) = 32 AND octet_length(network_nonce_digest) = 32)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_expiry_check', 'c', ARRAY[4,5]::smallint[], 'CHECK (expires_at > created_at)'),
        ('architecture_finance_issue_replay_guard', 'architecture_finance_issue_replay_guard_request_fkey', 'f', ARRAY[2]::smallint[], 'FOREIGN KEY (request_id) REFERENCES architecture_finance_issue_requests(request_id) ON DELETE CASCADE')
    ),
    actual AS (
      SELECT
        relation.relname AS table_name,
        constraint_row.conname AS constraint_name,
        constraint_row.contype::text AS constraint_type,
        constraint_row.conkey::smallint[] AS key_columns,
        pg_catalog.regexp_replace(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
          '\s+',
          ' ',
          'g'
        ) AS definition,
        constraint_row.condeferrable,
        constraint_row.condeferred,
        constraint_row.convalidated,
        constraint_row.connoinherit,
        constraint_row.confupdtype,
        constraint_row.confdeltype,
        constraint_row.confmatchtype,
        referenced_relation.relname AS referenced_table,
        constraint_row.confkey::smallint[] AS referenced_columns
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_class AS relation
        ON relation.oid = constraint_row.conrelid
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      LEFT JOIN pg_catalog.pg_class AS referenced_relation
        ON referenced_relation.oid = constraint_row.confrelid
      WHERE namespace.nspname = 'public'
        AND relation.relname IN (
          'architecture_product_entitlements',
          'architecture_finance_issue_requests',
          'architecture_finance_issue_replay_guard'
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (table_name, constraint_name)
    WHERE expected.table_name IS NULL
       OR actual.table_name IS NULL
       OR actual.constraint_type IS DISTINCT FROM expected.constraint_type
       OR actual.key_columns IS DISTINCT FROM expected.key_columns
       OR actual.definition IS DISTINCT FROM expected.definition
       OR actual.condeferrable IS DISTINCT FROM false
       OR actual.condeferred IS DISTINCT FROM false
       OR actual.convalidated IS DISTINCT FROM true
       OR actual.connoinherit IS DISTINCT FROM false
       OR (
         expected.constraint_type = 'f'
         AND (
           actual.confupdtype IS DISTINCT FROM 'a'
           OR actual.confdeltype IS DISTINCT FROM 'c'
           OR actual.confmatchtype IS DISTINCT FROM 's'
           OR actual.referenced_table IS DISTINCT FROM 'architecture_finance_issue_requests'
           OR actual.referenced_columns IS DISTINCT FROM ARRAY[1]::smallint[]
         )
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: the exact nineteen-constraint contract differs.';
  END IF;

  -- Four explicit indexes in addition to constraint-owned indexes.
  IF EXISTS (
    WITH expected(table_name, index_name, key_definitions) AS (
      VALUES
        ('architecture_product_entitlements', 'idx_architecture_product_entitlements_status', ARRAY['product_code','status','active_until']::text[]),
        ('architecture_finance_issue_requests', 'idx_architecture_finance_issue_requests_created', ARRAY['created_at']::text[]),
        ('architecture_finance_issue_requests', 'idx_architecture_finance_issue_requests_subject_created', ARRAY['subject_digest','created_at DESC']::text[]),
        ('architecture_finance_issue_replay_guard', 'idx_architecture_finance_replay_guard_expiry', ARRAY['expires_at']::text[])
    ),
    actual AS (
      SELECT
        table_relation.relname AS table_name,
        index_relation.relname AS index_name,
        ARRAY(
          SELECT pg_catalog.pg_get_indexdef(index_row.indexrelid, key_number, true)
          FROM pg_catalog.generate_series(1, index_row.indnkeyatts) AS key_number
          ORDER BY key_number
        ) AS key_definitions,
        owner_role.rolname AS owner_name,
        access_method.amname AS access_method,
        index_relation.relpersistence,
        index_relation.reloptions,
        index_row.indisunique,
        index_row.indisprimary,
        index_row.indisexclusion,
        index_row.indimmediate,
        index_row.indisclustered,
        index_row.indisvalid,
        index_row.indcheckxmin,
        index_row.indisready,
        index_row.indislive,
        index_row.indnullsnotdistinct,
        index_row.indnkeyatts,
        index_row.indnatts,
        index_row.indexprs,
        index_row.indpred
      FROM pg_catalog.pg_index AS index_row
      JOIN pg_catalog.pg_class AS table_relation
        ON table_relation.oid = index_row.indrelid
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = table_relation.relnamespace
      JOIN pg_catalog.pg_class AS index_relation
        ON index_relation.oid = index_row.indexrelid
      JOIN pg_catalog.pg_roles AS owner_role
        ON owner_role.oid = index_relation.relowner
      JOIN pg_catalog.pg_am AS access_method
        ON access_method.oid = index_relation.relam
      WHERE namespace.nspname = 'public'
        AND table_relation.relname IN (
          'architecture_product_entitlements',
          'architecture_finance_issue_requests',
          'architecture_finance_issue_replay_guard'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_constraint AS constraint_row
          WHERE constraint_row.conindid = index_row.indexrelid
        )
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (table_name, index_name)
    WHERE expected.table_name IS NULL
       OR actual.table_name IS NULL
       OR actual.key_definitions IS DISTINCT FROM expected.key_definitions
       OR actual.owner_name IS DISTINCT FROM 'postgres'
       OR actual.access_method IS DISTINCT FROM 'btree'
       OR actual.relpersistence IS DISTINCT FROM 'p'
       OR actual.reloptions IS NOT NULL
       OR actual.indisunique IS DISTINCT FROM false
       OR actual.indisprimary IS DISTINCT FROM false
       OR actual.indisexclusion IS DISTINCT FROM false
       OR actual.indimmediate IS DISTINCT FROM true
       OR actual.indisclustered IS DISTINCT FROM false
       OR actual.indisvalid IS DISTINCT FROM true
       OR actual.indcheckxmin IS DISTINCT FROM false
       OR actual.indisready IS DISTINCT FROM true
       OR actual.indislive IS DISTINCT FROM true
       OR actual.indnullsnotdistinct IS DISTINCT FROM false
       OR actual.indnkeyatts IS DISTINCT FROM actual.indnatts
       OR actual.indexprs IS NOT NULL
       OR actual.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: the exact four-index contract differs.';
  END IF;

  -- Exact function overloads and execution metadata.
  IF EXISTS (
    WITH expected(
      function_name,
      identity_arguments,
      security_definer,
      default_count,
      default_expressions,
      result_type,
      argument_names
    ) AS (
      VALUES
        ('architecture_finance_set_updated_at_internal', '', false, 0, NULL, 'trigger', NULL::text[]),
        ('architecture_upsert_product_entitlement_internal', 'bytea, text, text, timestamp with time zone, timestamp with time zone', true, 2, 'NULL::timestamp with time zone, NULL::timestamp with time zone', 'jsonb', ARRAY['p_subject_digest','p_product_code','p_status','p_active_from','p_active_until']::text[]),
        ('architecture_begin_finance_issue_internal', 'uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone', true, 0, NULL, 'jsonb', ARRAY['p_request_id','p_subject_digest','p_init_data_digest','p_product_code','p_network_nonce_digest','p_request_fingerprint','p_finance_timestamp','p_replay_expires_at']::text[]),
        ('architecture_finish_finance_issue_internal', 'uuid, bytea, text, timestamp with time zone', true, 1, 'NULL::timestamp with time zone', 'jsonb', ARRAY['p_request_id','p_request_fingerprint','p_outcome','p_response_expires_at']::text[])
    ),
    actual AS (
      SELECT
        procedure.proname AS function_name,
        pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
        procedure.prosecdef AS security_definer,
        procedure.pronargdefaults::integer AS default_count,
        pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) AS default_expressions,
        pg_catalog.pg_get_function_result(procedure.oid) AS result_type,
        procedure.proargnames AS argument_names,
        owner_role.rolname AS owner_name,
        language.lanname AS language_name,
        procedure.prokind,
        procedure.provolatile,
        procedure.proparallel,
        procedure.proisstrict,
        procedure.proleakproof,
        procedure.proretset,
        procedure.proallargtypes,
        procedure.proargmodes,
        procedure.proconfig
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      JOIN pg_catalog.pg_roles AS owner_role
        ON owner_role.oid = procedure.proowner
      JOIN pg_catalog.pg_language AS language
        ON language.oid = procedure.prolang
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
    FULL JOIN actual USING (function_name, identity_arguments)
    WHERE expected.function_name IS NULL
       OR actual.function_name IS NULL
       OR actual.security_definer IS DISTINCT FROM expected.security_definer
       OR actual.default_count IS DISTINCT FROM expected.default_count
       OR actual.default_expressions IS DISTINCT FROM expected.default_expressions
       OR actual.result_type IS DISTINCT FROM expected.result_type
       OR actual.argument_names IS DISTINCT FROM expected.argument_names
       OR actual.owner_name IS DISTINCT FROM 'postgres'
       OR actual.language_name IS DISTINCT FROM 'plpgsql'
       OR actual.prokind IS DISTINCT FROM 'f'
       OR actual.provolatile IS DISTINCT FROM 'v'
       OR actual.proparallel IS DISTINCT FROM 'u'
       OR actual.proisstrict IS DISTINCT FROM false
       OR actual.proleakproof IS DISTINCT FROM false
       OR actual.proretset IS DISTINCT FROM false
       OR actual.proallargtypes IS NOT NULL
       OR actual.proargmodes IS NOT NULL
       OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: overloads or exact function metadata differ.';
  END IF;

  -- Exactly two user triggers; FK implementation triggers are internal and
  -- intentionally excluded from this user-trigger contract.
  IF EXISTS (
    WITH expected(table_name, trigger_name) AS (
      VALUES
        ('architecture_product_entitlements', 'trg_architecture_product_entitlements_updated_at'),
        ('architecture_finance_issue_requests', 'trg_architecture_finance_issue_requests_updated_at')
    ),
    actual AS (
      SELECT
        relation.relname AS table_name,
        trigger_row.tgname AS trigger_name,
        procedure.proname AS function_name,
        trigger_row.tgtype,
        trigger_row.tgenabled,
        trigger_row.tgisinternal,
        trigger_row.tgconstraint,
        trigger_row.tgnargs,
        trigger_row.tgqual
      FROM pg_catalog.pg_trigger AS trigger_row
      JOIN pg_catalog.pg_class AS relation
        ON relation.oid = trigger_row.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_proc AS procedure
        ON procedure.oid = trigger_row.tgfoid
      WHERE namespace.nspname = 'public'
        AND relation.relname IN (
          'architecture_product_entitlements',
          'architecture_finance_issue_requests',
          'architecture_finance_issue_replay_guard'
        )
        AND NOT trigger_row.tgisinternal
    )
    SELECT 1
    FROM expected
    FULL JOIN actual USING (table_name, trigger_name)
    WHERE expected.table_name IS NULL
       OR actual.table_name IS NULL
       OR actual.function_name IS DISTINCT FROM 'architecture_finance_set_updated_at_internal'
       OR actual.tgtype IS DISTINCT FROM 19
       OR actual.tgenabled IS DISTINCT FROM 'O'
       OR actual.tgisinternal IS DISTINCT FROM false
       OR actual.tgconstraint IS DISTINCT FROM 0
       OR actual.tgnargs IS DISTINCT FROM 0
       OR actual.tgqual IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: the exact two-trigger contract differs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid IN (
      'public.architecture_product_entitlements'::regclass,
      'public.architecture_finance_issue_requests'::regclass,
      'public.architecture_finance_issue_replay_guard'::regclass
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Main Finance integration postflight failed: integration tables must have zero RLS policies.';
  END IF;

  -- Exact table/column ACL allow-list is empty. Ownership remains the only
  -- direct table access; service_role must use the three RPC functions.
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
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_product_entitlements',
        'architecture_finance_issue_requests',
        'architecture_finance_issue_replay_guard'
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Main Finance integration postflight failed: table or column ACL allow-list is not empty.';
  END IF;

  -- Exact function ACL allow-list: service_role EXECUTE, granted by postgres,
  -- without grant option, on each service RPC and nowhere on the trigger helper.
  IF EXISTS (
    WITH expected(function_name, identity_arguments, grantee_name, grantor_name, privilege_type, is_grantable) AS (
      VALUES
        ('architecture_upsert_product_entitlement_internal', 'bytea, text, text, timestamp with time zone, timestamp with time zone', 'service_role', 'postgres', 'EXECUTE', false),
        ('architecture_begin_finance_issue_internal', 'uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone', 'service_role', 'postgres', 'EXECUTE', false),
        ('architecture_finish_finance_issue_internal', 'uuid, bytea, text, timestamp with time zone', 'service_role', 'postgres', 'EXECUTE', false)
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
          'architecture_finance_set_updated_at_internal',
          'architecture_upsert_product_entitlement_internal',
          'architecture_begin_finance_issue_internal',
          'architecture_finish_finance_issue_internal'
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
      MESSAGE = 'Main Finance integration postflight failed: exact function ACL allow-list differs.';
  END IF;
END;
$postflight$;

COMMIT;

-- End of DRAFT. No execution evidence exists until this migration is applied
-- and behavior-tested on a disposable main staging project.
