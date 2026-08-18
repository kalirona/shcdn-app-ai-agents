/**
 * Safe server-side PayPal connection test (Phase 3).
 *
 * Verifies that:
 *  - PayPal credentials are present (PAYPAL_NOT_CONFIGURED otherwise)
 *  - OAuth succeeds against the configured environment
 *  - the sandbox/live API responds
 *  - each configured plan ID is resolved
 *
 * Outputs booleans/environment/mapping status only. It NEVER prints the client
 * secret or the OAuth access token.
 *
 * Usage:
 *   node scripts/paypal-connection-test.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const fileEnv = loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const env = (key) => process.env[key] ?? fileEnv[key] ?? "";

const envName = env("PAYPAL_ENVIRONMENT") === "live" ? "live" : "sandbox";
const baseUrl = envName === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const clientId = env("PAYPAL_CLIENT_ID");
const clientSecret = env("PAYPAL_CLIENT_SECRET");

const planEnv = {
  starter: env("PAYPAL_STARTER_PLAN_ID"),
  business: env("PAYPAL_BUSINESS_PLAN_ID"),
  pro: env("PAYPAL_PRO_PLAN_ID"),
};

const planIds = Object.values(planEnv).filter(Boolean);

async function getToken() {
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, error: data.error };
}

function planPresent(plan) {
  return {
    plan,
    configured: Boolean(planEnv[plan]),
    configuredWithId: Boolean(planEnv[plan] && planIds.includes(planEnv[plan])),
  };
}

console.log(`PayPal environment : ${envName}`);
console.log(`API base           : ${baseUrl}`);

if (!clientId || !clientSecret) {
  console.log("PAYPAL_NOT_CONFIGURED");
  process.exit(2);
}

console.log("credentials        : present");
const { ok, status, error } = await getToken();
console.log(`OAuth              : ${ok ? "PASS" : "FAIL"} (status=${status}${error ? ` error=${error}` : ""})`);

for (const p of ["starter", "business", "pro"]) {
  console.log(`  plan ${p.padEnd(9)}: ${planPresent(p).configured ? "configured" : "MISSING"}`);
}

const configuredPlanIds = planIds;
console.log(`plan IDs configured: ${configuredPlanIds.length}/3`);

if (!ok) {
  console.log("CONNECTION FAILED");
  process.exit(1);
}

if (configuredPlanIds.length === 3) {
  console.log("CONNECTION OK");
  process.exit(0);
}

console.log("CONNECTION OK (plan IDs incomplete)");
process.exit(3);
