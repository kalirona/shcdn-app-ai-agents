/**
 * Directus AI platform collections setup (Phase 4).
 *
 * Creates additive collections for platform-level AI configuration:
 *   - platform_settings  (singleton)  platform-wide settings
 *   - ai_providers       provider configs (api key, base url, enabled, priority, ...)
 *   - ai_models          model registry discovered from providers
 *   - ai_defaults        (singleton)  default chat/fast/vision/embedding/image/video models
 *
 * Seeds the 9 built-in AI providers. No existing collections are modified.
 * Idempotent: safe to re-run.
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

const PROVIDER_SEEDS = [
  {
    provider_key: "openrouter",
    name: "OpenRouter",
    type: "openai",
    base_url: "https://openrouter.ai/api/v1",
    enabled: true,
    priority: 10,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings"],
  },
  {
    provider_key: "gemini",
    name: "Google Gemini",
    type: "gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    enabled: true,
    priority: 20,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings", "image", "video"],
  },
  {
    provider_key: "openai",
    name: "OpenAI",
    type: "openai",
    base_url: "https://api.openai.com/v1",
    enabled: false,
    priority: 30,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings", "image"],
  },
  {
    provider_key: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    enabled: false,
    priority: 40,
    discoverable: true,
    capabilities: ["chat", "vision"],
  },
  {
    provider_key: "glm",
    name: "GLM",
    type: "openai",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    enabled: true,
    priority: 50,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings"],
  },
  {
    provider_key: "together",
    name: "Together AI",
    type: "openai",
    base_url: "https://api.together.xyz/v1",
    enabled: false,
    priority: 60,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings", "image"],
  },
  {
    provider_key: "groq",
    name: "Groq",
    type: "openai",
    base_url: "https://api.groq.com/openai/v1",
    enabled: false,
    priority: 70,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings"],
  },
  {
    provider_key: "ollama",
    name: "Ollama",
    type: "ollama",
    base_url: "http://localhost:11434",
    enabled: false,
    priority: 80,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings"],
  },
  {
    provider_key: "custom",
    name: "Custom",
    type: "openai",
    base_url: "",
    enabled: false,
    priority: 90,
    discoverable: true,
    capabilities: ["chat", "vision", "embeddings"],
  },
];

async function listCollectionNames() {
  const res = await directusRequest("/collections?limit=-1");
  return new Set((res.data ?? []).map((c) => c.collection));
}

async function listFieldNames(collection) {
  const res = await directusRequest(`/fields/${collection}`);
  return new Set((res.data ?? []).map((f) => f.field));
}

async function ensureCollection(collection, meta, fields) {
  // Existence check via the list endpoint (direct GET returns 403 for
  // collections this token has not yet been granted access to).
  const existing = await listCollectionNames();
  if (!existing.has(collection)) {
    console.log(`Creating collection "${collection}"...`);
    await directusRequest("/collections", {
      method: "POST",
      body: JSON.stringify({
        collection,
        meta,
        schema: { name: collection },
      }),
    });
    console.log(`  + collection "${collection}" created`);
  } else {
    console.log(`Collection '${collection}' already exists. Skipping creation.`);
  }

  const existingFields = await listFieldNames(collection);
  for (const field of fields) {
    if (existingFields.has(field.field)) {
      console.log(`  - field "${collection}.${field.field}" already exists`);
      continue;
    }
    await directusRequest(`/fields/${collection}`, {
      method: "POST",
      body: JSON.stringify(field),
    });
    console.log(`  + field "${collection}.${field.field}" created`);
  }
}

function textField(field, { length = 512, nullable = true, default: def, note } = {}) {
  return {
    field,
    type: "string",
    meta: {
      collection: null,
      field,
      interface: "input",
      width: "full",
      note: note ?? null,
      ...(def !== undefined ? { default_value: def } : {}),
    },
    schema: {
      table: null,
      column: field,
      data_type: "varchar",
      character_maximum_length: length,
      is_nullable: nullable,
      default_value: def ?? null,
    },
  };
}

function jsonField(field, { note, default: def } = {}) {
  return {
    field,
    type: "json",
    meta: {
      collection: null,
      field,
      interface: "input-code",
      note: note ?? null,
      ...(def !== undefined ? { default_value: def } : {}),
    },
    schema: {
      table: null,
      column: field,
      data_type: "json",
      is_nullable: true,
      default_value: def ?? null,
    },
  };
}

function booleanField(field, { default: def = false, note } = {}) {
  return {
    field,
    type: "boolean",
    meta: {
      collection: null,
      field,
      interface: "boolean",
      note: note ?? null,
      default_value: def,
    },
    schema: {
      table: null,
      column: field,
      data_type: "boolean",
      is_nullable: true,
      default_value: def,
    },
  };
}

function integerField(field, { note, default: def } = {}) {
  return {
    field,
    type: "integer",
    meta: {
      collection: null,
      field,
      interface: "input",
      note: note ?? null,
      ...(def !== undefined ? { default_value: def } : {}),
    },
    schema: {
      table: null,
      column: field,
      data_type: "integer",
      is_nullable: true,
      default_value: def ?? null,
    },
  };
}

function decimalField(field, { note, default: def } = {}) {
  return {
    field,
    type: "decimal",
    meta: {
      collection: null,
      field,
      interface: "input",
      note: note ?? null,
      ...(def !== undefined ? { default_value: def } : {}),
    },
    schema: {
      table: null,
      column: field,
      data_type: "decimal",
      numeric_precision: 14,
      numeric_scale: 6,
      is_nullable: true,
      default_value: def ?? null,
    },
  };
}

function datetimeField(field, { note } = {}) {
  return {
    field,
    type: "timestamp",
    meta: {
      collection: null,
      field,
      interface: "datetime",
      note: note ?? null,
    },
    schema: {
      table: null,
      column: field,
      data_type: "timestamp with time zone",
      is_nullable: true,
    },
  };
}

async function ensureSingletonItem(collection, initial) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await directusRequest(`/items/${collection}`);
      const existing = res.data;
      if (existing && existing.id) {
        // Already persisted — bring it up to date with defaults if empty.
        await directusRequest(`/items/${collection}`, {
          method: "PATCH",
          body: JSON.stringify(initial ?? {}),
        });
        console.log(`Singleton "${collection}" already seeded (id=${existing.id}).`);
        return;
      }
      // Singleton returned without an id (not yet persisted) — PATCH creates it.
      await directusRequest(`/items/${collection}`, {
        method: "PATCH",
        body: JSON.stringify(initial ?? {}),
      });
      console.log(`  + singleton "${collection}" seeded`);
      return;
    } catch (e) {
      if (String(e).includes("ROUTE_NOT_FOUND") && attempt < 4) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      console.warn(`  ! could not seed singleton "${collection}": ${e.message}`);
      return;
    }
  }
}

async function seedProviders() {
  const res = await directusRequest(
    `/items/ai_providers?fields=provider_key&limit=-1`,
  );
  const existingKeys = new Set((res.data ?? []).map((p) => p.provider_key));
  let created = 0;
  for (const seed of PROVIDER_SEEDS) {
    if (existingKeys.has(seed.provider_key)) {
      console.log(`  - provider "${seed.provider_key}" already exists`);
      continue;
    }
    await directusRequest("/items/ai_providers", {
      method: "POST",
      body: JSON.stringify({
        ...seed,
        status: "untested",
        api_key: null,
        default_model: null,
        last_error: null,
        last_tested_at: null,
      }),
    });
    console.log(`  + provider "${seed.provider_key}" seeded`);
    created += 1;
  }
  if (created === 0) console.log("  (no new providers needed)");
}

async function main() {
  console.log("Starting Directus AI collections setup...\n");

  await ensureCollection(
    "platform_settings",
    {
      collection: "platform_settings",
      icon: "tune",
      note: "Platform-wide settings (singleton)",
      display_template: "{{platform_name}}",
      singleton: true,
    },
    [
      textField("platform_name", { length: 128, nullable: true, note: "Display name of the platform" }),
      textField("support_email", { length: 256, nullable: true, note: "Public support contact email" }),
      booleanField("maintenance_mode", { default: false, note: "When on, public routes show a maintenance notice" }),
      booleanField("signup_enabled", { default: true, note: "Allow new workspace signups" }),
      textField("default_workspace_plan", { length: 32, nullable: true, default: "starter" }),
      integerField("session_timeout_hours", { default: 24, note: "Default session timeout for the platform" }),
      booleanField("require_2fa", { default: false, note: "Require two-factor authentication for admins" }),
      textField("smtp_host", { length: 256, nullable: true, note: "SMTP server host" }),
      integerField("smtp_port", { note: "SMTP server port" }),
      textField("smtp_user", { length: 256, nullable: true, note: "SMTP username" }),
      textField("smtp_password", { length: 512, nullable: true, note: "SMTP password (masked in app)" }),
      textField("from_email", { length: 256, nullable: true, note: "Outbound from address" }),
      textField("r2_account_id", { length: 256, nullable: true, note: "Cloudflare R2 account id" }),
      textField("r2_access_key_id", { length: 256, nullable: true, note: "R2 access key id" }),
      textField("r2_access_key_secret", { length: 512, nullable: true, note: "R2 secret (masked in app)" }),
      textField("r2_bucket", { length: 256, nullable: true, note: "R2 bucket name" }),
      textField("r2_public_url", { length: 512, nullable: true, note: "Public base URL for R2 objects" }),
    ],
  );

  await ensureSingletonItem("platform_settings", {
    platform_name: "Agent AI",
    support_email: "",
    maintenance_mode: false,
    signup_enabled: true,
    default_workspace_plan: "starter",
    session_timeout_hours: 24,
    require_2fa: false,
    smtp_host: "",
    smtp_port: null,
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    r2_account_id: "",
    r2_access_key_id: "",
    r2_access_key_secret: "",
    r2_bucket: "",
    r2_public_url: "",
  });

  await ensureCollection(
    "ai_providers",
    {
      collection: "ai_providers",
      icon: "bolt",
      note: "AI provider configurations (platform level)",
      display_template: "{{name}}",
    },
    [
      textField("provider_key", { length: 64, nullable: false, note: "Unique provider identifier (openrouter, gemini, ...)" }),
      textField("name", { length: 128, nullable: false, note: "Display name" }),
      textField("type", { length: 32, nullable: false, default: "openai", note: "API dialect: openai | anthropic | gemini | ollama" }),
      {
        field: "api_key",
        type: "string",
        meta: { field: "api_key", interface: "input", special: ["cast-hash"], note: "Provider API key (masked in app) - managed via admin UI" },
        schema: { table: null, column: "api_key", data_type: "varchar", character_maximum_length: 512, is_nullable: true },
      },
      textField("base_url", { length: 512, nullable: true, note: "Optional override of the provider default endpoint" }),
      booleanField("enabled", { default: false, note: "Provider available for use" }),
      integerField("priority", { default: 100, note: "Lower number = higher priority" }),
      textField("default_model", { length: 256, nullable: true, note: "Fallback model when no default is configured" }),
      jsonField("capabilities", { default: ["chat"], note: "Provider capabilities: chat, vision, embeddings, image, video" }),
      textField("status", { length: 16, nullable: false, default: "untested", note: "untested | ok | error" }),
      datetimeField("last_tested_at", { note: "When the connection was last tested" }),
      {
        field: "last_error",
        type: "text",
        meta: { field: "last_error", interface: "input-multiline", note: "Last connection test error" },
        schema: { table: null, column: "last_error", data_type: "text", is_nullable: true },
      },
      booleanField("discoverable", { default: true, note: "Supports automatic model discovery" }),
      decimalField("input_cost_per_million", { note: "Provider-wide input cost per 1M tokens (optional)" }),
      decimalField("output_cost_per_million", { note: "Provider-wide output cost per 1M tokens (optional)" }),
    ],
  );

  await ensureCollection(
    "ai_models",
    {
      collection: "ai_models",
      icon: "hub",
      note: "Model registry discovered from providers",
      display_template: "{{name}}",
    },
    [
      {
        field: "provider",
        type: "uuid",
        meta: {
          field: "provider",
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          options: { related_collection: "ai_providers" },
          display_template: "{{name}}",
          required: true,
        },
        schema: {
          table: null,
          column: "provider",
          data_type: "uuid",
          is_nullable: false,
          foreign_key_table: "ai_providers",
          foreign_key_column: "id",
          on_delete: "CASCADE",
          on_update: "CASCADE",
        },
      },
      textField("model_id", { length: 256, nullable: false, note: "Real model id from the provider" }),
      textField("name", { length: 256, nullable: false, note: "Display name" }),
      jsonField("capabilities", { default: ["chat"], note: "Model capabilities: chat, vision, embeddings, image, video" }),
      booleanField("enabled", { default: true }),
      integerField("context_window", { note: "Max context length in tokens (when known)" }),
      decimalField("input_cost_per_million", { note: "Input cost per 1M tokens (when known)" }),
      decimalField("output_cost_per_million", { note: "Output cost per 1M tokens (when known)" }),
      textField("source", { length: 16, nullable: false, default: "discovered", note: "discovered | manual" }),
    ],
  );

  await ensureCollection(
    "ai_defaults",
    {
      collection: "ai_defaults",
      icon: "flag",
      note: "Platform AI defaults (singleton)",
      display_template: "AI Defaults",
      singleton: true,
    },
    [
      textField("chat_model", { length: 256, nullable: true, note: "Default chat model id" }),
      textField("fast_model", { length: 256, nullable: true, note: "Default fast/latency-sensitive model id" }),
      textField("vision_model", { length: 256, nullable: true, note: "Default vision-capable model id" }),
      textField("embedding_model", { length: 256, nullable: true, note: "Default embedding model id" }),
      textField("image_model", { length: 256, nullable: true, note: "Default image generation model id" }),
      textField("video_model", { length: 256, nullable: true, note: "Default video generation model id" }),
      textField("fallback_provider", { length: 64, nullable: true, note: "Provider key used when the primary provider is unavailable" }),
      textField("fallback_model", { length: 256, nullable: true, note: "Model id used by the fallback provider" }),
    ],
  );

  await ensureSingletonItem("ai_defaults", {});

  console.log("\nSeeding AI providers...");
  await seedProviders();

  // Uniqueness constraint: one ai_providers row per provider_key
  try {
    const constraints = await directusRequest("/constraints?collection=ai_providers");
    const hasUnique = constraints.data?.some(
      (c) => c.type === "UNIQUE" && c.fields?.includes("provider_key"),
    );
    if (!hasUnique) {
      console.log("  + adding uniqueness constraint on ai_providers.provider_key");
      await directusRequest("/constraints", {
        method: "POST",
        body: JSON.stringify({
          collection: "ai_providers",
          type: "UNIQUE",
          fields: ["provider_key"],
          name: "ai_providers_provider_key_unique",
        }),
      });
    } else {
      console.log("  - uniqueness constraint on provider_key already exists");
    }
  } catch (e) {
    console.warn(`  ! could not verify/create uniqueness constraint: ${e.message}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
