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
const BASE = (process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!BASE || !TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

let c = 0, f = 0, r = 0;

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
  try { await api("GET", `/collections/${name}`); return true; } catch { return false; }
}

async function col(name, icon, note) {
  if (await exists(name)) { console.log(`= collection "${name}" exists, skip`); return; }
  await api("POST", "/collections", {
    collection: name,
    meta: { icon, note, accountability: "all" },
    schema: { name },
  });
  c += 1;
  console.log(`+ collection "${name}"`);
}

async function fieldExists(collection, name) {
  try { await api("GET", `/fields/${collection}/${name}`); return true; } catch { return false; }
}

async function field(collection, field) {
  if (await fieldExists(collection, field.field)) { console.log(`  = ${collection}.${field.field} exists, skip`); return; }
  await api("POST", `/fields/${collection}`, field);
  f += 1;
  console.log(`  + ${collection}.${field.field} (${field.type})`);
}

async function relationExists(collection, field) {
  try {
    const rels = await api("GET", `/relations/${collection}/${field}`);
    return rels ? true : false;
  } catch {
    return false;
  }
}

async function rel(collection, field, related) {
  if (await relationExists(collection, field)) { console.log(`  = relation ${collection}.${field} -> ${related} exists, skip`); return; }
  await api("POST", "/relations", { collection, field, related_collection: related, schema: { on_delete: "CASCADE" } });
  r += 1;
  console.log(`  + relation ${collection}.${field} -> ${related}`);
}

async function timestamps(collection) {
  await field(collection, { field: "date_created", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", special: ["date-created"], readonly: true } });
  await field(collection, { field: "date_updated", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", special: ["date-updated"], readonly: true } });
}

const sel = (choices) => ({ interface: "select-dropdown", options: { choices } });
const m2o = (name, related, required = true) => ({
  field: name,
  type: "integer",
  meta: { interface: "many-to-one", special: ["m2o"], required },
  schema: { is_nullable: !required, data_type: "integer" },
});

console.log("Starting Directus setup...\n");

// 1. workspaces
await col("workspaces", "business", "Business workspaces");
await field("workspaces", { field: "name", type: "string", schema: { is_nullable: false, max_length: 64 }, meta: { interface: "input", required: true } });
await field("workspaces", { field: "slug", type: "string", schema: { is_nullable: false, max_length: 64, is_unique: true }, meta: { interface: "input", required: true } });
await field("workspaces", { field: "description", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await field("workspaces", { field: "logo", type: "uuid", schema: { is_nullable: true }, meta: { interface: "file-image", special: ["file"] } });
await field("workspaces", { field: "website", type: "string", schema: { is_nullable: true, max_length: 256 }, meta: { interface: "input" } });
await field("workspaces", { field: "status", type: "string", schema: { is_nullable: false, default_value: "active" }, meta: sel([
  { text: "Active", value: "active" }, { text: "Suspended", value: "suspended" }, { text: "Archived", value: "archived" },
]) });
await timestamps("workspaces");

// 2. memberships
await col("memberships", "group", "Workspace memberships linking users to workspaces");
await field("memberships", m2o("workspace", "workspaces"));
await field("memberships", { field: "user", type: "string", schema: { is_nullable: false }, meta: { interface: "input", note: "Logto user ID", required: true } });
await field("memberships", { field: "email", type: "string", schema: { is_nullable: true, max_length: 256 }, meta: { interface: "input", note: "Member email" } });
await field("memberships", { field: "name", type: "string", schema: { is_nullable: true, max_length: 128 }, meta: { interface: "input", note: "Member display name" } });
await field("memberships", { field: "role", type: "string", schema: { is_nullable: false, default_value: "member" }, meta: sel([
  { text: "Owner", value: "owner" }, { text: "Admin", value: "admin" }, { text: "Member", value: "member" },
]) });
await field("memberships", { field: "status", type: "string", schema: { is_nullable: false, default_value: "active" }, meta: sel([
  { text: "Active", value: "active" }, { text: "Invited", value: "invited" }, { text: "Inactive", value: "inactive" },
]) });
await rel("memberships", "workspace", "workspaces");
await timestamps("memberships");

// 3. agents
await col("agents", "smart_toy", "AI agents configured per workspace");
await field("agents", m2o("workspace", "workspaces"));
await field("agents", { field: "name", type: "string", schema: { is_nullable: false, max_length: 128 }, meta: { interface: "input", required: true } });
await field("agents", { field: "description", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await field("agents", { field: "avatar", type: "uuid", schema: { is_nullable: true }, meta: { interface: "file-image", special: ["file"] } });
await field("agents", { field: "system_prompt", type: "text", schema: { is_nullable: false }, meta: { interface: "textarea", required: true } });
await field("agents", { field: "tone", type: "string", schema: { is_nullable: false, default_value: "professional" }, meta: sel([
  { text: "Professional", value: "professional" }, { text: "Friendly", value: "friendly" }, { text: "Casual", value: "casual" }, { text: "Custom", value: "custom" },
]) });
await field("agents", { field: "language", type: "string", schema: { is_nullable: false, default_value: "en" }, meta: { interface: "input" } });
await field("agents", { field: "greeting", type: "text", schema: { is_nullable: false, default_value: "Hello! How can I help you today?" }, meta: { interface: "textarea" } });
await field("agents", { field: "fallback_message", type: "text", schema: { is_nullable: false }, meta: { interface: "textarea" } });
await field("agents", { field: "status", type: "string", schema: { is_nullable: false, default_value: "draft" }, meta: sel([
  { text: "Draft", value: "draft" }, { text: "Active", value: "active" }, { text: "Paused", value: "paused" },
]) });
await field("agents", { field: "purpose", type: "string", schema: { is_nullable: false, default_value: "custom" }, meta: { interface: "input" } });
await field("agents", { field: "primary_goal", type: "string", schema: { is_nullable: false, default_value: "answer_questions" }, meta: { interface: "input" } });
await field("agents", { field: "secondary_goal", type: "string", schema: { is_nullable: false, default_value: "" }, meta: { interface: "input" } });
await field("agents", { field: "fallback_action", type: "string", schema: { is_nullable: false, default_value: "transfer_human" }, meta: { interface: "input" } });
await field("agents", { field: "behaviors", type: "json", schema: { is_nullable: false, default_value: [] }, meta: { interface: "list", special: ["cast-json"] } });
await field("agents", { field: "allowed_tools", type: "json", schema: { is_nullable: false, default_value: [] }, meta: { interface: "list", special: ["cast-json"] } });
await rel("agents", "workspace", "workspaces");
await timestamps("agents");

// 4. knowledge_sources
await col("knowledge_sources", "menu_book", "Knowledge sources for AI agents");
await field("knowledge_sources", m2o("workspace", "workspaces"));
await field("knowledge_sources", m2o("agent", "agents", false));
await field("knowledge_sources", { field: "type", type: "string", schema: { is_nullable: false }, meta: { ...sel([
  { text: "Website", value: "website" }, { text: "Document", value: "document" }, { text: "FAQ", value: "faq" }, { text: "Manual Text", value: "text" },
]), required: true } });
await field("knowledge_sources", { field: "title", type: "string", schema: { is_nullable: false, max_length: 256 }, meta: { interface: "input", required: true } });
await field("knowledge_sources", { field: "url", type: "string", schema: { is_nullable: true, max_length: 2048 }, meta: { interface: "input" } });
await field("knowledge_sources", { field: "file", type: "uuid", schema: { is_nullable: true }, meta: { interface: "file", special: ["file"] } });
await field("knowledge_sources", { field: "status", type: "string", schema: { is_nullable: false, default_value: "pending" }, meta: sel([
  { text: "Pending", value: "pending" }, { text: "Processing", value: "processing" }, { text: "Ready", value: "ready" }, { text: "Failed", value: "failed" },
]) });
await field("knowledge_sources", { field: "error_message", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea", readonly: true } });
await field("knowledge_sources", { field: "chunk_count", type: "integer", schema: { is_nullable: false, default_value: 0 }, meta: { interface: "input", readonly: true } });
await field("knowledge_sources", { field: "visibility", type: "string", schema: { is_nullable: false, default_value: "public" }, meta: sel([
  { text: "Public", value: "public" }, { text: "Internal", value: "internal" },
]) });
await rel("knowledge_sources", "workspace", "workspaces");
await rel("knowledge_sources", "agent", "agents");
await timestamps("knowledge_sources");

// 5. knowledge_chunks
await col("knowledge_chunks", "view_module", "Chunked knowledge content with embeddings");
await field("knowledge_chunks", m2o("source", "knowledge_sources"));
await field("knowledge_chunks", { field: "content", type: "text", schema: { is_nullable: false }, meta: { interface: "textarea", required: true } });
await field("knowledge_chunks", { field: "embedding", type: "json", schema: { is_nullable: true }, meta: { interface: "input-code", special: ["cast-json"] } });
await field("knowledge_chunks", { field: "metadata", type: "json", schema: { is_nullable: true, default_value: {} }, meta: { interface: "input-code", special: ["cast-json"] } });
await field("knowledge_chunks", { field: "index", type: "integer", schema: { is_nullable: false, default_value: 0 }, meta: { interface: "input" } });
await rel("knowledge_chunks", "source", "knowledge_sources");
await timestamps("knowledge_chunks");

// 6. conversations
await col("conversations", "chat", "Customer conversations with AI agents");
await field("conversations", m2o("workspace", "workspaces"));
await field("conversations", m2o("agent", "agents"));
await field("conversations", { field: "customer", type: "string", schema: { is_nullable: true }, meta: { interface: "input", note: "Customer id (plain string)" } });
await field("conversations", { field: "customer_email", type: "string", schema: { is_nullable: true, max_length: 256 }, meta: { interface: "input" } });
await field("conversations", { field: "customer_name", type: "string", schema: { is_nullable: true, max_length: 128 }, meta: { interface: "input" } });
await field("conversations", { field: "status", type: "string", schema: { is_nullable: false, default_value: "active" }, meta: sel([
  { text: "Active", value: "active" }, { text: "Human Required", value: "human_required" }, { text: "With Human", value: "with_human" }, { text: "Resolved", value: "resolved" },
]) });
await field("conversations", { field: "handoff_trigger", type: "string", schema: { is_nullable: true }, meta: { interface: "input" } });
await field("conversations", { field: "handoff_reason", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await rel("conversations", "workspace", "workspaces");
await rel("conversations", "agent", "agents");
await timestamps("conversations");

// 7. messages
await col("messages", "chat_bubble_outline", "Individual messages within conversations");
await field("messages", m2o("conversation", "conversations"));
await field("messages", { field: "role", type: "string", schema: { is_nullable: false }, meta: { ...sel([
  { text: "User", value: "user" }, { text: "Assistant", value: "assistant" }, { text: "System", value: "system" },
]), required: true } });
await field("messages", { field: "content", type: "text", schema: { is_nullable: false }, meta: { interface: "textarea", required: true } });
await field("messages", { field: "sources", type: "json", schema: { is_nullable: true }, meta: { interface: "input-code", special: ["cast-json"] } });
await field("messages", { field: "metadata", type: "json", schema: { is_nullable: true, default_value: {} }, meta: { interface: "input-code", special: ["cast-json"] } });
await rel("messages", "conversation", "conversations");
await timestamps("messages");

// 8. leads
await col("leads", "star", "Leads captured by AI agents");
await field("leads", m2o("workspace", "workspaces"));
await field("leads", { field: "name", type: "string", schema: { is_nullable: false, max_length: 128 }, meta: { interface: "input", required: true } });
await field("leads", { field: "email", type: "string", schema: { is_nullable: false, max_length: 256 }, meta: { interface: "input", required: true } });
await field("leads", { field: "phone", type: "string", schema: { is_nullable: true, max_length: 64 }, meta: { interface: "input" } });
await field("leads", { field: "company", type: "string", schema: { is_nullable: true, max_length: 128 }, meta: { interface: "input" } });
await field("leads", { field: "message", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await field("leads", { field: "source", type: "string", schema: { is_nullable: true, max_length: 64 }, meta: { interface: "input" } });
await field("leads", { field: "status", type: "string", schema: { is_nullable: false, default_value: "new" }, meta: sel([
  { text: "New", value: "new" }, { text: "Contacted", value: "contacted" }, { text: "Qualified", value: "qualified" }, { text: "Won", value: "won" }, { text: "Lost", value: "lost" },
]) });
await field("leads", { field: "qualification", type: "json", schema: { is_nullable: true, default_value: {} }, meta: { interface: "input-code", special: ["cast-json"] } });
await rel("leads", "workspace", "workspaces");
await timestamps("leads");

// 9. bookings
await col("bookings", "event", "Customer bookings with AI agents");
await field("bookings", m2o("workspace", "workspaces"));
await field("bookings", { field: "service", type: "string", schema: { is_nullable: true, max_length: 128 }, meta: { interface: "input" } });
await field("bookings", { field: "date", type: "string", schema: { is_nullable: true, max_length: 32 }, meta: { interface: "input" } });
await field("bookings", { field: "time", type: "string", schema: { is_nullable: true, max_length: 32 }, meta: { interface: "input" } });
await field("bookings", { field: "customer_name", type: "string", schema: { is_nullable: false, max_length: 128 }, meta: { interface: "input", required: true } });
await field("bookings", { field: "customer_email", type: "string", schema: { is_nullable: false, max_length: 256 }, meta: { interface: "input", required: true } });
await field("bookings", { field: "customer_phone", type: "string", schema: { is_nullable: true, max_length: 64 }, meta: { interface: "input" } });
await field("bookings", { field: "notes", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await field("bookings", { field: "status", type: "string", schema: { is_nullable: false, default_value: "confirmed" }, meta: sel([
  { text: "Confirmed", value: "confirmed" }, { text: "Cancelled", value: "cancelled" }, { text: "Completed", value: "completed" }, { text: "Rescheduled", value: "rescheduled" },
]) });
await rel("bookings", "workspace", "workspaces");
await timestamps("bookings");

// 10. customers
await col("customers", "person", "Customer profiles for workspace");
await field("customers", m2o("workspace", "workspaces"));
await field("customers", { field: "name", type: "string", schema: { is_nullable: false, max_length: 128 }, meta: { interface: "input", required: true } });
await field("customers", { field: "email", type: "string", schema: { is_nullable: false, max_length: 256 }, meta: { interface: "input", required: true } });
await field("customers", { field: "phone", type: "string", schema: { is_nullable: true, max_length: 64 }, meta: { interface: "input" } });
await field("customers", { field: "company", type: "string", schema: { is_nullable: true, max_length: 128 }, meta: { interface: "input" } });
await field("customers", { field: "stage", type: "string", schema: { is_nullable: false, default_value: "lead" }, meta: sel([
  { text: "Anonymous", value: "anonymous" }, { text: "Lead", value: "lead" }, { text: "Customer", value: "customer" },
]) });
await field("customers", { field: "notes", type: "text", schema: { is_nullable: true }, meta: { interface: "textarea" } });
await rel("customers", "workspace", "workspaces");
await timestamps("customers");

console.log("\n-- RLS roles, policies & permissions --");

const APP_COLLECTIONS = ["workspaces", "memberships", "agents", "knowledge_sources", "knowledge_chunks", "conversations", "messages", "leads", "bookings", "customers"];

const ROLE_DEFS = [
  { key: "app_owner", name: "App Owner" },
  { key: "app_manager", name: "App Manager" },
  { key: "app_agent", name: "App Agent" },
];

async function getOrCreateRole(def) {
  const roles = await api("GET", `/roles?limit=-1`);
  const existing = roles.find((r) => r.name === def.name);
  if (existing) { console.log(`= role "${def.key}" exists, skip`); return existing.id; }
  const created = await api("POST", "/roles", { key: def.key, name: def.name, admin_access: false, app_access: true });
  console.log(`+ role "${def.key}"`);
  return created.id;
}

async function getOrCreatePolicy(name) {
  const policies = await api("GET", `/policies?limit=-1`);
  const existing = policies.find((p) => p.name === name);
  if (existing) { console.log(`= policy "${name}" exists, skip`); return existing.id; }
  const created = await api("POST", "/policies", {
    name,
    app_access: true,
    admin_access: false,
    enforce_tfa: false,
  });
  console.log(`+ policy "${name}"`);
  return created.id;
}

async function ensureAccess(roleId, policyId) {
  const access = await api("GET", `/access?limit=-1`);
  const existing = access.find((a) => a.role === roleId && a.policy === policyId);
  if (existing) { console.log(`= access ${roleId} -> ${policyId} exists, skip`); return; }
  await api("POST", "/access", { role: roleId, policy: policyId });
  console.log(`+ access ${roleId} -> ${policyId}`);
}

async function ensurePermission(policyId, collection, action, fields, permissions, validation) {
  const perms = await api("GET", `/permissions?limit=-1`);
  const existing = perms.find(
    (p) => p.policy === policyId && p.collection === collection && p.action === action,
  );
  if (existing) { console.log(`  = permission ${collection}.${action} exists, skip`); return; }
  const body = { policy: policyId, collection, action };
  if (fields) body.fields = fields;
  // Custom filter rules are feature-gated on this Directus instance, so grants
  // are coarse-grained full access here. True row-level security is enforced at
  // the app layer via requireWorkspaceAccess() + workspace memberships.
  if (validation) body.validation = validation;
  await api("POST", "/permissions", body);
  console.log(`  + permission ${collection}.${action}`);
}

const ALL_FIELDS = ["*"];
const READ_ONLY = ["*"];
async function configureRls() {
  const roleIds = {};
  const policyIds = {};

  for (const def of ROLE_DEFS) {
    const roleId = await getOrCreateRole(def);
    const policyId = await getOrCreatePolicy(def.name);
    await ensureAccess(roleId, policyId);
    roleIds[def.key] = roleId;
    policyIds[def.key] = policyId;
  }

  const ownerPolicy = policyIds.app_owner;
  const managerPolicy = policyIds.app_manager;
  const agentPolicy = policyIds.app_agent;

  for (const collection of APP_COLLECTIONS) {
    // Owner: full access
    for (const action of ["create", "read", "update", "delete"]) {
      await ensurePermission(ownerPolicy, collection, action, ALL_FIELDS);
    }

    if (collection === "workspaces") {
      await ensurePermission(managerPolicy, collection, "read", ALL_FIELDS);
      await ensurePermission(managerPolicy, collection, "update", ALL_FIELDS);
      await ensurePermission(agentPolicy, collection, "read", ALL_FIELDS);
      continue;
    }

    if (collection === "memberships") {
      await ensurePermission(managerPolicy, collection, "read", ALL_FIELDS);
      await ensurePermission(agentPolicy, collection, "read", ALL_FIELDS);
      continue;
    }

    // Manager: full CRUD on content collections (agents, knowledge, conversations, messages)
    for (const action of ["create", "read", "update", "delete"]) {
      await ensurePermission(managerPolicy, collection, action, ALL_FIELDS);
    }

    // Agent: read-only on conversations, messages, agents, knowledge, leads, bookings, customers
    if (
      ["conversations", "messages", "agents", "knowledge_sources", "knowledge_chunks", "leads", "bookings", "customers"].includes(collection)
    ) {
      await ensurePermission(agentPolicy, collection, "read", ALL_FIELDS);
    }
  }
}

await configureRls();

console.log("\nDone!");
console.log(`  Collections: ${c} created`);
console.log(`  Fields:      ${f} created`);
console.log(`  Relations:   ${r} created`);
