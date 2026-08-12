/**
 * Platform-level Super Admin authorization test (Phase 22A).
 *
 * Tests the new platform authorization layer:
 * - Super Admin -> platform access allowed
 * - Owner only -> platform access denied
 * - Manager only -> platform access denied
 * - Agent only -> platform access denied
 * - Workspace membership cannot grant platform access
 * - Super Admin can still use normal workspace authorization
 * - Existing workspace isolation tests remain unchanged
 *
 * Usage:
 *   $env:DIRECTUS_URL="https://your-directus"; $env:DIRECTUS_TOKEN="your-token"
 *   npx tsx scripts/test-platform-access.ts
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

// Set env before importing modules that read at load time
process.env.DIRECTUS_URL = process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "";
process.env.DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!process.env.DIRECTUS_URL || !process.env.DIRECTUS_TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

// Import after env is set
import { checkWorkspaceAccess } from "../src/lib/auth/access-core";
import { PERMISSIONS, PLATFORM_PERMISSIONS, hasPlatformPermission, PLATFORM_ROLES } from "../src/lib/auth/roles";
import { db } from "../src/lib/db/client";
import { createWorkspaceWithOwner } from "../src/lib/db/repositories/workspace.repo";
import { createPlatformRole, isSuperAdmin, deletePlatformRole, getPlatformRole } from "../src/lib/db/repositories/platform-role.repo";

let failures = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label}`);
  }
}

async function expectDenied(promise: Promise<unknown>, label: string) {
  try {
    await promise;
    failures += 1;
    console.log(`  FAIL: ${label} (access was NOT denied)`);
  } catch {
    console.log(`  PASS: ${label} (denied)`);
  }
}

const created: { workspaces: string[]; memberships: string[]; platformRoles: string[] } = {
  workspaces: [],
  memberships: [],
  platformRoles: [],
};

async function cleanup() {
  console.log("\n-- Cleanup --");
  for (const wsId of created.workspaces) {
    try {
      await db.workspace.delete(wsId);
      console.log(`  removed workspace ${wsId}`);
    } catch {
      // ignore
    }
  }
  for (const userId of created.platformRoles) {
    try {
      await deletePlatformRole(userId);
      console.log(`  removed platform role for user ${userId}`);
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("=== Platform Authorization Test (Phase 22A) ===\n");

  // Create test users by creating workspaces with owners
  console.log("-- Setup: Create test users (User A, User B, User C, User D) --");
  const userA = await createWorkspaceWithOwner({
    name: "Test User A Workspace",
    slug: "test-user-a-ws",
    ownerId: "test-user-a-platform",
    ownerEmail: "test-user-a-platform@example.com",
    ownerName: "Test User A",
  });
  created.workspaces.push(userA.id);
  const userAId = "test-user-a-platform";

  const userB = await createWorkspaceWithOwner({
    name: "Test User B Workspace",
    slug: "test-user-b-ws",
    ownerId: "test-user-b-platform",
    ownerEmail: "test-user-b-platform@example.com",
    ownerName: "Test User B",
  });
  created.workspaces.push(userB.id);
  const userBId = "test-user-b-platform";

  const userC = await createWorkspaceWithOwner({
    name: "Test User C Workspace",
    slug: "test-user-c-ws",
    ownerId: "test-user-c-platform",
    ownerEmail: "test-user-c-platform@example.com",
    ownerName: "Test User C",
  });
  created.workspaces.push(userC.id);
  const userCId = "test-user-c-platform";

  const userD = await createWorkspaceWithOwner({
    name: "Test User D Workspace",
    slug: "test-user-d-ws",
    ownerId: "test-user-d-platform",
    ownerEmail: "test-user-d-platform@example.com",
    ownerName: "Test User D",
  });
  created.workspaces.push(userD.id);
  const userDId = "test-user-d-platform";

  // Add User B as Admin (Manager) to User A's workspace
  const membershipB = await db.membership.create({
    workspace: userA.id,
    user: userBId,
    role: "admin",
    status: "active",
    email: "test-user-b-platform@example.com",
    name: "Test User B",
  });
  created.memberships.push(membershipB.id);

  // Add User C as Member (Agent) to User A's workspace
  const membershipC = await db.membership.create({
    workspace: userA.id,
    user: userCId,
    role: "member",
    status: "active",
    email: "test-user-c-platform@example.com",
    name: "Test User C",
  });
  created.memberships.push(membershipC.id);

  console.log(`  User A (Owner of Workspace A): ${userAId}`);
  console.log(`  User B (Admin in Workspace A):   ${userBId}`);
  console.log(`  User C (Member in Workspace A):  ${userCId}`);
  console.log(`  User D (no membership):          ${userDId}`);

  // Grant Super Admin to User A
  console.log("\n-- Grant Super Admin to User A --");
  await createPlatformRole(userAId);
  created.platformRoles.push(userAId);
  const isSuperA = await isSuperAdmin(userAId);
  assert(isSuperA === true, "User A is Super Admin after assignment");

  // Verify others are NOT Super Admin
  assert((await isSuperAdmin(userBId)) === false, "User B is NOT Super Admin");
  assert((await isSuperAdmin(userCId)) === false, "User C is NOT Super Admin");
  assert((await isSuperAdmin(userDId)) === false, "User D is NOT Super Admin");

  // Test platform role permission matrix
  console.log("\n-- Platform Role Permission Matrix --");
  assert(hasPlatformPermission("super_admin", "platform:users:read") === true, "Super Admin has PLATFORM_USERS_READ");
  assert(hasPlatformPermission("super_admin", "platform:users:manage") === true, "Super Admin has PLATFORM_USERS_MANAGE");
  assert(hasPlatformPermission("super_admin", "platform:workspaces:read") === true, "Super Admin has PLATFORM_WORKSPACES_READ");
  assert(hasPlatformPermission("super_admin", "platform:workspaces:manage") === true, "Super Admin has PLATFORM_WORKSPACES_MANAGE");
  assert(hasPlatformPermission("super_admin", "platform:billing:read") === true, "Super Admin has PLATFORM_BILLING_READ");
  assert(hasPlatformPermission("super_admin", "platform:billing:manage") === true, "Super Admin has PLATFORM_BILLING_MANAGE");
  assert(hasPlatformPermission("super_admin", "platform:audit:read") === true, "Super Admin has PLATFORM_AUDIT_READ");
  assert(hasPlatformPermission("super_admin", "platform:settings:manage") === true, "Super Admin has PLATFORM_SETTINGS_MANAGE");

  // Test that workspace roles do NOT have platform permissions
  assert(hasPlatformPermission("owner" as any, "platform:users:read") === false, "Owner does NOT have platform permissions");
  assert(hasPlatformPermission("admin" as any, "platform:users:read") === false, "Admin does NOT have platform permissions");
  assert(hasPlatformPermission("member" as any, "platform:users:read") === false, "Member does NOT have platform permissions");

  // Test isSuperAdmin for each user
  console.log("\n-- isSuperAdmin checks --");
  assert(await isSuperAdmin(userAId) === true, "isSuperAdmin returns true for Super Admin user");
  assert(await isSuperAdmin(userBId) === false, "isSuperAdmin returns false for Owner-only user");
  assert(await isSuperAdmin(userCId) === false, "isSuperAdmin returns false for Admin-only user");
  assert(await isSuperAdmin(userDId) === false, "isSuperAdmin returns false for Member-only user");

  // Test getPlatformRole returns correct data
  console.log("\n-- getPlatformRole --");
  const roleA = await getPlatformRole(userAId);
  assert(roleA !== null && roleA?.role === "super_admin" && roleA?.status === "active", "getPlatformRole returns super_admin for User A");
  assert(await getPlatformRole(userBId) === null, "getPlatformRole returns null for non-Super Admin user");

  // Test that Super Admin still has workspace authorization
  console.log("\n-- Super Admin retains workspace authorization --");
  try {
    await checkWorkspaceAccess(userAId, userA.id, PERMISSIONS.BILLING_MANAGE);
    console.log("  PASS: Super Admin (User A) still has BILLING_MANAGE in own workspace");
  } catch {
    failures += 1;
    console.log("  FAIL: Super Admin lost workspace authorization");
  }

  // Test that workspace membership does NOT grant platform access
  console.log("\n-- Workspace membership does not grant platform access --");
  // User B is Admin in Workspace A but NOT Super Admin
  // User C is Member in Workspace A but NOT Super Admin
  // Both should be denied platform access via isSuperAdmin check
  assert((await isSuperAdmin(userBId)) === false, "Admin in workspace is NOT Super Admin");
  assert((await isSuperAdmin(userCId)) === false, "Member in workspace is NOT Super Admin");

  // Test all platform permissions defined
  console.log("\n-- All platform permissions defined --");
  const platformPerms = [
    "platform:users:read",
    "platform:users:manage",
    "platform:workspaces:read",
    "platform:workspaces:manage",
    "platform:billing:read",
    "platform:billing:manage",
    "platform:audit:read",
    "platform:settings:manage",
  ] as const;

  for (const perm of platformPerms) {
    assert(hasPlatformPermission("super_admin", perm as any) === true, `Super Admin has ${perm}`);
  }

  // Cleanup
  await cleanup();

  console.log(`\n=== RESULTS: ${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`} ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Test error:", err);
  await cleanup();
  process.exit(1);
});