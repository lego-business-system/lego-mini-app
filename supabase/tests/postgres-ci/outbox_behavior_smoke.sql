\set ON_ERROR_STOP on

-- Exercise desired-state, ordered delivery, retries and dead-letter without
-- leaving persistent data in the disposable database.
BEGIN;

INSERT INTO public.users (id, telegram_id)
VALUES
  ('00000000-0000-4000-8000-000000000002'::uuid, 200000002),
  ('00000000-0000-4000-8000-000000000003'::uuid, 200000003);

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $outbox_behavior_smoke$
DECLARE
  v_primary_user uuid := '00000000-0000-4000-8000-000000000001';
  v_retry_user uuid := '00000000-0000-4000-8000-000000000002';
  v_current_grant_user uuid := '00000000-0000-4000-8000-000000000003';
  v_missing_user uuid := '00000000-0000-4000-8000-000000000099';
  v_primary_digest bytea := decode(repeat('11', 32), 'hex');
  v_retry_digest bytea := decode(repeat('22', 32), 'hex');
  v_current_grant_digest bytea := decode(repeat('33', 32), 'hex');
  v_missing_digest bytea := decode(repeat('99', 32), 'hex');
  v_grant_event uuid := '71111111-1111-4111-8111-111111111111';
  v_revoke_event uuid := '72222222-2222-4222-8222-222222222222';
  v_stale_event uuid := '72222222-2222-4222-8222-222222222223';
  v_retry_event uuid := '73333333-3333-4333-8333-333333333333';
  v_missing_event uuid := '74444444-4444-4444-8444-444444444444';
  v_current_grant_event uuid := '74444444-4444-4444-8444-444444444445';
  v_blocked_claim uuid := '75555555-5555-4555-8555-555555555554';
  v_claim_one uuid := '75555555-5555-4555-8555-555555555555';
  v_claim_two uuid := '76666666-6666-4666-8666-666666666666';
  v_claim_three uuid := '77777777-7777-4777-8777-777777777777';
  v_claim_four uuid := '77777777-7777-4777-8777-777777777778';
  v_event_occurred_at text;
  v_result jsonb;
BEGIN
  SELECT public.architecture_set_finance_access_desired_internal(
    v_missing_event,
    v_missing_user,
    v_missing_digest,
    'granted',
    'system:pilot_admin',
    'Pilot access approved',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'main_user_not_found'
  THEN
    RAISE EXCEPTION 'unknown Main user was accepted: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_grant_event,
    v_primary_user,
    v_primary_digest,
    'granted',
    'system:pilot_admin',
    'Pilot access approved',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'version' IS DISTINCT FROM '1'
     OR v_result ->> 'state' IS DISTINCT FROM 'pending'
  THEN
    RAISE EXCEPTION 'first desired grant was not enqueued: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_grant_event,
    v_primary_user,
    v_primary_digest,
    'granted',
    'system:pilot_admin',
    'Pilot access approved',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
     OR v_result ->> 'version' IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION 'exact desired-state retry was not idempotent: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_grant_event,
    v_primary_user,
    v_primary_digest,
    'revoked',
    'system:pilot_admin',
    'Pilot access approved',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'idempotency_conflict'
  THEN
    RAISE EXCEPTION 'changed payload reused an existing event id: %', v_result;
  END IF;

  SELECT public.architecture_get_finance_access_status_internal(
    v_primary_user,
    v_grant_event
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'current_version' IS DISTINCT FROM '1'
     OR v_result ->> 'desired_state' IS DISTINCT FROM 'granted'
     OR v_result #>> '{event,event_id}' IS DISTINCT FROM v_grant_event::text
     OR v_result #>> '{event,version}' IS DISTINCT FROM '1'
     OR v_result #>> '{event,state}' IS DISTINCT FROM 'pending'
     OR v_result ? 'subject_digest'
     OR v_result ? 'change_reason'
  THEN
    RAISE EXCEPTION 'read-only desired-state status was not exact: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_stale_event,
    v_primary_user,
    v_primary_digest,
    'revoked',
    'system:pilot_admin',
    'Stale precondition must fail',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'false'
     OR v_result ->> 'error' IS DISTINCT FROM 'version_conflict'
  THEN
    RAISE EXCEPTION 'stale expected version changed desired state: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_revoke_event,
    v_primary_user,
    v_primary_digest,
    'revoked',
    'owner:00000000-0000-4000-8000-000000000001',
    'Pilot access revoked by owner',
    1
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'version' IS DISTINCT FROM '2'
  THEN
    RAISE EXCEPTION 'second desired version was not enqueued: %', v_result;
  END IF;

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_blocked_claim,
    'worker:staging_one',
    60,
    v_revoke_event
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result -> 'event' IS DISTINCT FROM 'null'::jsonb
  THEN
    RAISE EXCEPTION 'targeted claim bypassed an earlier user version: %', v_result;
  END IF;

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_one,
    'worker:staging_one',
    60,
    v_grant_event
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result #>> '{event,event_id}' IS DISTINCT FROM v_grant_event::text
     OR v_result #>> '{event,main_user_id}' IS DISTINCT FROM v_primary_user::text
     OR v_result #>> '{event,subject_digest}' IS DISTINCT FROM encode(v_primary_digest, 'hex')
     OR v_result #>> '{event,desired_state}' IS DISTINCT FROM 'granted'
     OR v_result #>> '{event,event_version}' IS DISTINCT FROM '1'
     OR coalesce(v_result #>> '{event,event_occurred_at}', '') !~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
     OR v_result #>> '{event,attempt_count}' IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION 'oldest user event was not claimed first: %', v_result;
  END IF;

  v_event_occurred_at := v_result #>> '{event,event_occurred_at}';

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_one,
    'worker:staging_one',
    60,
    v_grant_event
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
     OR v_result #>> '{event,event_id}' IS DISTINCT FROM v_grant_event::text
     OR v_result #>> '{event,event_occurred_at}' IS DISTINCT FROM v_event_occurred_at
  THEN
    RAISE EXCEPTION 'exact claim retry was not idempotent: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_grant_event,
    v_claim_one,
    'applied',
    NULL
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'applied'
  THEN
    RAISE EXCEPTION 'grant event was not applied: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_grant_event,
    v_claim_one,
    'applied',
    NULL
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'exact applied finish retry was not idempotent: %', v_result;
  END IF;

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_two,
    'worker:staging_one',
    60,
    v_revoke_event
  ) INTO v_result;

  IF v_result #>> '{event,event_id}' IS DISTINCT FROM v_revoke_event::text
     OR v_result #>> '{event,desired_state}' IS DISTINCT FROM 'revoked'
     OR v_result #>> '{event,event_version}' IS DISTINCT FROM '2'
  THEN
    RAISE EXCEPTION 'next user version was not released after v1 applied: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_revoke_event,
    v_claim_two,
    'applied',
    NULL
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'state' IS DISTINCT FROM 'applied'
     OR v_result ->> 'version' IS DISTINCT FROM '2'
  THEN
    RAISE EXCEPTION 'revoke event was not applied: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_retry_event,
    v_retry_user,
    v_retry_digest,
    'granted',
    'system:pilot_admin',
    'Retry path verification',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'retry-path event was not created: %', v_result;
  END IF;

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_three,
    'worker:staging_two',
    60,
    v_retry_event
  ) INTO v_result;

  IF v_result #>> '{event,event_id}' IS DISTINCT FROM v_retry_event::text THEN
    RAISE EXCEPTION 'retry-path event was not claimed: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_retry_event,
    v_claim_three,
    'retry',
    'dependency_unavailable'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'retry_wait'
     OR (v_result ->> 'next_attempt_at')::timestamp with time zone
          <= clock_timestamp() + interval '10 seconds'
  THEN
    RAISE EXCEPTION 'retry did not enter deterministic backoff: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_retry_event,
    v_claim_three,
    'retry',
    'dependency_unavailable'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
     OR v_result ->> 'state' IS DISTINCT FROM 'retry_wait'
  THEN
    RAISE EXCEPTION 'exact retry finish was not idempotent: %', v_result;
  END IF;

  SELECT public.architecture_set_finance_access_desired_internal(
    v_current_grant_event,
    v_current_grant_user,
    v_current_grant_digest,
    'granted',
    'system:pilot_admin',
    'Current grant gate verification',
    0
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'version' IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION 'current grant event was not created: %', v_result;
  END IF;

  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_four,
    'worker:staging_three',
    60,
    v_current_grant_event
  ) INTO v_result;

  IF v_result #>> '{event,event_id}' IS DISTINCT FROM v_current_grant_event::text
     OR v_result #>> '{event,event_version}' IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION 'current grant event was not claimed: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_current_grant_event,
    v_claim_four,
    'applied',
    NULL
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'state' IS DISTINCT FROM 'applied'
  THEN
    RAISE EXCEPTION 'current grant event was not applied: %', v_result;
  END IF;
END;
$outbox_behavior_smoke$;

RESET ROLE;

UPDATE public.architecture_finance_access_outbox
SET next_attempt_at = clock_timestamp()
WHERE event_id = '73333333-3333-4333-8333-333333333333'::uuid;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $outbox_dead_letter_smoke$
DECLARE
  v_event_id uuid := '73333333-3333-4333-8333-333333333333';
  v_claim_token uuid := '78888888-8888-4888-8888-888888888888';
  v_result jsonb;
BEGIN
  SELECT public.architecture_claim_finance_access_outbox_internal(
    v_claim_token,
    'worker:staging_two',
    60,
    v_event_id
  ) INTO v_result;

  IF v_result #>> '{event,event_id}' IS DISTINCT FROM v_event_id::text
     OR v_result #>> '{event,attempt_count}' IS DISTINCT FROM '2'
  THEN
    RAISE EXCEPTION 'due retry was not claimed with a new attempt: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_event_id,
    v_claim_token,
    'dead_letter',
    'contract_rejected'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'false'
     OR v_result ->> 'state' IS DISTINCT FROM 'dead_letter'
  THEN
    RAISE EXCEPTION 'permanent failure did not enter dead-letter: %', v_result;
  END IF;

  SELECT public.architecture_finish_finance_access_outbox_internal(
    v_event_id,
    v_claim_token,
    'dead_letter',
    'contract_rejected'
  ) INTO v_result;

  IF v_result ->> 'ok' IS DISTINCT FROM 'true'
     OR v_result ->> 'replayed' IS DISTINCT FROM 'true'
     OR v_result ->> 'state' IS DISTINCT FROM 'dead_letter'
  THEN
    RAISE EXCEPTION 'exact dead-letter finish was not idempotent: %', v_result;
  END IF;
END;
$outbox_dead_letter_smoke$;

RESET ROLE;

DO $outbox_persistent_assertions$
BEGIN
  IF (SELECT count(*) FROM public.architecture_finance_access_desired) <> 3
     OR (SELECT count(*) FROM public.architecture_finance_access_outbox) <> 4
     OR NOT EXISTS (
       SELECT 1
       FROM public.architecture_finance_access_desired
       WHERE main_user_id = '00000000-0000-4000-8000-000000000001'::uuid
         AND desired_state = 'revoked'
         AND version = 2
         AND applied_version = 2
         AND applied_state = 'revoked'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.architecture_product_entitlements
       WHERE subject_digest = decode(repeat('11', 32), 'hex')
         AND product_code = 'architecture_finance'
         AND status = 'blocked'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.architecture_product_entitlements
       WHERE subject_digest = decode(repeat('22', 32), 'hex')
         AND product_code = 'architecture_finance'
         AND status = 'blocked'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.architecture_product_entitlements
       WHERE subject_digest = decode(repeat('33', 32), 'hex')
         AND product_code = 'architecture_finance'
         AND status = 'manual'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.architecture_finance_access_outbox
       WHERE event_id = '73333333-3333-4333-8333-333333333333'::uuid
         AND state = 'dead_letter'
         AND attempt_count = 2
         AND cardinality(claim_tokens) = 2
         AND last_error_code = 'contract_rejected'
     )
  THEN
    RAISE EXCEPTION 'outbox persistent state does not match the reviewed behavior';
  END IF;
END;
$outbox_persistent_assertions$;

ROLLBACK;
