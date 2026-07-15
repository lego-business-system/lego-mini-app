\set ON_ERROR_STOP on

BEGIN;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $resolver_behavior_smoke$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.architecture_resolve_finance_subject_internal(
    '00000000-0000-4000-8000-000000000001'::uuid
  ) INTO v_result;

  IF v_result IS DISTINCT FROM jsonb_build_object(
    'ok', true,
    'main_user_id', '00000000-0000-4000-8000-000000000001'::uuid,
    'telegram_id', '9000000000000000001'
  ) THEN
    RAISE EXCEPTION 'resolver did not preserve exact bigint text: %', v_result;
  END IF;

  SELECT public.architecture_resolve_finance_subject_internal(
    '00000000-0000-4000-8000-000000000099'::uuid
  ) INTO v_result;

  IF v_result IS DISTINCT FROM jsonb_build_object(
    'ok', false,
    'error', 'main_user_not_found'
  ) THEN
    RAISE EXCEPTION 'resolver did not reject a missing Main user: %', v_result;
  END IF;

  SELECT public.architecture_resolve_finance_subject_internal(NULL)
  INTO v_result;

  IF v_result IS DISTINCT FROM jsonb_build_object(
    'ok', false,
    'error', 'invalid_request'
  ) THEN
    RAISE EXCEPTION 'resolver did not reject a null Main user: %', v_result;
  END IF;
END;
$resolver_behavior_smoke$;

ROLLBACK;
