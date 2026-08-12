/**
 * Production-style ownership/isolation test.
 *
 * Runs the REAL row-level security code (checkWorkspaceAccess ->
 * getUserRole -> db.membership) against the live Directus backend with two
 * distinct identities, exercising the exact server-action authorization
 * path (minus the Logto session resolution, which checkWorkspaceAccess
 * intentionally excludes).
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts-tests.json scripts/test-owner-access.ts
 *
 * Requires DIRECTUS_URL + DIRECTUS_TOKEN (from .env.local or env).
 */
import fs from "node:fs";
import path from "node:path";

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

const fileEnv = loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// The repos read these at module load; set them before the imports below.
process.env.DIRECTUS_URL = process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "";
process.env.DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!process.env.DIRECTUS_URL || !process.env.DIRECTUS_TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

// These are resolved by the ts-node loader (CJS output preserves order).
import { checkWorkspaceAccess } from "../src/lib/auth/access-core";
import { PERMISSIONS } from "../src/lib/auth/roles";
import { db } from "../src/lib/db/client";
import { createAgent, getAgentById, getWorkspaceAgents } from "../src/lib/db/repositories/agent.repo";
import { createLead } from "../src/lib/db/repositories/lead.repo";
import { getWorkspaceMembers } from "../src/lib/db/repositories/membership.repo";
import { createWorkspaceWithOwner } from "../src/lib/db/repositories/workspace.repo";

let failures = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label}`);
  }
}

async function expectInaccessible(promise: Promise<unknown>, label: string) {
  try {
    await promise;
    failures += 1;
    console.log(`  FAIL: ${label} (access was NOT denied)`);
  } catch {
    console.log(`  PASS: ${label} (denied)`);
  }
}

const created: { workspaces: string[]; memberships: string[]; agents: string[]; leads: string[] } = {
  workspaces: [],
  memberships: [],
  agents: [],
  leads: [],
};

async function main() {
  console.log("=== Production Ownership Test (real server-action code) ===\n");

  // 1. Two independent organizations, each with a unique owner
  console.log("-- Setup: Org A (userA) and Org B (userB) --");
  const ts = Date.now();
  const userA = `owner-a-${ts}@example.com`;
  const userB = `owner-b-${ts}@example.com`;

  const orgA = await createWorkspaceWithOwner({
    name: `Org A (${ts})`,
    slug: `org-a-${ts}`,
    ownerId: userA,
    ownerEmail: userA,
    ownerName: "User A",
  });
  created.workspaces.push(orgA.id);

  const orgB = await createWorkspaceWithOwner({
    name: `Org B (${ts})`,
    slug: `org-b-${ts}`,
    ownerId: userB,
    ownerEmail: userB,
    ownerName: "User B",
  });
  created.workspaces.push(orgB.id);

  console.log("  Org A:", orgA.id);
  console.log("  Org B:", orgB.id);

  // 2. Each workspace has exactly the correct Owner membership
  console.log("\n-- Owner membership --");
  const membersA = await getWorkspaceMembers(orgA.id);
  const membersB = await getWorkspaceMembers(orgB.id);
  created.memberships.push(...membersA.map((m) => m.id), ...membersB.map((m) => m.id));

  assert(
    membersA.length === 1 && membersA[0].user === userA && membersA[0].role === "owner",
    "Org A has exactly one member: userA as owner",
  );
  assert(
    membersB.length === 1 && membersB[0].user === userB && membersB[0].role === "owner",
    "Org B has exactly one member: userB as owner",
  );
  assert(
    membersA[0].name === "User A" && membersB[0].name === "User B",
    "each workspace's owner shows their own identity (User A / User B)",
  );

  // 3. Each user can access their own workspace with owner permissions
  console.log("\n-- Own-workspace access --");
  const accessA = await checkWorkspaceAccess(userA, orgA.id, PERMISSIONS.AGENTS_CREATE);
  assert(accessA.role === "owner" && accessA.workspaceId === orgA.id, "userA can access Org A with owner rights");
  const accessB = await checkWorkspaceAccess(userB, orgB.id, PERMISSIONS.AGENTS_CREATE);
  assert(accessB.role === "owner" && accessB.workspaceId === orgB.id, "userB can access Org B with owner rights");

  // 4. Cross-tenant access is denied (the "change an ID" attack)
  console.log("\n-- Cross-tenant denial (by changing the ID) --");
  await expectInaccessible(
    checkWorkspaceAccess(userA, orgB.id, PERMISSIONS.AGENTS_READ),
    "userA cannot read Org B by passing Org B's workspace ID",
  );
  await expectInaccessible(
    checkWorkspaceAccess(userA, orgB.id, PERMISSIONS.AGENTS_CREATE),
    "userA cannot write Org B by ID",
  );
  await expectInaccessible(
    checkWorkspaceAccess(userB, orgA.id, PERMISSIONS.AGENTS_READ),
    "userB cannot read Org A by ID",
  );
  await expectInaccessible(
    checkWorkspaceAccess(userB, orgA.id, PERMISSIONS.AGENTS_CREATE),
    "userB cannot write Org A by ID",
  );

  // 5. Each user sees only their own data through the real repo + gate
  console.log("\n-- Data visibility per user --");
  const agentA = await createAgent({ workspace: orgA.id, name: "Agent A", systemPrompt: "prompt A" });
  created.agents.push(agentA.id);
  const agentB = await createAgent({ workspace: orgB.id, name: "Agent B", systemPrompt: "prompt B" });
  created.agents.push(agentB.id);
  const agentsOfA = (await getWorkspaceAgents(orgA.id)).map((a) => a.id);
  const agentsOfB = (await getWorkspaceAgents(orgB.id)).map((a) => a.id);
  assert(agentsOfA.includes(agentA.id) && !agentsOfA.includes(agentB.id), "userA's agents query returns Agent A only");
  assert(agentsOfB.includes(agentB.id) && !agentsOfB.includes(agentA.id), "userB's agents query returns Agent B only");

  // 6. Fetching a cross-tenant row by ID is blocked by the gate
  console.log("\n-- Row-level gate on direct-ID fetch --");
  const fetchedAgentB = await getAgentById(agentB.id);
  assert(fetchedAgentB !== null, "raw row Agent B exists (getAgentById, ungated)");
  if (fetchedAgentB) {
    await expectInaccessible(
      checkWorkspaceAccess(userA, fetchedAgentB.workspace, PERMISSIONS.AGENTS_READ),
      "userA is denied reading Agent B even if they obtain its ID",
    );
  }

  // 7. Role permission matrix applies through the gate
  console.log("\n-- Permission matrix --");
  const memberC = `member-c-${ts}@example.com`;
  const membershipC = await db.membership.create({
    workspace: orgA.id,
    user: memberC,
    role: "member",
    email: memberC,
    name: "Member C",
    status: "active",
  });
  created.memberships.push(membershipC.id);

  // Agent role: members can read leads but NOT create agents
  const leadA = await createLead({
    workspace: orgA.id,
    name: "Lead A",
    email: `lead-a-${ts}@example.com`,
  });
  created.leads.push(leadA.id);
  const readable = await checkWorkspaceAccess(memberC, orgA.id, PERMISSIONS.LEADS_READ);
  assert(readable.role === "member", "memberC (Agent role) can read leads in Org A");
  await expectInaccessible(
    checkWorkspaceAccess(memberC, orgA.id, PERMISSIONS.AGENTS_CREATE),
    "memberC (Agent role) cannot create agents in Org A",
  );

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  return failures === 0;
}

async function cleanup() {
  console.log("\n-- Cleanup --");
  for (const collection of ["agents", "leads", "memberships", "workspaces"]) {
    for (const id of created[collection as keyof typeof created]) {
      try {
        if (collection === "agents") await db.agent.delete(id);
        if (collection === "leads") await db.lead.delete(id);
        if (collection === "memberships") await db.membership.delete(id);
        if (collection === "workspaces") await db.workspace.delete(id);
      } catch {
        // already gone
      }
    }
  }
  console.log("  removed test data");
}

async function run() {
  try {
    const ok = await main();
    await cleanup();
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error("\nERROR:", error instanceof Error ? error.message : error);
    await cleanup();
    process.exit(1);
  }
}

void run();
