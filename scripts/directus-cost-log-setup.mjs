/**
 * Directus provider_cost_logs collection setup.
 *
 * Creates a collection for tracking AI provider usage costs.
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
  console.log("Starting provider_cost_logs collection setup...\n");

  const collection = "provider_cost_logs";

  try {
    await directusRequest(`/collections/${collection}`);
    console.log(`Collection '${collection}' already exists. Skipping creation.`);
  } catch (e) {
    if (String(e).includes("404") || String(e).includes("403")) {
      console.log(`Creating collection "${collection}"...`);
      await directusRequest("/collections", {
        method: "POST",
        body: JSON.stringify({
          collection,
          meta: {
            collection,
            icon: "currency_dollar",
            note: "Per-request AI provider cost tracking (input/output tokens and estimated costs)",
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
      field: "provider",
      type: "string",
      meta: { collection, field: "provider", interface: "input", required: true },
      schema: { table: collection, column: "provider", data_type: "varchar", character_maximum_length: 64, is_nullable: false },
    },
    {
      field: "model",
      type: "string",
      meta: { collection, field: "model", interface: "input", required: true },
      schema: { table: collection, column: "model", data_type: "varchar", character_maximum_length: 128, is_nullable: false },
    },
    {
      field: "purpose",
      type: "string",
      meta: {
        collection,
        field: "purpose",
        interface: "select-dropdown",
        options: { choices: [{ text: "Chat", value: "chat" }, { text: "Fast", value: "fast" }, { text: "Vision", value: "vision" }, { text: "Embeddings", value: "embeddings" }, { text: "Image", value: "image" }, { text: "Video", value: "video" }] },
        required: true,
      },
      schema: { table: collection, column: "purpose", data_type: "varchar", character_maximum_length: 16, is_nullable: false },
    },
    {
      field: "input_tokens",
      type: "integer",
      meta: { collection, field: "input_tokens", interface: "input", required: true },
      schema: { table: collection, column: "input_tokens", data_type: "integer", is_nullable: false },
    },
    {
      field: "output_tokens",
      type: "integer",
      meta: { collection, field: "output_tokens", interface: "input", required: true },
      schema: { table: collection, column: "output_tokens", data_type: "integer", is_nullable: false },
    },
    {
      field: "input_cost",
      type: "decimal",
      meta: { collection, field: "input_cost", interface: "input", required: true },
      schema: { table: collection, column: "input_cost", data_type: "decimal", precision: 10, scale: 6, is_nullable: false },
    },
    {
      field: "output_cost",
      type: "decimal",
      meta: { collection, field: "output_cost", interface: "input", required: true },
      schema: { table: collection, column: "output_cost", data_type: "decimal", precision: 10, scale: 6, is_nullable: false },
    },
    {
      field: "total_cost",
      type: "decimal",
      meta: { collection, field: "total_cost", interface: "input", required: true },
      schema: { table: collection, column: "total_cost", data_type: "decimal", precision: 10, scale: 6, is_nullable: false },
    },
    {
      field: "workspace",
      type: "string",
      meta: { collection, field: "workspace", interface: "input", special: ["m2o"], options: { related_collection: "workspaces" } },
      schema: { table: collection, column: "workspace", data_type: "uuid", is_nullable: true, foreign_key_table: "workspaces", foreign_key_column: "id", on_delete: "SET_NULL" },
    },
    {
      field: "agent",
      type: "string",
      meta: { collection, field: "agent", interface: "input", special: ["m2o"], options: { related_collection: "agents" } },
      schema: { table: collection, column: "agent", data_type: "uuid", is_nullable: true, foreign_key_table: "agents", foreign_key_column: "id", on_delete: "SET_NULL" },
    },
    {
      field: "user",
      type: "string",
      meta: { collection, field: "user", interface: "input", special: ["m2o"], options: { related_collection: "directus_users" } },
      schema: { table: collection, column: "user", data_type: "uuid", is_nullable: true, foreign_key_table: "directus_users", foreign_key_column: "id", on_delete: "SET_NULL" },
    },
    {
      field: "date_created",
      type: "timestamp",
      meta: { collection, field: "date_created", interface: "datetime", readonly: true, hidden: true, special: ["date-created"] },
      schema: { table: collection, column: "date_created", data_type: "timestamp with time zone", is_nullable: true },
    },
  ];

  for (const field of fields) {
    try {
      await directusRequest(`/fields/${collection}/${field.field}`);
      console.log(`  - field "${field.field}" already exists`);
    } catch (e) {
      if (String(e).includes("404") || String(e).includes("403")) {
        await directusRequest(`/fields/${collection}`, { method: "POST", body: JSON.stringify(field) });
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