import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260714235900_finance_integration_foundation.sql",
  "utf8",
);

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function catalogContractViolations(source) {
  const failures = [];
  const requireCount = (pattern, expected, label) => {
    const actual = count(source, pattern);
    if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
  };
  const requireText = (pattern, label) => {
    if (!pattern.test(source)) failures.push(`${label}: missing`);
  };

  requireCount(/^CREATE TABLE public\.architecture_/gm, 3, "tables");
  requireCount(/^ALTER TABLE public\.architecture_.* OWNER TO postgres;$/gm, 3, "table owners");
  requireCount(/^  CONSTRAINT architecture_/gm, 19, "constraints");
  requireCount(/^CREATE INDEX idx_architecture_/gm, 4, "explicit indexes");
  requireCount(/^CREATE OR REPLACE FUNCTION public\.architecture_/gm, 4, "function overloads");
  requireCount(/^VOLATILE$/gm, 4, "function volatility");
  requireCount(/^CALLED ON NULL INPUT$/gm, 4, "function strictness");
  requireCount(/^PARALLEL UNSAFE$/gm, 4, "function parallel mode");
  requireCount(/^NOT LEAKPROOF$/gm, 4, "function leakproof mode");
  requireCount(/^CREATE TRIGGER trg_architecture_/gm, 2, "user triggers");
  requireCount(/^ALTER TABLE public\.architecture_.* ENABLE ROW LEVEL SECURITY;$/gm, 3, "RLS tables");

  requireText(/current_user IS DISTINCT FROM 'postgres'/, "postgres first-run context");
  requireText(/v_table_count <> 0/, "one-shot table preflight");
  requireText(/v_function_count <> 0/, "one-shot overload preflight");
  requireText(/DO \$acl_hardening\$[\s\S]*?REVOKE ALL PRIVILEGES ON TABLE/, "actual-grantee table ACL cleanup");
  requireText(/REVOKE ALL PRIVILEGES \(%I\) ON TABLE/, "actual-grantee column ACL cleanup");
  requireText(/REVOKE ALL PRIVILEGES ON FUNCTION %s/, "actual-grantee function ACL cleanup");
  requireText(/DO \$acl_hardening\$(?:(?!\$acl_hardening\$;)[\s\S])*?pg_catalog\.aclexplode\(relation\.relacl\)/, "relacl catalog inspection");
  requireText(/DO \$acl_hardening\$(?:(?!\$acl_hardening\$;)[\s\S])*?pg_catalog\.aclexplode\(attribute\.attacl\)/, "attacl catalog inspection");
  requireText(/DO \$acl_hardening\$(?:(?!\$acl_hardening\$;)[\s\S])*?pg_catalog\.aclexplode\(procedure\.proacl\)/, "proacl catalog inspection");
  requireText(/Exact ordered column catalog[\s\S]*?FULL JOIN actual USING \(table_name, column_number\)/, "exact column postflight");
  requireText(/Exact nineteen constraints[\s\S]*?the exact nineteen-constraint contract differs/, "exact constraint postflight");
  requireText(/Four explicit indexes[\s\S]*?the exact four-index contract differs/, "exact index postflight");
  requireText(/Exact function overloads[\s\S]*?overloads or exact function metadata differ/, "exact function postflight");
  requireText(/Exactly two user triggers[\s\S]*?the exact two-trigger contract differs/, "exact trigger postflight");
  requireText(/integration tables must have zero RLS policies/, "zero-policy postflight");
  requireText(/table or column ACL allow-list is not empty/, "empty table ACL allow-list");
  requireText(/exact function ACL allow-list differs/, "exact function ACL allow-list");

  if (/^CREATE POLICY /m.test(source)) failures.push("unexpected policy");
  if (/WITH GRANT OPTION/.test(source)) failures.push("grant option introduced");
  return failures;
}

test("first-run and postflight exact-catalog contract is structurally complete", () => {
  assert.deepEqual(catalogContractViolations(migration), []);
});

test("adversarial catalog, ACL and overload mutations are rejected statically", () => {
  const mutations = new Map([
    ["table owner", migration.replace(
      "ALTER TABLE public.architecture_product_entitlements OWNER TO postgres;",
      "ALTER TABLE public.architecture_product_entitlements OWNER TO service_role;",
    )],
    ["constraint removal", migration.replace(
      "  CONSTRAINT architecture_finance_issue_replay_guard_expiry_check\n    CHECK (expires_at > created_at),\n",
      "",
    )],
    ["index addition", `${migration}\nCREATE INDEX idx_architecture_unreviewed ON public.architecture_finance_issue_requests (state);\n`],
    ["overload addition", `${migration}\nCREATE OR REPLACE FUNCTION public.architecture_finish_finance_issue_internal(text) RETURNS jsonb LANGUAGE sql AS 'SELECT '{}'::jsonb';\n`],
    ["function metadata", migration.replace("NOT LEAKPROOF", "LEAKPROOF")],
    ["policy addition", `${migration}\nCREATE POLICY architecture_unreviewed ON public.architecture_product_entitlements USING (true);\n`],
    ["grant option", migration.replace(
      "TO service_role;",
      "TO service_role WITH GRANT OPTION;",
    )],
    ["ACL cleanup removal", migration.replace(
      "CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS exploded",
      "CROSS JOIN LATERAL pg_catalog.aclexplode(NULL::aclitem[]) AS exploded",
    )],
  ]);

  for (const [label, mutated] of mutations) {
    assert.notDeepEqual(
      catalogContractViolations(mutated),
      [],
      `adversarial mutation was not detected: ${label}`,
    );
  }
});
