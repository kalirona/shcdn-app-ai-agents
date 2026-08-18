/**
 * Directus directus_users custom fields setup (Phase 5.3).
 *
 * Adds fields to the built-in directus_users collection for platform user management:
 * - platform_banned (boolean) + ban_reason + banned_at
 * - force_password_reset (boolean)
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

async function main() {
  console.log("Starting directus_users custom fields setup...\n");

  const collection = "directus_users";

  // Check collection exists (it's a system collection)
  try {
    await directusRequest(`/collections/${collection}`);
    console.log(`Collection '${collection}' exists (system).`);
  } catch (e) {
    throw new Error(`System collection 'directus_users' not found: ${e}`);
  }

  const fields = [
    {
      field: "platform_banned",
      type: "boolean",
      meta: {
        collection,
        field: "platform_banned",
        interface: "boolean",
        note: "True when user is banned by platform admin (stronger than suspended)",
        required: false,
      },
      schema: {
        table: collection,
        column: "platform_banned",
        data_type: "boolean",
        is_nullable: true,
        default_value: false,
      },
    },
    {
      field: "ban_reason",
      type: "string",
      meta: {
        collection,
        field: "ban_reason",
        interface: "input-multiline",
        note: "Reason for platform ban",
      },
      schema: {
        table: collection,
        column: "ban_reason",
        data_type: "text",
        is_nullable: true,
      },
    },
    {
      field: "banned_at",
      type: "timestamp",
      meta: {
        collection,
        field: "banned_at",
        interface: "datetime",
        readonly: true,
        hidden: true,
        note: "When the user was banned",
      },
      schema: {
        table: collection,
        column: "banned_at",
        data_type: "timestamp with time zone",
        is_nullable: true,
      },
    },
    {
      field: "force_password_reset",
      type: "boolean",
      meta: {
        collection,
        field: "force_password_reset",
        interface: "boolean",
        note: "When true, user must change password on next login",
        required: false,
      },
      schema: {
        table: collection,
        column: "force_password_reset",
        data_type: "boolean",
        is_nullable: true,
        default_value: false,
      },
    },
  ];

  for (const field of fields) {
    try {
      await directusRequest(`/fields/${collection}/${field.field}`);
      console.log(`  - field "${field.field}" already exists`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("404") || msg.includes("403")) {
        await directusRequest(`/fields/${collection}`, {
          method: "POST",
          body: JSON.stringify(field),
        });
        console.log(`  + field "${field.field}" created`);
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