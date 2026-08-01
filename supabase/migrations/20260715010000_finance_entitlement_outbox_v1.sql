-- DRAFT / NOT APPLIED / STAGING ONLY
-- Main desired-state and durable outbox foundation for Finance access.
--
-- This migration is additive for tables/data and does not change public.users
-- or existing entitlement rows. It intentionally tightens one foundation ACL:
-- service_role loses direct EXECUTE on the legacy entitlement upsert once the
-- audited desired-state/outbox path exists. The private worker resolves the
-- trusted Main user only through the separate service-only resolver migration;
-- these tables store only the Main user UUID and keyed subject digest.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL client_min_messages = warning;

DO $preflight$
DECLARE
  v_table_count integer;
  v_function_count integer;
  v_user_id_attribute smallint;
  v_user_id_is_unique boolean;
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance entitlement outbox preflight failed: migration must run as postgres.';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.architecture_product_entitlements') IS NULL
     OR to_regprocedure('public.architecture_finance_set_updated_at_internal()') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance entitlement outbox preflight failed: reviewed Main foundation is missing.';
  END IF;

  SELECT attribute.attnum
  INTO v_user_id_attribute
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.users'::regclass
    AND attribute.attname = 'id'
    AND attribute.atttypid = 'uuid'::regtype
    AND attribute.attnotnull
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_user_id_attribute IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance entitlement outbox preflight failed: public.users.id must be a non-null uuid in staging.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    WHERE index_row.indrelid = 'public.users'::regclass
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indpred IS NULL
      AND index_row.indexprs IS NULL
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = v_user_id_attribute
  )
  INTO v_user_id_is_unique;

  IF NOT v_user_id_is_unique THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance entitlement outbox preflight failed: public.users.id must have a single-column unique key.';
  END IF;

  SELECT count(*)
  INTO v_table_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
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
    );

  IF v_table_count <> 0 OR v_function_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance entitlement outbox objects already exist; this one-shot staging migration rejects drift and reruns.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance entitlement outbox preflight failed: service_role cannot use schema public.';
  END IF;
END;
$preflight$;

CREATE TABLE public.architecture_finance_access_desired (
  main_user_id uuid NOT NULL,
  subject_digest bytea NOT NULL,
  product_code text NOT NULL DEFAULT 'architecture_finance',
  desired_state text NOT NULL,
  version bigint NOT NULL,
  last_event_id uuid NOT NULL,
  changed_by text NOT NULL,
  change_reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_version bigint NOT NULL DEFAULT 0,
  applied_state text,
  applied_at timestamp with time zone,
  CONSTRAINT architecture_finance_access_desired_pkey
    PRIMARY KEY (main_user_id, product_code),
  CONSTRAINT architecture_finance_access_desired_user_fkey
    FOREIGN KEY (main_user_id)
    REFERENCES public.users(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT architecture_finance_access_desired_subject_check
    CHECK (octet_length(subject_digest) = 32),
  CONSTRAINT architecture_finance_access_desired_subject_unique
    UNIQUE (subject_digest, product_code),
  CONSTRAINT architecture_finance_access_desired_identity_unique
    UNIQUE (main_user_id, product_code, subject_digest),
  CONSTRAINT architecture_finance_access_desired_product_check
    CHECK (product_code = 'architecture_finance'),
  CONSTRAINT architecture_finance_access_desired_state_check
    CHECK (desired_state IN ('granted', 'revoked')),
  CONSTRAINT architecture_finance_access_desired_version_check
    CHECK (version >= 1),
  CONSTRAINT architecture_finance_access_desired_applied_version_check
    CHECK (applied_version >= 0 AND applied_version <= version),
  CONSTRAINT architecture_finance_access_desired_applied_fields_check
    CHECK (
      (
        applied_version = 0
        AND applied_state IS NULL
        AND applied_at IS NULL
      )
      OR (
        applied_version > 0
        AND applied_state IN ('granted', 'revoked')
        AND applied_at IS NOT NULL
      )
    ),
  CONSTRAINT architecture_finance_access_desired_actor_check
    CHECK (
      changed_by = btrim(changed_by)
      AND char_length(changed_by) BETWEEN 3 AND 128
      AND changed_by ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  CONSTRAINT architecture_finance_access_desired_reason_check
    CHECK (
      change_reason = btrim(change_reason)
      AND char_length(change_reason) BETWEEN 1 AND 500
      AND change_reason !~ '[[:cntrl:]]'
    ),
  CONSTRAINT architecture_finance_access_desired_last_event_unique
    UNIQUE (last_event_id)
);

CREATE TABLE public.architecture_finance_access_outbox (
  event_id uuid NOT NULL,
  main_user_id uuid NOT NULL,
  subject_digest bytea NOT NULL,
  product_code text NOT NULL DEFAULT 'architecture_finance',
  desired_state text NOT NULL,
  version bigint NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  claim_token uuid,
  claim_tokens uuid[] NOT NULL DEFAULT '{}'::uuid[],
  claimed_by text,
  claimed_at timestamp with time zone,
  lease_expires_at timestamp with time zone,
  last_error_code text,
  changed_by text NOT NULL,
  change_reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_at timestamp with time zone,
  CONSTRAINT architecture_finance_access_outbox_pkey
    PRIMARY KEY (event_id),
  CONSTRAINT architecture_finance_access_outbox_desired_fkey
    FOREIGN KEY (main_user_id, product_code, subject_digest)
    REFERENCES public.architecture_finance_access_desired(main_user_id, product_code, subject_digest)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT architecture_finance_access_outbox_version_unique
    UNIQUE (main_user_id, product_code, version),
  CONSTRAINT architecture_finance_access_outbox_claim_token_unique
    UNIQUE (claim_token),
  CONSTRAINT architecture_finance_access_outbox_claim_tokens_check
    CHECK (
      cardinality(claim_tokens) BETWEEN 0 AND 8
      AND array_position(claim_tokens, NULL) IS NULL
    ),
  CONSTRAINT architecture_finance_access_outbox_subject_check
    CHECK (octet_length(subject_digest) = 32),
  CONSTRAINT architecture_finance_access_outbox_product_check
    CHECK (product_code = 'architecture_finance'),
  CONSTRAINT architecture_finance_access_outbox_desired_state_check
    CHECK (desired_state IN ('granted', 'revoked')),
  CONSTRAINT architecture_finance_access_outbox_version_check
    CHECK (version >= 1),
  CONSTRAINT architecture_finance_access_outbox_state_check
    CHECK (state IN ('pending', 'processing', 'retry_wait', 'applied', 'dead_letter')),
  CONSTRAINT architecture_finance_access_outbox_attempt_check
    CHECK (attempt_count BETWEEN 0 AND 8),
  CONSTRAINT architecture_finance_access_outbox_next_attempt_check
    CHECK (next_attempt_at >= created_at),
  CONSTRAINT architecture_finance_access_outbox_actor_check
    CHECK (
      changed_by = btrim(changed_by)
      AND char_length(changed_by) BETWEEN 3 AND 128
      AND changed_by ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  CONSTRAINT architecture_finance_access_outbox_reason_check
    CHECK (
      change_reason = btrim(change_reason)
      AND char_length(change_reason) BETWEEN 1 AND 500
      AND change_reason !~ '[[:cntrl:]]'
    ),
  CONSTRAINT architecture_finance_access_outbox_error_check
    CHECK (
      last_error_code IS NULL
      OR (
        char_length(last_error_code) BETWEEN 1 AND 64
        AND last_error_code ~ '^[a-z0-9_]+$'
      )
    ),
  CONSTRAINT architecture_finance_access_outbox_lifecycle_check
    CHECK (
      (
        state = 'pending'
        AND attempt_count = 0
        AND claim_token IS NULL
        AND cardinality(claim_tokens) = 0
        AND claimed_by IS NULL
        AND claimed_at IS NULL
        AND lease_expires_at IS NULL
        AND last_error_code IS NULL
        AND applied_at IS NULL
      )
      OR (
        state = 'processing'
        AND attempt_count BETWEEN 1 AND 8
        AND claim_token IS NOT NULL
        AND cardinality(claim_tokens) = attempt_count
        AND claim_token = claim_tokens[cardinality(claim_tokens)]
        AND claimed_by IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at > claimed_at
        AND last_error_code IS NULL
        AND applied_at IS NULL
      )
      OR (
        state = 'retry_wait'
        AND attempt_count BETWEEN 1 AND 7
        AND claim_token IS NOT NULL
        AND cardinality(claim_tokens) = attempt_count
        AND claim_token = claim_tokens[cardinality(claim_tokens)]
        AND claimed_by IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NULL
        AND last_error_code IS NOT NULL
        AND applied_at IS NULL
      )
      OR (
        state = 'applied'
        AND attempt_count BETWEEN 1 AND 8
        AND claim_token IS NOT NULL
        AND cardinality(claim_tokens) = attempt_count
        AND claim_token = claim_tokens[cardinality(claim_tokens)]
        AND claimed_by IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NULL
        AND last_error_code IS NULL
        AND applied_at IS NOT NULL
      )
      OR (
        state = 'dead_letter'
        AND attempt_count BETWEEN 1 AND 8
        AND claim_token IS NOT NULL
        AND cardinality(claim_tokens) = attempt_count
        AND claim_token = claim_tokens[cardinality(claim_tokens)]
        AND claimed_by IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NULL
        AND last_error_code IS NOT NULL
        AND applied_at IS NULL
      )
    )
);

ALTER TABLE public.architecture_finance_access_desired
  ADD CONSTRAINT architecture_finance_access_desired_last_event_fkey
  FOREIGN KEY (last_event_id)
  REFERENCES public.architecture_finance_access_outbox(event_id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.architecture_finance_access_desired OWNER TO postgres;
ALTER TABLE public.architecture_finance_access_outbox OWNER TO postgres;

CREATE INDEX idx_architecture_finance_access_desired_state
ON public.architecture_finance_access_desired (desired_state, updated_at, main_user_id);

CREATE INDEX idx_architecture_finance_access_outbox_due
ON public.architecture_finance_access_outbox (state, next_attempt_at, created_at, event_id);

CREATE INDEX idx_architecture_finance_access_outbox_user_version
ON public.architecture_finance_access_outbox (main_user_id, product_code, version, state);

-- The foundation intentionally removes every direct EXECUTE ACL from the
-- postgres-owned trigger helper. PostgreSQL checks EXECUTE again when a later
-- migration creates another trigger, so restore the owner's privilege only
-- for the two CREATE TRIGGER statements below and remove it immediately after.
GRANT EXECUTE ON FUNCTION public.architecture_finance_set_updated_at_internal()
TO postgres;

DROP TRIGGER IF EXISTS trg_architecture_finance_access_desired_updated_at
ON public.architecture_finance_access_desired;
CREATE TRIGGER trg_architecture_finance_access_desired_updated_at
BEFORE UPDATE ON public.architecture_finance_access_desired
FOR EACH ROW
EXECUTE FUNCTION public.architecture_finance_set_updated_at_internal();

DROP TRIGGER IF EXISTS trg_architecture_finance_access_outbox_updated_at
ON public.architecture_finance_access_outbox;
CREATE TRIGGER trg_architecture_finance_access_outbox_updated_at
BEFORE UPDATE ON public.architecture_finance_access_outbox
FOR EACH ROW
EXECUTE FUNCTION public.architecture_finance_set_updated_at_internal();

REVOKE ALL ON FUNCTION public.architecture_finance_set_updated_at_internal()
FROM postgres;

CREATE FUNCTION public.architecture_set_finance_access_desired_internal(
  p_event_id uuid,
  p_main_user_id uuid,
  p_subject_digest bytea,
  p_desired_state text,
  p_changed_by text,
  p_change_reason text,
  p_expected_version bigint
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
  v_existing public.architecture_finance_access_outbox%ROWTYPE;
  v_desired public.architecture_finance_access_desired%ROWTYPE;
  v_gate_result jsonb;
  v_version bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;

  IF p_event_id IS NULL
     OR p_event_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_main_user_id IS NULL
     OR octet_length(p_subject_digest) IS DISTINCT FROM 32
     OR p_desired_state IS NULL
     OR p_desired_state NOT IN ('granted', 'revoked')
     OR p_expected_version IS NULL
     OR p_expected_version < 0
     OR p_changed_by IS NULL
     OR p_changed_by IS DISTINCT FROM btrim(p_changed_by)
     OR char_length(p_changed_by) NOT BETWEEN 3 AND 128
     OR p_changed_by !~ '^[a-z][a-z0-9_.:-]*$'
     OR p_change_reason IS NULL
     OR p_change_reason IS DISTINCT FROM btrim(p_change_reason)
     OR char_length(p_change_reason) NOT BETWEEN 1 AND 500
     OR p_change_reason ~ '[[:cntrl:]]'
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text, 7402001)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_main_user_id::text, 7402002)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(encode(p_subject_digest, 'hex'), 7402005)
  );

  SELECT outbox_row.*
  INTO v_existing
  FROM public.architecture_finance_access_outbox AS outbox_row
  WHERE outbox_row.event_id = p_event_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.main_user_id IS DISTINCT FROM p_main_user_id
       OR v_existing.subject_digest IS DISTINCT FROM p_subject_digest
       OR v_existing.product_code IS DISTINCT FROM 'architecture_finance'
       OR v_existing.desired_state IS DISTINCT FROM p_desired_state
       OR v_existing.changed_by IS DISTINCT FROM p_changed_by
       OR v_existing.change_reason IS DISTINCT FROM p_change_reason
    THEN
      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'event_id', v_existing.event_id,
      'version', v_existing.version::text,
      'state', v_existing.state
    );
  END IF;

  PERFORM 1
  FROM public.users AS user_row
  WHERE user_row.id = p_main_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'main_user_not_found');
  END IF;

  SELECT desired_row.*
  INTO v_desired
  FROM public.architecture_finance_access_desired AS desired_row
  WHERE desired_row.main_user_id = p_main_user_id
    AND desired_row.product_code = 'architecture_finance'
  FOR UPDATE;

  IF FOUND THEN
    IF v_desired.subject_digest IS DISTINCT FROM p_subject_digest THEN
      RETURN jsonb_build_object('ok', false, 'error', 'subject_digest_conflict');
    END IF;
    IF v_desired.version IS DISTINCT FROM p_expected_version THEN
      RETURN jsonb_build_object('ok', false, 'error', 'version_conflict');
    END IF;
    v_version := v_desired.version + 1;
    UPDATE public.architecture_finance_access_desired
    SET desired_state = p_desired_state,
        version = v_version,
        last_event_id = p_event_id,
        changed_by = p_changed_by,
        change_reason = p_change_reason,
        updated_at = clock_timestamp()
    WHERE main_user_id = p_main_user_id
      AND product_code = 'architecture_finance';
  ELSE
    IF p_expected_version IS DISTINCT FROM 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'version_conflict');
    END IF;

    PERFORM 1
    FROM public.architecture_finance_access_desired AS desired_row
    WHERE desired_row.subject_digest = p_subject_digest
      AND desired_row.product_code = 'architecture_finance'
      AND desired_row.main_user_id IS DISTINCT FROM p_main_user_id
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'subject_digest_conflict');
    END IF;

    v_version := 1;
    INSERT INTO public.architecture_finance_access_desired (
      main_user_id,
      subject_digest,
      product_code,
      desired_state,
      version,
      last_event_id,
      changed_by,
      change_reason
    ) VALUES (
      p_main_user_id,
      p_subject_digest,
      'architecture_finance',
      p_desired_state,
      v_version,
      p_event_id,
      p_changed_by,
      p_change_reason
    );
  END IF;

  SELECT public.architecture_upsert_product_entitlement_internal(
    p_subject_digest,
    'architecture_finance',
    'blocked'
  ) INTO v_gate_result;

  IF v_gate_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Finance access desired-state gate update failed.';
  END IF;

  INSERT INTO public.architecture_finance_access_outbox (
    event_id,
    main_user_id,
    subject_digest,
    product_code,
    desired_state,
    version,
    changed_by,
    change_reason
  ) VALUES (
    p_event_id,
    p_main_user_id,
    p_subject_digest,
    'architecture_finance',
    p_desired_state,
    v_version,
    p_changed_by,
    p_change_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'event_id', p_event_id,
    'version', v_version::text,
    'state', 'pending'
  );
END;
$function$;

ALTER FUNCTION public.architecture_set_finance_access_desired_internal(uuid, uuid, bytea, text, text, text, bigint)
OWNER TO postgres;

CREATE FUNCTION public.architecture_get_finance_access_status_internal(
  p_main_user_id uuid,
  p_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
NOT LEAKPROOF
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_desired public.architecture_finance_access_desired%ROWTYPE;
  v_event public.architecture_finance_access_outbox%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;

  IF p_main_user_id IS NULL
     OR p_main_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR (
       p_event_id IS NOT NULL
       AND p_event_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  PERFORM 1
  FROM public.users AS user_row
  WHERE user_row.id = p_main_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'main_user_not_found');
  END IF;

  SELECT desired_row.*
  INTO v_desired
  FROM public.architecture_finance_access_desired AS desired_row
  WHERE desired_row.main_user_id = p_main_user_id
    AND desired_row.product_code = 'architecture_finance';

  IF p_event_id IS NOT NULL THEN
    SELECT outbox_row.*
    INTO v_event
    FROM public.architecture_finance_access_outbox AS outbox_row
    WHERE outbox_row.event_id = p_event_id;

    IF FOUND AND v_event.main_user_id IS DISTINCT FROM p_main_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'event_user_conflict');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'main_user_id', p_main_user_id,
    'current_version', coalesce(v_desired.version, 0)::text,
    'desired_state', v_desired.desired_state,
    'applied_version', coalesce(v_desired.applied_version, 0)::text,
    'applied_state', v_desired.applied_state,
    'event', CASE
      WHEN v_event.event_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'event_id', v_event.event_id,
        'version', v_event.version::text,
        'desired_state', v_event.desired_state,
        'state', v_event.state
      )
    END
  );
END;
$function$;

ALTER FUNCTION public.architecture_get_finance_access_status_internal(uuid, uuid)
OWNER TO postgres;

CREATE FUNCTION public.architecture_claim_finance_access_outbox_internal(
  p_claim_token uuid,
  p_worker_ref text,
  p_lease_seconds integer DEFAULT 60,
  p_event_id uuid DEFAULT NULL
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
  v_existing public.architecture_finance_access_outbox%ROWTYPE;
  v_event public.architecture_finance_access_outbox%ROWTYPE;
  v_now timestamp with time zone := clock_timestamp();
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;

  IF p_claim_token IS NULL
     OR p_claim_token::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_worker_ref IS NULL
     OR p_worker_ref IS DISTINCT FROM btrim(p_worker_ref)
     OR char_length(p_worker_ref) NOT BETWEEN 3 AND 128
     OR p_worker_ref !~ '^[a-z][a-z0-9_.:-]*$'
     OR p_lease_seconds IS NULL
     OR p_lease_seconds NOT BETWEEN 15 AND 300
     OR (
       p_event_id IS NOT NULL
       AND p_event_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_claim_token::text, 7402003)
  );

  SELECT outbox_row.*
  INTO v_existing
  FROM public.architecture_finance_access_outbox AS outbox_row
  WHERE p_claim_token = ANY(outbox_row.claim_tokens)
  FOR UPDATE;

  IF FOUND THEN
    IF p_event_id IS NOT NULL AND v_existing.event_id IS DISTINCT FROM p_event_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'claim_token_conflict');
    END IF;

    IF v_existing.claim_token IS DISTINCT FROM p_claim_token THEN
      RETURN jsonb_build_object('ok', false, 'error', 'claim_token_consumed');
    END IF;

    IF v_existing.claimed_by IS DISTINCT FROM p_worker_ref THEN
      RETURN jsonb_build_object('ok', false, 'error', 'claim_token_conflict');
    END IF;

    IF v_existing.state = 'processing'
       AND v_existing.lease_expires_at > v_now
    THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replayed', true,
        'event', jsonb_build_object(
          'event_id', v_existing.event_id,
          'main_user_id', v_existing.main_user_id,
          'subject_digest', encode(v_existing.subject_digest, 'hex'),
          'product_code', v_existing.product_code,
          'desired_state', v_existing.desired_state,
          'event_version', v_existing.version::text,
          'event_occurred_at', to_char(
            v_existing.created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'attempt_count', v_existing.attempt_count,
          'lease_expires_at', v_existing.lease_expires_at
        )
      );
    END IF;

    RETURN jsonb_build_object('ok', false, 'error', 'claim_token_consumed');
  END IF;

  UPDATE public.architecture_finance_access_outbox
  SET state = 'dead_letter',
      lease_expires_at = NULL,
      last_error_code = 'lease_expired_max_attempts',
      updated_at = v_now
  WHERE state = 'processing'
    AND lease_expires_at <= v_now
    AND attempt_count >= 8;

  SELECT candidate.*
  INTO v_event
  FROM public.architecture_finance_access_outbox AS candidate
  WHERE (
      (
        candidate.state IN ('pending', 'retry_wait')
        AND candidate.next_attempt_at <= v_now
      )
      OR (
        candidate.state = 'processing'
        AND candidate.lease_expires_at <= v_now
        AND candidate.attempt_count < 8
      )
    )
    AND (p_event_id IS NULL OR candidate.event_id = p_event_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.architecture_finance_access_outbox AS earlier
      WHERE earlier.main_user_id = candidate.main_user_id
        AND earlier.product_code = candidate.product_code
        AND earlier.version < candidate.version
        AND earlier.state NOT IN ('applied', 'dead_letter')
    )
  ORDER BY candidate.created_at, candidate.event_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', false,
      'event', NULL
    );
  END IF;

  UPDATE public.architecture_finance_access_outbox
  SET state = 'processing',
      attempt_count = v_event.attempt_count + 1,
      claim_token = p_claim_token,
      claim_tokens = array_append(v_event.claim_tokens, p_claim_token),
      claimed_by = p_worker_ref,
      claimed_at = v_now,
      lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
      last_error_code = NULL,
      applied_at = NULL,
      updated_at = v_now
  WHERE event_id = v_event.event_id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'event', jsonb_build_object(
      'event_id', v_event.event_id,
      'main_user_id', v_event.main_user_id,
      'subject_digest', encode(v_event.subject_digest, 'hex'),
      'product_code', v_event.product_code,
      'desired_state', v_event.desired_state,
      'event_version', v_event.version::text,
      'event_occurred_at', to_char(
        v_event.created_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'attempt_count', v_event.attempt_count,
      'lease_expires_at', v_event.lease_expires_at
    )
  );
END;
$function$;

ALTER FUNCTION public.architecture_claim_finance_access_outbox_internal(uuid, text, integer, uuid)
OWNER TO postgres;

CREATE FUNCTION public.architecture_finish_finance_access_outbox_internal(
  p_event_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text DEFAULT NULL
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
  v_event public.architecture_finance_access_outbox%ROWTYPE;
  v_desired public.architecture_finance_access_desired%ROWTYPE;
  v_gate_result jsonb;
  v_gate_status text;
  v_now timestamp with time zone := clock_timestamp();
  v_backoff_seconds integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'service_role is required';
  END IF;

  IF p_event_id IS NULL
     OR p_claim_token IS NULL
     OR p_claim_token::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_outcome IS NULL
     OR p_outcome NOT IN ('applied', 'retry', 'dead_letter')
     OR (
       p_outcome = 'applied'
       AND p_error_code IS NOT NULL
     )
     OR (
       p_outcome IN ('retry', 'dead_letter')
       AND (
         p_error_code IS NULL
         OR char_length(p_error_code) NOT BETWEEN 1 AND 64
         OR p_error_code !~ '^[a-z0-9_]+$'
       )
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text, 7402004)
  );

  SELECT outbox_row.*
  INTO v_event
  FROM public.architecture_finance_access_outbox AS outbox_row
  WHERE outbox_row.event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_event.claim_token IS NOT DISTINCT FROM p_claim_token THEN
    IF v_event.state = 'applied' AND p_outcome = 'applied' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replayed', true,
        'state', 'applied',
        'version', v_event.version::text
      );
    END IF;

    IF v_event.state = 'retry_wait'
       AND p_outcome = 'retry'
       AND v_event.last_error_code IS NOT DISTINCT FROM p_error_code
    THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replayed', true,
        'state', 'retry_wait',
        'version', v_event.version::text,
        'next_attempt_at', v_event.next_attempt_at
      );
    END IF;

    IF v_event.state = 'dead_letter'
       AND p_outcome IN ('retry', 'dead_letter')
       AND v_event.last_error_code IS NOT DISTINCT FROM p_error_code
    THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replayed', true,
        'state', 'dead_letter',
        'version', v_event.version::text
      );
    END IF;
  END IF;

  IF v_event.state IS DISTINCT FROM 'processing'
     OR v_event.claim_token IS DISTINCT FROM p_claim_token
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'claim_conflict');
  END IF;

  IF v_event.lease_expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lease_expired');
  END IF;

  IF p_outcome = 'applied' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_event.main_user_id::text, 7402002)
    );

    SELECT desired_row.*
    INTO v_desired
    FROM public.architecture_finance_access_desired AS desired_row
    WHERE desired_row.main_user_id = v_event.main_user_id
      AND desired_row.product_code = v_event.product_code
    FOR UPDATE;

    IF NOT FOUND OR v_desired.subject_digest IS DISTINCT FROM v_event.subject_digest THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Finance access desired-state identity invariant failed.';
    END IF;

    v_gate_status := CASE
      WHEN v_event.desired_state = 'granted'
       AND v_desired.version = v_event.version
       AND v_desired.desired_state = 'granted'
      THEN 'manual'
      ELSE 'blocked'
    END;

    SELECT public.architecture_upsert_product_entitlement_internal(
      v_event.subject_digest,
      'architecture_finance',
      v_gate_status
    ) INTO v_gate_result;

    IF v_gate_result ->> 'ok' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Finance access applied-state gate update failed.';
    END IF;

    UPDATE public.architecture_finance_access_outbox
    SET state = 'applied',
        lease_expires_at = NULL,
        last_error_code = NULL,
        applied_at = v_now,
        updated_at = v_now
    WHERE event_id = p_event_id;

    UPDATE public.architecture_finance_access_desired
    SET applied_version = v_event.version,
        applied_state = v_event.desired_state,
        applied_at = v_now,
        updated_at = v_now
    WHERE main_user_id = v_event.main_user_id
      AND product_code = v_event.product_code
      AND applied_version < v_event.version;

    RETURN jsonb_build_object(
      'ok', true,
      'replayed', false,
      'state', 'applied',
      'version', v_event.version::text
    );
  END IF;

  IF p_outcome = 'dead_letter' OR v_event.attempt_count >= 8 THEN
    UPDATE public.architecture_finance_access_outbox
    SET state = 'dead_letter',
        lease_expires_at = NULL,
        last_error_code = p_error_code,
        applied_at = NULL,
        updated_at = v_now
    WHERE event_id = p_event_id;

    RETURN jsonb_build_object(
      'ok', true,
      'replayed', false,
      'state', 'dead_letter',
      'version', v_event.version::text
    );
  END IF;

  v_backoff_seconds := 15 * power(2::numeric, v_event.attempt_count - 1)::integer;

  UPDATE public.architecture_finance_access_outbox
  SET state = 'retry_wait',
      next_attempt_at = v_now + pg_catalog.make_interval(secs => v_backoff_seconds),
      lease_expires_at = NULL,
      last_error_code = p_error_code,
      applied_at = NULL,
      updated_at = v_now
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'state', 'retry_wait',
    'version', v_event.version::text,
    'next_attempt_at', v_now + pg_catalog.make_interval(secs => v_backoff_seconds)
  );
END;
$function$;

ALTER FUNCTION public.architecture_finish_finance_access_outbox_internal(uuid, uuid, text, text)
OWNER TO postgres;

ALTER TABLE public.architecture_finance_access_desired ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architecture_finance_access_outbox ENABLE ROW LEVEL SECURITY;

DO $acl_hardening$
DECLARE
  v_acl record;
  v_grantee_sql text;
  v_function regprocedure;
BEGIN
  FOR v_acl IN
    SELECT DISTINCT
      relation.oid AS relation_oid,
      namespace.nspname AS schema_name,
      relation.relname AS relation_name,
      exploded.grantee
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_finance_access_desired',
        'architecture_finance_access_outbox'
      )
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %s CASCADE',
      v_acl.schema_name,
      v_acl.relation_name,
      v_grantee_sql
    );
  END LOOP;

  FOR v_acl IN
    SELECT DISTINCT
      attribute.attrelid AS relation_oid,
      namespace.nspname AS schema_name,
      relation.relname AS relation_name,
      attribute.attname AS column_name,
      exploded.grantee
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_finance_access_desired',
        'architecture_finance_access_outbox'
      )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  LOOP
    v_grantee_sql := CASE
      WHEN v_acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
    END;
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM %s CASCADE',
      v_acl.column_name,
      v_acl.schema_name,
      v_acl.relation_name,
      v_grantee_sql
    );
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'public.architecture_set_finance_access_desired_internal(uuid,uuid,bytea,text,text,text,bigint)'::regprocedure,
    'public.architecture_get_finance_access_status_internal(uuid,uuid)'::regprocedure,
    'public.architecture_claim_finance_access_outbox_internal(uuid,text,integer,uuid)'::regprocedure,
    'public.architecture_finish_finance_access_outbox_internal(uuid,uuid,text,text)'::regprocedure
  ]
  LOOP
    FOR v_acl IN
      SELECT DISTINCT exploded.grantee
      FROM pg_catalog.pg_proc AS procedure
      CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS exploded
      WHERE procedure.oid = v_function
    LOOP
      v_grantee_sql := CASE
        WHEN v_acl.grantee = 0 THEN 'PUBLIC'
        ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_acl.grantee))
      END;
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s CASCADE',
        v_function,
        v_grantee_sql
      );
    END LOOP;
  END LOOP;
END;
$acl_hardening$;

REVOKE ALL ON TABLE public.architecture_finance_access_desired
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.architecture_finance_access_outbox
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.architecture_set_finance_access_desired_internal(uuid, uuid, bytea, text, text, text, bigint)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.architecture_get_finance_access_status_internal(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.architecture_claim_finance_access_outbox_internal(uuid, text, integer, uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.architecture_finish_finance_access_outbox_internal(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.architecture_set_finance_access_desired_internal(uuid, uuid, bytea, text, text, text, bigint)
TO service_role;
GRANT EXECUTE ON FUNCTION public.architecture_get_finance_access_status_internal(uuid, uuid)
TO service_role;
GRANT EXECUTE ON FUNCTION public.architecture_claim_finance_access_outbox_internal(uuid, text, integer, uuid)
TO service_role;
GRANT EXECUTE ON FUNCTION public.architecture_finish_finance_access_outbox_internal(uuid, uuid, text, text)
TO service_role;

-- From this migration onward the outbox is the only service-role write path.
-- The postgres-owned setter/finish functions may still call the foundation
-- primitive as SECURITY DEFINER, but an operator service key cannot bypass
-- desired-state versioning and audit by calling it directly.
REVOKE ALL ON FUNCTION public.architecture_upsert_product_entitlement_internal(bytea, text, text, timestamp with time zone, timestamp with time zone)
FROM service_role;

DO $postflight$
DECLARE
  v_table_count integer;
  v_column_count integer;
  v_constraint_count integer;
  v_function_count integer;
  v_trigger_count integer;
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
     OR v_function_count <> 4
     OR v_trigger_count <> 2
     OR v_policy_count <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'Finance entitlement outbox postflight mismatch: tables=%s columns=%s constraints=%s functions=%s triggers=%s policies=%s',
        v_table_count,
        v_column_count,
        v_constraint_count,
        v_function_count,
        v_trigger_count,
        v_policy_count
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS exploded
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'architecture_finance_access_desired',
        'architecture_finance_access_outbox'
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded
    WHERE attribute.attrelid IN (
        'public.architecture_finance_access_desired'::regclass,
        'public.architecture_finance_access_outbox'::regclass
      )
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance entitlement outbox postflight failed: direct table or column ACL remains.';
  END IF;

  IF EXISTS (
    WITH expected(function_name, identity_arguments, grantee_name, privilege_type, is_grantable) AS (
      VALUES
        ('architecture_set_finance_access_desired_internal', 'uuid, uuid, bytea, text, text, text, bigint', 'service_role', 'EXECUTE', false),
        ('architecture_get_finance_access_status_internal', 'uuid, uuid', 'service_role', 'EXECUTE', false),
        ('architecture_claim_finance_access_outbox_internal', 'uuid, text, integer, uuid', 'service_role', 'EXECUTE', false),
        ('architecture_finish_finance_access_outbox_internal', 'uuid, uuid, text, text', 'service_role', 'EXECUTE', false)
    ),
    actual AS (
      SELECT
        procedure.proname AS function_name,
        pg_catalog.oidvectortypes(procedure.proargtypes) AS identity_arguments,
        CASE
          WHEN exploded.grantee = 0 THEN 'PUBLIC'
          ELSE pg_catalog.pg_get_userbyid(exploded.grantee)
        END AS grantee_name,
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
      privilege_type,
      is_grantable
    )
    WHERE expected.function_name IS NULL
       OR actual.function_name IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance entitlement outbox postflight failed: exact function ACL allow-list differs.';
  END IF;

  IF pg_catalog.has_function_privilege(
    'service_role',
    'public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Finance entitlement outbox postflight failed: service_role can bypass the outbox through legacy upsert.';
  END IF;
END;
$postflight$;

COMMIT;
