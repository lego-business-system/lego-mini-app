\set ON_ERROR_STOP on

-- Minimal disposable compatibility surface for the reviewed main migration.
-- It is intentionally not a substitute for a real Supabase staging project.
BEGIN;

SET LOCAL client_min_messages = warning;

CREATE ROLE anon
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE service_role
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
CREATE ROLE main_finance_ci_unknown
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- Deliberately inject project-specific defaults. The migration must discover
-- and revoke this unknown grantee instead of relying on a fixed role list.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO main_finance_ci_unknown;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO main_finance_ci_unknown;

CREATE SCHEMA auth AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )::text
$function$;

ALTER FUNCTION auth.role() OWNER TO postgres;
REVOKE ALL ON FUNCTION auth.role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

-- The migration only checks that the current main user table exists and never
-- reads or alters it. No unconfirmed production columns are invented here.
CREATE TABLE public.users (
  id uuid PRIMARY KEY
);
ALTER TABLE public.users OWNER TO postgres;
REVOKE ALL ON TABLE public.users
FROM PUBLIC, anon, authenticated, service_role, main_finance_ci_unknown;
INSERT INTO public.users (id)
VALUES ('00000000-0000-4000-8000-000000000001');

DO $bootstrap_postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role_row
    WHERE role_row.rolname IN ('anon', 'authenticated', 'main_finance_ci_unknown')
      AND (
        role_row.rolcanlogin
        OR role_row.rolinherit
        OR role_row.rolsuper
        OR role_row.rolcreatedb
        OR role_row.rolcreaterole
        OR role_row.rolreplication
        OR role_row.rolbypassrls
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role_row
    WHERE role_row.rolname = 'service_role'
      AND (
        role_row.rolcanlogin
        OR role_row.rolinherit
        OR role_row.rolsuper
        OR role_row.rolcreatedb
        OR role_row.rolcreaterole
        OR role_row.rolreplication
        OR NOT role_row.rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Disposable bootstrap role attributes are unsafe or incompatible.';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Disposable main compatibility surface is incomplete.';
  END IF;
END;
$bootstrap_postflight$;

COMMIT;
