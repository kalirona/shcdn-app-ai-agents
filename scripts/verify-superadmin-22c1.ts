/**
 * Phase 22C.1 verification — Super Admin account assignment check.
 * Read-only. Verifies the existing repository functions against the live
 * Directus backend after assigning super_admin to preetkalirona@gmail.com.
 *
 * Run:
 *   $env:DIRECTUS_URL="https://vip.sitenexai.com"; $env:DIRECTUS_TOKEN="<token>"
 *   npx tsx scripts/verify-superadmin-22c1.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
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

process.env.DIRECTUS_URL = process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "";
process.env.DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!process.env.DIRECTUS_URL || !process.env.DIRECTUS_TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

import { getPlatformRole, isSuperAdmin, getAllPlatformRoles } from "../src/lib/db/repositories/platform-role.repo";
import { hasPlatformPermission } from "../src/lib/auth/roles";
import { getWorkspaceMembers, getUserRole } from "../src/lib/db/repositories/membership.repo";
import { getAllWorkspaces } from "../src/lib/db/repositories/workspace.repo";

// Real identity model: platform_roles.user stores the Logto claims.sub.
const SUPER_ADMIN_SUB = "db1bw2sol1yo"; // preetkalirona@gmail.com in Logto
const DIRECTUS_UUID = "3d3dfafb-f7e9-431a-82bf-9af0e820b5af"; // must NOT grant access

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label}`);
  }
}

async function main() {
  console.log("=== Phase 22C.1 Super Admin verification ===\n");

  console.log("-- Task 3: existing repository functions (queried by Logto sub) --");
  const role = await getPlatformRole(SUPER_ADMIN_SUB);
  assert(role !== null, "getPlatformRole() returns the assigned role");
  assert(role?.role === "super_admin", "role.role === super_admin");
  assert(role?.status === "active", "role.status === active");

  const isSuper = await isSuperAdmin(SUPER_ADMIN_SUB);
  assert(isSuper === true, "isSuperAdmin(Logto sub) === true");

  const all = await getAllPlatformRoles();
  assert(Array.isArray(all), "getAllPlatformRoles() returns array");
  assert(all.length === 1, `exactly ONE super admin assigned (got ${all.length})`);

  console.log("\n-- Task 5: platform permission access (workspace roles excluded) --");
  // The requirePlatformAccess() guard is built from isSuperAdmin + hasPlatformPermission;
  // direct import under tsx is blocked by @logto/next/server-actions, so we verify the
  // two primitives the guard uses, for each permission the admin UI relies on.
  const perms = [
    "platform:users:read",
    "platform:workspaces:read",
    "platform:billing:read",
    "platform:audit:read",
  ] as const;
  for (const perm of perms) {
    const ok = (await isSuper) && hasPlatformPermission("super_admin", perm);
    assert(ok === true, `getPlatformAccess-equivalent (${perm}) succeeds`);
  }

  console.log("\n-- Task 6: workspace roles stay separate --");
  const workspaces = await getAllWorkspaces();
  let membersChecked = 0;
  for (const ws of workspaces) {
    const members = await getWorkspaceMembers(ws.id);
    for (const m of members) {
      if (m.user === SUPER_ADMIN_SUB) continue; // skip the designated super admin
      const isSa = await isSuperAdmin(m.user);
      if (isSa) {
        assert(false, `non-super-admin user ${m.user} (role ${m.role}) is unexpectedly super admin`);
      }
      membersChecked += 1;
    }
  }
  console.log(`  (checked all ${membersChecked} workspace members are NOT super admins unless designated)`);

  // Owner / manager / agent of any workspace must NOT be super admin via role alone.
  console.log("\n-- Phase 22C.1-B negative cases --");
  const members = workspaces.length > 0 ? await getWorkspaceMembers(workspaces[0].id) : [];
  for (const m of members) {
    if (m.user === SUPER_ADMIN_SUB) continue;
    const isSa = await isSuperAdmin(m.user);
    assert(isSa === false, `owner/manager/agent ${m.role} (${m.user}) without platform_roles is DENIED (super admin = false)`);
  }
  if (members.length === 0) {
    console.log("  (no non-super-admin workspace members to cross-check)");
  }

  const directusUuidFallback = await isSuperAdmin(DIRECTUS_UUID);
  assert(
    directusUuidFallback === false,
    "incorrect Directus UUID is DENIED (isSuperAdmin(DirectusUUID) === false)",
  );
  const unknownSub = await isSuperAdmin("nonexistent-logto-sub");
  assert(unknownSub === false, "unknown Logto sub is DENIED (isSuperAdmin(unknown) === false)");
  const deletedSub = await isSuperAdmin("3d3dfafb-f7e9-431a-82bf-9af0e820b5af");
  void deletedSub;

  console.log("\n=== RESULTS: ");
  if (failures === 0) {
    console.log("ALL CHECKS PASSED");
    process.exit(0);
  } else {
    console.log(`${failures} FAILURE(S)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});