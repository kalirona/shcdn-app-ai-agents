/**
 * Directus platform_audit_logs collection setup (Phase 5.2).
 *
 * Creates an append-only collection for the platform audit trail written by
 * recordAuditEvent(). Existing collections are not modified.
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
  console.log("Starting platform_audit_logs collection setup...\n");

  const collection = "platform_audit_logs";

  try {
    await directusRequest(`/collections/${collection}`);
    console.log(`Collection '${collection}' already exists. Skipping creation.`);
  } catch (e) {
    const msg = String(e);
    // GET on non-existing returns 403 (not 404) with this token. Treat both as "create needed".
    if (msg.includes("404") || msg.includes("403")) {
      console.log(`Creating collection "${collection}"...`);
      await directusRequest("/collections", {
        method: "POST",
        body: JSON.stringify({
          collection,
          meta: {
            collection,
            icon: "history",
            note: "Append-only platform audit trail (auth, admin, workspace, security events)",
          },
          schema: {
            name: collection,
          },
        }),
      });
      console.log(`  + collection "${collection}" created`);
    } else {
      throw e;
    }
  }

  const fields = [
    {
      field: "actor",
      type: "string",
      meta: {
        collection,
        field: "actor",
        interface: "input",
        note: "Directus user ID of the actor (null for system/failed-login events)",
      },
      schema: {
        table: collection,
        column: "actor",
        data_type: "uuid",
        is_nullable: true,
      },
    },
    {
      field: "actor_email",
      type: "string",
      meta: {
        collection,
        field: "actor_email",
        interface: "input",
        note: "Denormalized actor email for search/display",
      },
      schema: {
        table: collection,
        column: "actor_email",
        data_type: "varchar",
        character_maximum_length: 255,
        is_nullable: true,
      },
    },
    {
      field: "action",
      type: "string",
      meta: {
        collection,
        field: "action",
        interface: "input",
        note: 'Stable action key, e.g. "auth.login", "admin.user.suspend"',
        required: true,
      },
      schema: {
        table: collection,
        column: "action",
        data_type: "varchar",
        character_maximum_length: 128,
        is_nullable: false,
      },
    },
    {
      field: "category",
      type: "string",
      meta: {
        collection,
        field: "category",
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Auth", value: "auth" },
            { text: "Admin", value: "admin" },
            { text: "Workspace", value: "workspace" },
            { text: "User", value: "user" },
            { text: "Security", value: "security" },
            { text: "System", value: "system" },
          ],
        },
        required: true,
      },
      schema: {
        table: collection,
        column: "category",
        data_type: "varchar",
        character_maximum_length: 16,
        is_nullable: false,
      },
    },
    {
      field: "target_type",
      type: "string",
      meta: {
        collection,
        field: "target_type",
        interface: "input",
        note: 'e.g. "user", "workspace", "membership", "platform_settings"',
      },
      schema: {
        table: collection,
        column: "target_type",
        data_type: "varchar",
        character_maximum_length: 64,
        is_nullable: true,
      },
    },
    {
      field: "target_id",
      type: "string",
      meta: {
        collection,
        field: "target_id",
        interface: "input",
      },
      schema: {
        table: collection,
        column: "target_id",
        data_type: "varchar",
        character_maximum_length: 64,
        is_nullable: true,
      },
    },
    {
      field: "target_label",
      type: "string",
      meta: {
        collection,
        field: "target_label",
        interface: "input",
        note: "Human-readable target label (email, workspace name, setting key)",
      },
      schema: {
        table: collection,
        column: "target_label",
        data_type: "varchar",
        character_maximum_length: 255,
        is_nullable: true,
      },
    },
    {
      field: "metadata",
      type: "json",
      meta: {
        collection,
        field: "metadata",
        special: ["cast-json"],
        interface: "json",
        note: "Arbitrary structured context",
      },
      schema: {
        table: collection,
        column: "metadata",
        data_type: "jsonb",
        is_nullable: true,
      },
    },
    {
      field: "ip_address",
      type: "string",
      meta: {
        collection,
        field: "ip_address",
        interface: "input",
      },
      schema: {
        table: collection,
        column: "ip_address",
        data_type: "varchar",
        character_maximum_length: 64,
        is_nullable: true,
      },
    },
    {
      field: "user_agent",
      type: "text",
      meta: {
        collection,
        field: "user_agent",
        interface: "input",
      },
      schema: {
        table: collection,
        column: "user_agent",
        data_type: "text",
        is_nullable: true,
      },
    },
    {
      field: "status",
      type: "string",
      meta: {
        collection,
        field: "status",
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Success", value: "success" },
            { text: "Failure", value: "failure" },
          ],
        },
        required: true,
      },
      schema: {
        table: collection,
        column: "status",
        data_type: "varchar",
        character_maximum_length: 16,
        is_nullable: false,
      },
    },
    {
      field: "severity",
      type: "string",
      meta: {
        collection,
        field: "severity",
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Info", value: "info" },
            { text: "Warning", value: "warning" },
            { text: "Critical", value: "critical" },
          ],
        },
        required: true,
      },
      schema: {
        table: collection,
        column: "severity",
        data_type: "varchar",
        character_maximum_length: 16,
        is_nullable: false,
      },
    },
    {
      field: "date_created",
      type: "timestamp",
      meta: {
        collection,
        field: "date_created",
        interface: "datetime",
        readonly: true,
        hidden: true,
      },
      schema: {
        table: collection,
        column: "date_created",
        data_type: "timestamp with time zone",
        is_nullable: false,
        default_value: "now()",
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
