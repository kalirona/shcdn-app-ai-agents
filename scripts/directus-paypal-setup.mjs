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
const BASE = (process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!BASE || !TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

async function api(method, pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return (await res.json()).data;
}

async function exists(name) {
  try {
    await api("GET", `/collections/${name}`);
    return true;
  } catch {
    return false;
  }
}

async function fieldExists(collection, name) {
  try {
    await api("GET", `/fields/${collection}/${name}`);
    return true;
  } catch {
    return false;
  }
}

async function col(name, icon, note) {
  if (await exists(name)) {
    console.log(`= collection "${name}" exists, skip`);
    return;
  }
  await api("POST", "/collections", {
    collection: name,
    meta: { icon, note, accountability: "all" },
    schema: { name },
  });
  console.log(`+ collection "${name}"`);
}

async function field(collection, f) {
  if (await fieldExists(collection, f.field)) {
    console.log(`  = ${collection}.${f.field} exists, skip`);
    return;
  }
  await api("POST", `/fields/${collection}`, f);
  console.log(`  + ${collection}.${f.field} (${f.type})`);
}

async function timestamps(collection) {
  await field(collection, {
    field: "date_created",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: { interface: "datetime", special: ["date-created"], readonly: true },
  });
  await field(collection, {
    field: "date_updated",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: { interface: "datetime", special: ["date-updated"], readonly: true },
  });
}

console.log("Starting PayPal webhook-events setup...\n");

// Inbound provider-webhook idempotency ledger used by /api/webhooks/paypal so
// a duplicate PayPal transmission is never applied twice.
await col("webhook_events", "sync", "Inbound provider webhook events (idempotency ledger)");
await field("webhook_events", {
  field: "event_id",
  type: "string",
  schema: { is_nullable: false, max_length: 256, is_unique: true },
  meta: { interface: "input", required: true, note: "Provider event ID" },
});
await field("webhook_events", {
  field: "provider",
  type: "string",
  schema: { is_nullable: false, default_value: "paypal", max_length: 32 },
  meta: { interface: "input", required: true },
});
await field("webhook_events", {
  field: "event_type",
  type: "string",
  schema: { is_nullable: false, max_length: 128 },
  meta: { interface: "input", required: true },
});
await field("webhook_events", {
  field: "subscription_id",
  type: "string",
  schema: { is_nullable: true, max_length: 256 },
  meta: { interface: "input" },
});
await field("webhook_events", {
  field: "workspace",
  type: "integer",
  schema: { is_nullable: true, data_type: "integer" },
  meta: { interface: "many-to-one", special: ["m2o"], required: false },
});
await field("webhook_events", {
  field: "status",
  type: "string",
  schema: { is_nullable: false, default_value: "processed" },
  meta: {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Processed", value: "processed" },
        { text: "Failed", value: "failed" },
      ],
    },
  },
});
await timestamps("webhook_events");

console.log("\nDone!");
