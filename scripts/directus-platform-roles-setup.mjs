/**
 * Directus platform_roles collection setup (Phase 22A).
 *
 * Creates an additive collection for platform-level Super Admin assignments.
 * No existing collections are modified.
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
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
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
  console.log("Starting platform_roles collection setup...\n");

  // Check if collection already exists
  try {
    await directusRequest("/collections/platform_roles");
    console.log("Collection 'platform_roles' already exists. Skipping creation.");
  } catch (e) {
    if (String(e).includes("404")) {
      // Create collection
      console.log('Creating collection "platform_roles"...');
      await directusRequest("/collections", {
        method: "POST",
        body: JSON.stringify({
          collection: "platform_roles",
          meta: {
            collection: "platform_roles",
            icon: "shield",
            note: "Platform-level Super Admin role assignments",
            display_template: "{{user}} - {{role}}",
          },
          schema: {
            name: "platform_roles",
          },
        }),
      });
      console.log('  + collection "platform_roles" created');
    } else {
      throw e;
    }
  }

  // Fields
  const fields = [
    {
      field: "user",
      type: "many_to_one",
      meta: {
        collection: "platform_roles",
        field: "user",
        special: ["m2o"],
        interface: "select-dropdown-m2o",
        options: {
          related_collection: "directus_users",
        },
        display_template: "{{email}}",
        required: true,
        validation: {
          required: true,
        },
      },
      schema: {
        table: "platform_roles",
        column: "user",
        foreign_key_table: "directus_users",
        foreign_key_column: "id",
        on_delete: "CASCADE",
        on_update: "CASCADE",
      },
    },
    {
      field: "role",
      type: "string",
      meta: {
        collection: "platform_roles",
        field: "role",
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Super Admin", value: "super_admin" },
          ],
        },
        required: true,
        validation: {
          required: true,
        },
        default_value: "super_admin",
      },
      schema: {
        table: "platform_roles",
        column: "role",
        data_type: "varchar",
        character_maximum_length: 32,
        is_nullable: false,
      },
    },
    {
      field: "date_created",
      type: "timestamp",
      meta: {
        collection: "platform_roles",
        field: "date_created",
        interface: "datetime",
        readonly: true,
        hidden: true,
      },
      schema: {
        table: "platform_roles",
        column: "date_created",
        data_type: "timestamp with time zone",
        is_nullable: false,
        default_value: { expression: "now()" },
      },
    },
  ];

  for (const field of fields) {
    try {
      await directusRequest(`/fields/platform_roles/${field.field}`);
      console.log(`  - field "${field.field}" already exists`);
    } catch (e) {
      if (String(e).includes("404")) {
        await directusRequest("/fields/platform_roles", {
          method: "POST",
          body: JSON.stringify(field),
        });
        console.log(`  + field "${field.field}" created`);
      } else {
        throw e;
      }
    }
  }

  // Uniqueness constraint: one super_admin per user
  try {
    const constraints = await directusRequest("/constraints?collection=platform_roles");
    const hasUnique = constraints.data?.some((c) => c.type === "UNIQUE" && c.fields?.includes("user") && c.fields?.includes("role"));
    if (!hasUnique) {
      console.log('  + adding uniqueness constraint on (user, role)');
      await directusRequest("/constraints", {
        method: "POST",
        body: JSON.stringify({
          collection: "platform_roles",
          type: "UNIQUE",
          fields: ["user", "role"],
          name: "platform_roles_user_role_unique",
        }),
      });
    } else {
      console.log('  - uniqueness constraint on (user, role) already exists');
    }
  } catch (e) {
    console.warn("  ! could not verify/create uniqueness constraint:", e.message);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});