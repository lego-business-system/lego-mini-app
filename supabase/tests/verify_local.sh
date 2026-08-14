#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

bundled_node="/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"
if [[ -x "$bundled_node" ]]; then
  node_bin="$bundled_node"
elif command -v node >/dev/null 2>&1; then
  node_bin="$(command -v node)"
else
  echo "Node.js 24.14.0 is required." >&2
  exit 1
fi

if [[ "$("$node_bin" --version)" != "v24.14.0" ]]; then
  echo "Node.js must be exactly v24.14.0." >&2
  exit 1
fi

./supabase/tests/validate_finance_integration_draft.sh

release_test="supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs"
if ! release_tap="$("$node_bin" --test --test-reporter=tap "$release_test" 2>&1)"; then
  printf '%s\n' "$release_tap"
  exit 1
fi
printf '%s\n' "$release_tap"
portable_lifecycle_tests=(
  "raw reducer measurement authority accepts canonical evidence and rejects operation or chain drift"
  "raw reducer plan through verify matrix binds exact receipts commands and fresh evidence"
  "raw reducer plan determinism and latest-intent command gate"
  "raw reducer operation binding and function inventory schema matrix"
  "raw reducer expiry approval forged intent and terminal receipt rejection matrix"
  "raw reducer applied reconciliation narrows secret scope and requires function evidence time"
  "raw reducer not-applied secret and deploy reconciliation requires fresh scoped plans"
  "raw reducer mutation-input digest drift blocks secret and deploy command authority"
  "raw reducer inventory rewrite and postflight sandwich drift reject completion and verify"
)
for lifecycle_name in "${portable_lifecycle_tests[@]}"; do
  if [[ "$(grep -Fxc -- "# Subtest: $lifecycle_name" <<<"$release_tap")" != "1" ]]; then
    echo "Portable runtime recovery raw authority registration differs: $lifecycle_name" >&2
    exit 1
  fi
done
if [[ "$(grep -Fxc -- "# skipped 0" <<<"$release_tap")" != "1" ]]; then
  echo "Runtime recovery release test must report exactly zero skips." >&2
  exit 1
fi
if [[ "$(grep -Fxc -- "# fail 0" <<<"$release_tap")" != "1" ]]; then
  echo "Runtime recovery release test must report exactly zero failures." >&2
  exit 1
fi

"$node_bin" --test supabase/tests/*.test.mjs

for node_source in \
  finance-pilot/architecture-finance.js \
  finance-pilot/pilot-shell.js \
  scripts/build-finance-pilot.mjs \
  scripts/bootstrap-main-finance-staging-access.mjs \
  scripts/configure-finance-pilot-bot.mjs \
  scripts/finance-pilot-safety.mjs \
  scripts/main-finance-runtime-recovery-v2-snapshot.mjs \
  scripts/manage-finance-access.mjs \
  scripts/manage-finance-access-v2.mjs \
  scripts/prepare-main-finance-staging.mjs \
  scripts/prepare-main-finance-runtime-recovery-v2.mjs \
  scripts/seed-finance-pilot-user.mjs \
  scripts/staging-gates.mjs \
  scripts/staging-revoke-live-proof.mjs \
  scripts/verify-disabled-staging-edge.mjs \
  scripts/verify-finance-pilot-artifact.mjs \
  scripts/verify-finance-pilot-hosted.mjs
do
  "$node_bin" --check "$node_source"
done
printf '%s\n' "Finance pilot JavaScript syntax validation passed"

for edge_source in \
  supabase/functions/_shared/main-edge-runtime.ts \
  supabase/functions/finance-issue-code/index.ts \
  supabase/functions/finance-manage-access-v2/index.ts \
  supabase/functions/finance-sync-entitlements/index.ts
do
  "$node_bin" --experimental-strip-types --check "$edge_source"
done
printf '%s\n' "Edge TypeScript syntax validation passed"

"$node_bin" - <<'JS'
const fs = require("node:fs");
const path = require("node:path");

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if ([".git", "node_modules"].includes(entry.name)) return [];
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(item);
    return entry.isFile() && entry.name.endsWith(".md") ? [item] : [];
  });
}

const failures = [];
for (const file of markdownFiles(".")) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "").split(/\s+['\"]/)[0];
    if (!target || target.startsWith("#") || /^(?:https?:|mailto:|tel:)/i.test(target)) continue;
    target = target.split("#", 1)[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      failures.push(`${file}: malformed link ${match[1]}`);
      continue;
    }
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
      failures.push(`${file}: missing ${match[1]}`);
    }
  }
}
if (failures.length) throw new Error(`Broken Markdown links:\n${failures.join("\n")}`);
console.log("Markdown link validation passed");
JS

git diff --check
echo "local finance integration verification passed"
