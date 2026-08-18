#!/usr/bin/env node
/**
 * Phase 3 — Directus Identity Migration
 *
 * Migrates identity references from Logto `sub` values to Directus user UUIDs:
 *
 *   1. `snapshot`   — dump memberships, platform_roles and directus_users to a
 *                     timestamped JSON backup under scripts/backups/ (rollback source).
 *   2. `apply`      — create Directus users for every remaining Logto sub (with
 *                     placeholder email + external_identifier = sub), set the old
 *                     sub on the existing preetkalirona user, then convert
 *                     memberships.user and platform_roles.user to Directus UUIDs.
 *   3. `rollback`   — restore memberships/platform_roles/users from the snapshot.
 *
 * Reads DIRECTUS_URL / DIRECTUS_TOKEN from .env.local (or process env).
 *
 * Usage:
 *   node scripts/directus-identity-migration.mjs snapshot
 *   node scripts/directus-identity-migration.mjs apply
 *   node scripts/directus-identity-migration.mjs rollback [<snapshot-file>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SCRIPTS_DIR = resolve(import.meta.dirname, "..", "scripts");
const BACKUPS_DIR = join(SCRIPTS_DIR, "backups");

// Known super-admin identity: preetkalirona@gmail.com
const SUPER_ADMIN_EMAIL = "preetkalirona@gmail.com";
const SUPER_ADMIN_SUB = "db1bw2sol1yo";

function loadEnv() {
  const file = resolve(import.meta.dirname, "..", ".env.local");
  const out = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      let v = t.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[t.slice(0, i).trim()] = v;
    }
  }
  return out;
}

const fileEnv = loadEnv();
const BASE = (process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!BASE || !TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required (set in .env.local or env).");
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function api(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: { ...H, ...(opts.headers ?? {}) } });
  const text = await r.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!r.ok) {
    const msg = body?.errors?.[0]?.message ?? `HTTP ${r.status} ${opts.method ?? "GET"} ${path}`;
    throw new Error(msg);
  }
  return body?.data;
}

async function getUsers() {
  return api("/users?limit=-1&fields=id,email,first_name,last_name,status,role,external_identifier");
}
async function getMemberships() {
  return api("/items/memberships?limit=-1");
}
async function getPlatformRoles() {
  return api("/items/platform_roles?limit=-1");
}

function latestSnapshot() {
  if (!existsSync(BACKUPS_DIR)) return null;
  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => /^identity-snapshot-.*\.json$/.test(f))
    .sort()
    .reverse();
  return files.length ? join(BACKUPS_DIR, files[0]) : null;
}

async function snapshot() {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(BACKUPS_DIR, `identity-snapshot-${stamp}.json`);
  const data = {
    takenAt: new Date().toISOString(),
    directus_users: await getUsers(),
    memberships: await getMemberships(),
    platform_roles: await getPlatformRoles(),
  };
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Snapshot written: ${file}`);
  console.log(`  users: ${data.directus_users.length}, memberships: ${data.memberships.length}, platform_roles: ${data.platform_roles.length}`);
  return file;
}

function placeholderEmail(sub) {
  return `${sub}@example.com`;
}

async function apply() {
  await snapshot();
  const users = await getUsers();
  const memberships = await getMemberships();
  const platformRoles = await getPlatformRoles();

  const subToUuid = {};
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  // Resolve the existing Directus user for the super admin (preetkalirona@gmail.com).
  const superAdminUser = userByEmail.get(SUPER_ADMIN_EMAIL);
  if (!superAdminUser) {
    console.error(`ERROR: no Directus user exists for ${SUPER_ADMIN_EMAIL}.`);
    process.exit(1);
  }
  subToUuid[SUPER_ADMIN_SUB] = superAdminUser.id;
  console.log(`[map] ${SUPER_ADMIN_SUB} -> ${superAdminUser.id} (${SUPER_ADMIN_EMAIL}) [existing user]`);

  // Preserve the old Logto sub on the super-admin Directus user.
  if (superAdminUser.external_identifier !== SUPER_ADMIN_SUB) {
    await api(`/users/${superAdminUser.id}`, { method: "PATCH", body: JSON.stringify({ external_identifier: SUPER_ADMIN_SUB }) });
    console.log(`[set] directus_users/${superAdminUser.id}.external_identifier = ${SUPER_ADMIN_SUB}`);
  }

  // Collect every distinct Logto sub referenced by memberships/platform_roles that is
  // not already a Directus UUID (i.e. not resolvable in directus_users).
  const distinct = new Set();
  for (const m of memberships) if (m.user) distinct.add(m.user);
  for (const p of platformRoles) if (p.user) distinct.add(p.user);

  for (const sub of distinct) {
    if (subToUuid[sub]) continue;
    const existingById = users.find((u) => u.id === sub);
    if (existingById) {
      subToUuid[sub] = sub; // already a Directus UUID
      console.log(`[map] ${sub} -> ${sub} (already a Directus UUID)`);
      continue;
    }
    const byExt = users.find((u) => u.external_identifier === sub);
    if (byExt) {
      subToUuid[sub] = byExt.id;
      console.log(`[map] ${sub} -> ${byExt.id} (matched via external_identifier)`);
      continue;
    }
    // Create a new Directus user record for this identity.
    const created = await api("/users", {
      method: "POST",
      body: JSON.stringify({
        email: placeholderEmail(sub),
        first_name: sub,
        status: "active",
        external_identifier: sub,
      }),
    });
    subToUuid[sub] = created.id;
    console.log(`[create] directus user ${created.id} for sub ${sub} (email ${placeholderEmail(sub)}, external_identifier=${sub})`);
  }

  // Convert memberships.user.
  for (const m of memberships) {
    if (m.user && subToUuid[m.user] && m.user !== subToUuid[m.user]) {
      await api(`/items/memberships/${m.id}`, { method: "PATCH", body: JSON.stringify({ user: subToUuid[m.user] }) });
      console.log(`[membership] ${m.id} (ws=${m.workspace}, role=${m.role}) user ${m.user} -> ${subToUuid[m.user]}`);
    }
  }

  // Convert platform_roles.user.
  for (const p of platformRoles) {
    if (p.user && subToUuid[p.user] && p.user !== subToUuid[p.user]) {
      await api(`/items/platform_roles/${p.id}`, { method: "PATCH", body: JSON.stringify({ user: subToUuid[p.user] }) });
      console.log(`[platform_role] ${p.id} (${p.role}) user ${p.user} -> ${subToUuid[p.user]}`);
    }
  }

  console.log("\nMigration applied. Mapping:");
  for (const [sub, uuid] of Object.entries(subToUuid)) console.log(`  ${sub}  ->  ${uuid}`);
}

async function rollback(file) {
  const target = file ?? latestSnapshot();
  if (!target || !existsSync(target)) {
    console.error("No snapshot found. Pass a snapshot file: rollback <scripts/backups/identity-snapshot-....json>");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(target, "utf8"));
  console.log(`Rolling back from: ${target} (taken ${data.takenAt})`);

  const users = await getUsers();
  const currentMemberships = await getMemberships();
  const currentPlatformRoles = await getPlatformRoles();

  // Restore memberships.user from snapshot.
  const byId = new Map(data.memberships.map((m) => [m.id, m]));
  for (const m of currentMemberships) {
    const orig = byId.get(m.id);
    if (orig && orig.user !== m.user) {
      await api(`/items/memberships/${m.id}`, { method: "PATCH", body: JSON.stringify({ user: orig.user }) });
      console.log(`[membership] ${m.id} user -> ${orig.user}`);
    }
  }

  // Restore platform_roles.user from snapshot.
  const proleById = new Map(data.platform_roles.map((p) => [p.id, p]));
  for (const p of currentPlatformRoles) {
    const orig = proleById.get(p.id);
    if (orig && orig.user !== p.user) {
      await api(`/items/platform_roles/${p.id}`, { method: "PATCH", body: JSON.stringify({ user: orig.user }) });
      console.log(`[platform_role] ${p.id} user -> ${orig.user}`);
    }
  }

  // Restore external_identifier on users and delete any users created by apply.
  const snapshotUserById = new Map(data.directus_users.map((u) => [u.id, u]));
  for (const u of users) {
    const orig = snapshotUserById.get(u.id);
    if (!orig) {
      // User did not exist at snapshot time -> created by apply -> remove.
      try {
        await api(`/users/${u.id}`, { method: "DELETE" });
        console.log(`[delete user] ${u.id} (${u.email}) — created during migration`);
      } catch (e) {
        console.warn(`  ! could not delete user ${u.id}: ${e.message}`);
      }
      continue;
    }
    if (orig.external_identifier !== u.external_identifier) {
      await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ external_identifier: orig.external_identifier }) });
      console.log(`[user] ${u.id} external_identifier -> ${orig.external_identifier}`);
    }
    if (orig.role !== u.role) {
      await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role: orig.role }) });
      console.log(`[user] ${u.id} role -> ${orig.role ?? "null"}`);
    }
  }

  console.log("Rollback complete.");
}

const cmd = process.argv[2];
try {
  if (cmd === "snapshot") await snapshot();
  else if (cmd === "apply") await apply();
  else if (cmd === "rollback") await rollback(process.argv[3]);
  else {
    console.log("Usage: node scripts/directus-identity-migration.mjs <snapshot|apply|rollback>");
    process.exit(1);
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
