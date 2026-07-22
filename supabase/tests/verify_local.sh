#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if command -v node >/dev/null 2>&1; then
  node_bin="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  echo "Node.js 20 or newer is required." >&2
  exit 1
fi

./supabase/tests/validate_finance_integration_draft.sh
"$node_bin" --test supabase/tests/*.test.mjs

for node_source in \
  finance-pilot/architecture-finance.js \
  finance-pilot/pilot-shell.js \
  scripts/build-finance-pilot.mjs \
  scripts/configure-finance-pilot-bot.mjs \
  scripts/finance-pilot-safety.mjs \
  scripts/manage-finance-access.mjs \
  scripts/prepare-main-finance-staging.mjs \
  scripts/verify-finance-pilot-artifact.mjs \
  scripts/verify-finance-pilot-hosted.mjs
do
  "$node_bin" --check "$node_source"
done
printf '%s\n' "Finance pilot JavaScript syntax validation passed"

for edge_source in \
  supabase/functions/_shared/main-edge-runtime.ts \
  supabase/functions/finance-issue-code/index.ts \
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
