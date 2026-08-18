/**
 * Directus ai_defaults platform prompt fields setup.
 *
 * Adds the Super Admin controlled fields to the ai_defaults singleton:
 *   - default_system_prompt     (fallback agent instructions)
 *   - platform_system_prompt    (Super Admin global system prompt)
 *   - platform_safety_rules     (Super Admin safety/security rules)
 *
 * Idempotent: safe to re-run. Only creates missing fields.
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
    let v = t.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const fileEnv = loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

async function directusRequest(endpoint, options = {}) {
  const res = await fetch(`${DIRECTUS_URL.replace(/\/$/, "")}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      ...options.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Directus ${options.method ?? "GET"} ${endpoint} failed: ${res.status} ${text}`);
  }
  return data;
}

const FIELDS = [
  {
    field: "default_system_prompt",
    type: "text",
    meta: {
      collection: "ai_defaults",
      field: "default_system_prompt",
      interface: "input-multiline",
      note: "Fallback agent instructions used when an agent has no custom system prompt",
    },
    schema: {
      table: "ai_defaults",
      column: "default_system_prompt",
      data_type: "text",
      is_nullable: true,
    },
  },
  {
    field: "platform_system_prompt",
    type: "text",
    meta: {
      collection: "ai_defaults",
      field: "platform_system_prompt",
      interface: "input-multiline",
      note: "Super Admin global system prompt (highest priority, agents cannot override)",
    },
    schema: {
      table: "ai_defaults",
      column: "platform_system_prompt",
      data_type: "text",
      is_nullable: true,
    },
  },
  {
    field: "platform_safety_rules",
    type: "text",
    meta: {
      collection: "ai_defaults",
      field: "platform_safety_rules",
      interface: "input-multiline",
      note: "Super Admin safety and security rules (immutable, above agent prompts)",
    },
    schema: {
      table: "ai_defaults",
      column: "platform_safety_rules",
      data_type: "text",
      is_nullable: true,
    },
  },
];

async function main() {
  console.log("Starting ai_defaults prompt fields setup...\n");

  for (const field of FIELDS) {
    try {
      await directusRequest(`/fields/ai_defaults/${field.field}`);
      console.log(`  - field "ai_defaults.${field.field}" already exists`);
    } catch (e) {
      if (String(e).includes("404") || String(e).includes("403")) {
        await directusRequest(`/fields/ai_defaults`, { method: "POST", body: JSON.stringify(field) });
        console.log(`  + field "ai_defaults.${field.field}" created`);
      } else {
        throw e;
      }
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});