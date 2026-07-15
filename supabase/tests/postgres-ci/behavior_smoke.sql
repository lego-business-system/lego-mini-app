\set ON_ERROR_STOP on

-- Exercise the service-only RPC contract without leaving persistent rows.
BEGIN;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $behavior_smoke$
DECLARE
  v_subject_digest bytea := decode(repeat('11', 32), 'hex');
  v_init_data_digest bytea := decode(repeat('22', 32), 'hex');
  v_network_nonce_digest bytea := decode(repeat('33', 32), 'hex');
  v_request_fingerprint bytea := decode(repeat('44', 32), 'hex');
  v_request_id uuid := '11111111-1111-4111-8111-111111111111';
  v_replay_conflict_request_id uuid := '22222222-2222-4222-8222-222222222222';
  v_revocation_request_id uuid := '33333333-3333-4333-8333-333333333333';
  v_third_request_id uuid := '44444444-4444-4444-8444-444444444444';
  v_rate_limited_request_id uuid := '55555555-5555-4555-8555-555555555555';
  v_blocked_request_id uuid := '66666666-6666-4666-8666-666666666666';
  v_finance_timestamp bigint := floor(extract(epoch FROM clock_timestamp()))::bigint;
  v_replay_expires_at timestamp with time zone := clock_timestamp() + interval '10 minutes';
  v_response_expires_at timestamp with time zone := clock_timestamp() + interval '10 minutes';
  v_result jsonb;
BEGIN
  SELECT public.architecture_begin_finance_issue_internal(
    v_request_id,
    v_subject_digest,
    v_init_data_digest,
    'architecture_finance',
    v_network_nonce_digest,
    v_request_fingerprint,
    v_finance_timestamp,
    v_replay_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'access_denied'
  THEN
    RAISE EXCEPTION 'missing entitlement must fail closed: %', v_result;
  END IF;

  SELECT public.architecture_upsert_product_entitlement_internal(
    v_subject_digest,
    'architecture_finance',
    'active',
    clock_timestamp() - interval '1 minute',
    clock_timestamp() + interval '1 hour'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'active entitlement provisioning failed: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_request_id,
    v_subject_digest,
    v_init_data_digest,
    'architecture_finance',
    v_network_nonce_digest,
    v_request_fingerprint,
    v_finance_timestamp,
    v_replay_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'pending'
     OR v_result ->> 'finance_timestamp' IS DISTINCT FROM v_finance_timestamp::text
  THEN
    RAISE EXCEPTION 'fresh entitled request was not accepted: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_issue_internal(
    v_request_id,
    v_request_fingerprint,
    'succeeded',
    v_response_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
  THEN
    RAISE EXCEPTION 'successful Finance response was not committed: %', v_result;
  END IF;

  -- The production contract deliberately rejects sub-second retries.
  PERFORM pg_catalog.pg_sleep(1.05);

  SELECT public.architecture_begin_finance_issue_internal(
    v_request_id,
    v_subject_digest,
    v_init_data_digest,
    'architecture_finance',
    v_network_nonce_digest,
    v_request_fingerprint,
    v_finance_timestamp,
    v_replay_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
     OR v_result ->> 'state' IS DISTINCT FROM 'succeeded'
     OR v_result ->> 'finance_timestamp' IS DISTINCT FROM v_finance_timestamp::text
  THEN
    RAISE EXCEPTION 'exact retry did not recover the accepted request: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_issue_internal(
    v_request_id,
    v_request_fingerprint,
    'succeeded',
    v_response_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'exact finish retry was not idempotent: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_request_id,
    v_subject_digest,
    v_init_data_digest,
    'architecture_finance',
    v_network_nonce_digest,
    v_request_fingerprint,
    v_finance_timestamp,
    v_replay_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'rate_limited'
  THEN
    RAISE EXCEPTION 'sub-second exact retry was not rate-limited: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_request_id,
    v_subject_digest,
    decode(repeat('55', 32), 'hex'),
    'architecture_finance',
    v_network_nonce_digest,
    v_request_fingerprint,
    v_finance_timestamp,
    v_replay_expires_at
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'idempotency_conflict'
  THEN
    RAISE EXCEPTION 'changed payload reused the request id: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_replay_conflict_request_id,
    v_subject_digest,
    v_init_data_digest,
    'architecture_finance',
    decode(repeat('55', 32), 'hex'),
    decode(repeat('56', 32), 'hex'),
    floor(extract(epoch FROM clock_timestamp()))::bigint,
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'replay_conflict'
  THEN
    RAISE EXCEPTION 'verified launch replay was not rejected across request ids: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_revocation_request_id,
    v_subject_digest,
    decode(repeat('66', 32), 'hex'),
    'architecture_finance',
    decode(repeat('77', 32), 'hex'),
    decode(repeat('88', 32), 'hex'),
    floor(extract(epoch FROM clock_timestamp()))::bigint,
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'pending'
  THEN
    RAISE EXCEPTION 'second fresh request was not accepted before revoke: %', v_result;
  END IF;

  SELECT public.architecture_upsert_product_entitlement_internal(
    v_subject_digest,
    'architecture_finance',
    'blocked'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'entitlement revocation failed: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_issue_internal(
    v_revocation_request_id,
    decode(repeat('88', 32), 'hex'),
    'succeeded',
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'access_denied'
  THEN
    RAISE EXCEPTION 'revocation between begin and finish did not reject success: %', v_result;
  END IF;

  SELECT public.architecture_upsert_product_entitlement_internal(
    v_subject_digest,
    'architecture_finance',
    'active',
    clock_timestamp() - interval '1 minute',
    clock_timestamp() + interval '1 hour'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'entitlement reactivation failed: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_third_request_id,
    v_subject_digest,
    decode(repeat('99', 32), 'hex'),
    'architecture_finance',
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('bb', 32), 'hex'),
    floor(extract(epoch FROM clock_timestamp()))::bigint,
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'pending'
  THEN
    RAISE EXCEPTION 'third rolling-window request was not accepted: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_rate_limited_request_id,
    v_subject_digest,
    decode(repeat('cc', 32), 'hex'),
    'architecture_finance',
    decode(repeat('dd', 32), 'hex'),
    decode(repeat('ee', 32), 'hex'),
    floor(extract(epoch FROM clock_timestamp()))::bigint,
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'rate_limited'
  THEN
    RAISE EXCEPTION 'fourth rolling-window request was not rate-limited: %', v_result;
  END IF;

  SELECT public.architecture_upsert_product_entitlement_internal(
    v_subject_digest,
    'architecture_finance',
    'blocked'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'final entitlement revocation failed: %', v_result;
  END IF;

  SELECT public.architecture_begin_finance_issue_internal(
    v_blocked_request_id,
    v_subject_digest,
    decode(repeat('f1', 32), 'hex'),
    'architecture_finance',
    decode(repeat('f2', 32), 'hex'),
    decode(repeat('f3', 32), 'hex'),
    floor(extract(epoch FROM clock_timestamp()))::bigint,
    clock_timestamp() + interval '10 minutes'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'access_denied'
  THEN
    RAISE EXCEPTION 'blocked entitlement did not stop a new request: %', v_result;
  END IF;
END;
$behavior_smoke$;

ROLLBACK;
