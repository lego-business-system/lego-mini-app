(function installArchitectureFinanceConfig(root) {
  "use strict";

  if (!root || root.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG) return;

  Object.defineProperty(root, "ARCHITECTURE_FINANCE_INTEGRATION_CONFIG", {
    value: Object.freeze({
      // Fail closed until both staging projects, exact origins and the Finance
      // website URL have passed the integration runbook.
      enabled: false,
      issueEndpoint: "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/finance-issue-code",
      financeWebUrl: ""
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})(typeof window === "object" ? window : globalThis);
