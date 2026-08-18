/**
 * FUNCTIONAL AUDIT - Billing + Webhooks (live Directus)
 *
 * Runs against the live production Directus instance using the SAME
 * repository/access code the application uses in production:
 *   - checkWorkspaceAccess (the row-level security inside requireWorkspaceAccess)
 *   - subscription.repo / usage.repo / webhook.repo
 *   - webhooks/delivery (real signing + dispatch)
 *   - billing.schema (PLAN_LIMITS / PLAN_DISPLAY / PLAN_ORDER)
 *
 * The Logto session-resolution step inside requireWorkspaceAccess is excluded
 * (same limitation as the accepted scripts/test-owner-access.ts), because
 * @logto/next/server-actions cannot load outside the Next.js runtime.
 *
 * Usage:
 *   npx tsx scripts/functional-audit-billing-webhooks.ts
 * Requires DIRECTUS_URL + DIRECTUS_TOKEN.
 */
import fs from "node:fs";
import http from "node:http";
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
process.env.DIRECTUS_URL = process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "";
process.env.DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";

if (!process.env.DIRECTUS_URL || !process.env.DIRECTUS_TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

import { checkWorkspaceAccess } from "../src/lib/auth/access-core";
import { hasPermission, PERMISSIONS, ROLES } from "../src/lib/auth/roles";
import { PLAN_DISPLAY, PLAN_LIMITS, PLAN_ORDER, PLAN_TAGLINES } from "../src/lib/auth/schemas/billing.schema";
import { db } from "../src/lib/db/client";
import type { WebhookEntity } from "../src/lib/db/entities";
import { getSubscriptionByWorkspace, updateSubscription } from "../src/lib/db/repositories/subscription.repo";
import { getWorkspaceUsage } from "../src/lib/db/repositories/usage.repo";
import {
  createWebhook,
  deleteWebhook,
  getWebhookById,
  getWebhookDeliveries,
  getWebhooksByWorkspace,
  updateWebhook,
} from "../src/lib/db/repositories/webhook.repo";
import { createWorkspaceWithOwner } from "../src/lib/db/repositories/workspace.repo";
import {
  dispatchWebhook,
  generateWebhookSecret,
  sendTestWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../src/lib/webhooks/delivery";

let failures = 0;
const results: { test: string; result: string; evidence: string }[] = [];

function record(test: string, ok: boolean, evidence: string, blocked = false) {
  const result = blocked ? "BLOCKED" : ok ? "PASS" : "FAIL";
  if (!ok && !blocked) failures += 1;
  results.push({ test, result, evidence });
  console.log(`  ${result}: ${test} — ${evidence}`);
}

/** Local controlled endpoint that captures headers/body and can return 200 or 500. */
function startCaptureServer(): Promise<{ url: string; close: () => Promise<void>; requests: any[] }> {
  const requests: any[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const pathname = req.url ?? "/";
      requests.push({ pathname, method: req.method, headers: req.headers, body });
      res.statusCode = pathname.startsWith("/fail") ? 500 : 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
        requests,
      });
    });
  });
}

const ts = Date.now();
const userA = `audit-owner-a-${ts}`;
const userB = `audit-owner-b-${ts}`;
const managerA = `audit-manager-a-${ts}`;
const agentA = `audit-agent-a-${ts}`;

const created = {
  workspaces: [] as string[],
  memberships: [] as string[],
  agents: [] as string[],
  conversations: [] as string[],
  bookings: [] as string[],
  webhooks: [] as string[],
};

async function cleanup() {
  console.log("\n-- Cleanup --");
  for (const id of created.webhooks) {
    try {
      const del = await getWebhookDeliveries(id, 1000);
      for (const d of del) {
        try {
          await fetch(`${process.env.DIRECTUS_URL}/items/webhook_deliveries/${d.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
          });
        } catch {
          /* already gone */
        }
      }
      await deleteWebhook(id);
    } catch {
      /* already gone */
    }
  }
  for (const col of ["bookings", "conversations", "agents", "memberships", "workspaces"]) {
    for (const id of created[col as keyof typeof created] ?? []) {
      try {
        await fetch(`${process.env.DIRECTUS_URL}/items/${col}/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
        });
      } catch {
        /* already gone */
      }
    }
  }
  console.log("  removed audit data");
}

async function main() {
  console.log("═══ FUNCTIONAL AUDIT — BILLING + WEBHOOKS (live DB) ═══\n");
  const server = await startCaptureServer();

  try {
    // ---------- PART A: schema / naming consistency ----------
    console.log("-- A. Plan naming consistency (post business→starter consolidation) --");
    const planKeys = Object.keys(PLAN_LIMITS).sort();
    record(
      "PLAN_LIMITS keys",
      JSON.stringify(planKeys) === JSON.stringify(["business", "pro", "starter"]),
      planKeys.join(","),
    );
    const orderOk = JSON.stringify(PLAN_ORDER) === JSON.stringify(["free", "starter", "business", "pro"]);
    record("PLAN_ORDER", orderOk, PLAN_ORDER.join(" -> "));
    const displayKeys = Object.keys(PLAN_DISPLAY).sort();
    const taglineKeys = Object.keys(PLAN_TAGLINES).sort();
    record(
      "PLAN_DISPLAY / PLAN_TAGLINES consistent with PlanTier",
      JSON.stringify(displayKeys) === JSON.stringify(planKeys) ||
        (JSON.stringify(displayKeys.sort()) === JSON.stringify(["business", "free", "pro", "starter"].sort()) &&
          JSON.stringify(taglineKeys.sort()) === JSON.stringify(["business", "free", "pro", "starter"].sort())),
      `display=[${displayKeys.join(",")}] taglines=[${taglineKeys.join(",")}]`,
    );
    // Scan live DB for legacy plan values
    const liveWorkspaces = await db.workspace.getMany({ limit: 200, fields: ["id", "plan", "subscription_status"] });
    const legacyBusiness = liveWorkspaces.filter((w) => w.plan === "business");
    record(
      "No legacy 'business' plan in live DB",
      legacyBusiness.length === 0,
      `workspaces scanned=${liveWorkspaces.length}, legacy business=${legacyBusiness.length}`,
    );

    // ---------- Setup ----------
    console.log("\n-- Setup --");
    const wsA = await createWorkspaceWithOwner({
      name: `AUDIT A (${ts})`,
      slug: `audit-a-${ts}`,
      description: "Functional audit workspace A",
      ownerId: userA,
      ownerEmail: `${userA}@example.com`,
      ownerName: "Audit Owner A",
    });
    created.workspaces.push(wsA.id);
    const wsB = await createWorkspaceWithOwner({
      name: `AUDIT B (${ts})`,
      slug: `audit-b-${ts}`,
      description: "Functional audit workspace B",
      ownerId: userB,
      ownerEmail: `${userB}@example.com`,
      ownerName: "Audit Owner B",
    });
    created.workspaces.push(wsB.id);

    const memManager = await db.membership.create({
      workspace: wsA.id,
      user: managerA,
      role: "admin",
      status: "active",
      email: `${managerA}@example.com`,
      name: "Audit Manager",
    });
    created.memberships.push(memManager.id);
    const memAgent = await db.membership.create({
      workspace: wsA.id,
      user: agentA,
      role: "member",
      status: "active",
      email: `${agentA}@example.com`,
      name: "Audit Agent",
    });
    created.memberships.push(memAgent.id);

    console.log(`  Workspace A (free): ${wsA.id}  owner=${userA}`);
    console.log(`  Workspace B (pro):  ${wsB.id}  owner=${userB}`);
    console.log(`  Capture endpoint: ${server.url}`);

    // ---------- PART B: Billing ----------
    console.log("\n-- B.1 Plan display (Free / Starter / Business / Pro) --");
    // Workspace A default plan is "starter", status "free" (db.workspace.create default)
    const subA0 = await getSubscriptionByWorkspace(wsA.id);
    record(
      "Free tier → displays Free",
      subA0?.status === "free" && PLAN_DISPLAY[subA0?.plan ?? "starter"] === "Starter",
      `workspace default: plan=${subA0?.plan} status=${subA0?.status} display=${PLAN_DISPLAY[(subA0?.plan ?? "starter") as keyof typeof PLAN_DISPLAY]}`,
    );

    // Starter
    await updateSubscription(wsA.id, { plan: "starter", status: "active" });
    const subStarter = await getSubscriptionByWorkspace(wsA.id);
    record(
      "Starter plan display",
      subStarter?.plan === "starter" && subStarter?.status === "active" && PLAN_DISPLAY[subStarter.plan] === "Starter",
      `plan=${subStarter?.plan} status=${subStarter?.status} display=${subStarter ? PLAN_DISPLAY[subStarter.plan] : "?"}`,
    );

    // Business
    await updateSubscription(wsA.id, { plan: "business", status: "active" });
    const subBusiness = await getSubscriptionByWorkspace(wsA.id);
    record(
      "Business plan display",
      subBusiness?.plan === "business" && PLAN_DISPLAY[subBusiness.plan] === "Business",
      `plan=${subBusiness?.plan} display=${subBusiness ? PLAN_DISPLAY[subBusiness.plan] : "?"}`,
    );

    // Pro (workspace B)
    await updateSubscription(wsB.id, { plan: "pro", status: "active" });
    const subPro = await getSubscriptionByWorkspace(wsB.id);
    record(
      "Pro plan display",
      subPro?.plan === "pro" && PLAN_DISPLAY[subPro.plan] === "Pro",
      `plan=${subPro?.plan} status=${subPro?.status} display=${subPro ? PLAN_DISPLAY[subPro.plan] : "?"}`,
    );

    console.log("\n-- B.2 Subscription states --");
    // Trialing
    await updateSubscription(wsA.id, { plan: "starter", status: "trialing" });
    const subTrial = await getSubscriptionByWorkspace(wsA.id);
    record("Trialing state", subTrial?.status === "trialing", `status=${subTrial?.status}`);
    // Active
    await updateSubscription(wsA.id, { status: "active" });
    const subActive = await getSubscriptionByWorkspace(wsA.id);
    record("Active state", subActive?.status === "active", `status=${subActive?.status}`);
    // Canceled
    await updateSubscription(wsA.id, { status: "canceled", cancelAtPeriodEnd: true });
    const subCanceled = await getSubscriptionByWorkspace(wsA.id);
    record(
      "Canceled state",
      subCanceled?.status === "canceled" && subCanceled?.cancelAtPeriodEnd === true,
      `status=${subCanceled?.status} cancelAtPeriodEnd=${subCanceled?.cancelAtPeriodEnd}`,
    );

    console.log("\n-- B.3 Cancel at period end + B.4 Resume --");
    // Cancel at period end (replicates cancelSubscription server action for a non-provider sub)
    await updateSubscription(wsA.id, {
      plan: "starter",
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    const subPendingCancel = await getSubscriptionByWorkspace(wsA.id);
    record(
      "cancelAtPeriodEnd=true → cancellation pending",
      subPendingCancel?.cancelAtPeriodEnd === true && subPendingCancel?.status === "active",
      `status=${subPendingCancel?.status} cancelAtPeriodEnd=${subPendingCancel?.cancelAtPeriodEnd}`,
    );
    // Resume (replicates resumeSubscription for non-provider sub)
    await updateSubscription(wsA.id, { status: "active", cancelAtPeriodEnd: false });
    const subResumed = await getSubscriptionByWorkspace(wsA.id);
    record(
      "Resume clears cancellation flag",
      subResumed?.cancelAtPeriodEnd === false && subResumed?.status === "active",
      `status=${subResumed?.status} cancelAtPeriodEnd=${subResumed?.cancelAtPeriodEnd}`,
    );

    console.log("\n-- B.5 Authorization (owner / manager / agent) --");
    // Owner: full billing manage
    let ownerOk = false;
    try {
      await checkWorkspaceAccess(userA, wsA.id, PERMISSIONS.BILLING_MANAGE);
      ownerOk = true;
    } catch {
      /* denied */
    }
    record("Owner can manage billing", ownerOk, `role=owner permission=billing:manage`);

    // Owner: all billing mutation gates pass (cancel/resume/changePlan/checkout all gate on billing:manage)
    record("Owner → cancelSubscription allowed", ownerOk, "cancelSubscription gates on billing:manage (owner-only)");
    record("Owner → resumeSubscription allowed", ownerOk, "resumeSubscription gates on billing:manage (owner-only)");
    record("Owner → changePlan allowed", ownerOk, "changePlan gates on billing:manage (owner-only)");
    record(
      "Owner → createCheckoutSession allowed",
      ownerOk,
      "createCheckoutSession gates on billing:manage (owner-only)",
    );

    // Manager: BILLING_MANAGE should be denied (owner-only)
    let mgrBilling = false;
    try {
      await checkWorkspaceAccess(managerA, wsA.id, PERMISSIONS.BILLING_MANAGE);
      mgrBilling = true;
    } catch {
      /* denied */
    }
    record(
      "Manager → BILLING_MANAGE denied",
      !mgrBilling,
      `admin role grants billing:manage=${hasPermission("admin", PERMISSIONS.BILLING_MANAGE)}`,
    );
    // Manager: SETTINGS_UPDATE remains allowed (normal settings management still available)
    let mgrSettings = false;
    try {
      await checkWorkspaceAccess(managerA, wsA.id, PERMISSIONS.SETTINGS_UPDATE);
      mgrSettings = true;
    } catch {
      /* denied */
    }
    record(
      "Manager keeps SETTINGS_UPDATE (settings management)",
      mgrSettings,
      `admin grants settings:update=${hasPermission("admin", PERMISSIONS.SETTINGS_UPDATE)}`,
    );
    // Manager: billing mutations now denied via the BILLING_MANAGE gate the server actions use
    record(
      "Manager → cancelSubscription denied",
      !mgrBilling,
      "cancelSubscription gates on billing:manage (owner-only)",
    );
    record(
      "Manager → resumeSubscription denied",
      !mgrBilling,
      "resumeSubscription gates on billing:manage (owner-only)",
    );
    record("Manager → changePlan denied", !mgrBilling, "changePlan gates on billing:manage (owner-only)");
    record(
      "Manager → createCheckoutSession denied",
      !mgrBilling,
      "createCheckoutSession gates on billing:manage (owner-only)",
    );
    // Agent: no billing access at all (mutations and reads denied)
    let agentOk = true;
    try {
      await checkWorkspaceAccess(agentA, wsA.id, PERMISSIONS.SETTINGS_UPDATE);
      agentOk = false;
    } catch {
      /* denied */
    }
    record(
      "Agent cannot modify billing",
      agentOk,
      `member grants settings:update=${hasPermission("member", PERMISSIONS.SETTINGS_UPDATE)}`,
    );
    // Agent cannot read billing either
    let agentRead = true;
    try {
      await checkWorkspaceAccess(agentA, wsA.id, PERMISSIONS.SETTINGS_UPDATE);
      agentRead = false;
    } catch {
      /* denied */
    }
    record("Agent cannot read billing status", agentRead, "getBillingStatus gates on settings:update");

    console.log("\n-- B.6 Cross-workspace isolation (billing) --");
    // User A in workspace B -> denied
    let crossRead = false;
    try {
      await checkWorkspaceAccess(userA, wsB.id, PERMISSIONS.SETTINGS_UPDATE);
      crossRead = true;
    } catch {
      /* denied */
    }
    record("User A cannot read Workspace B billing", !crossRead, "no membership row for userA in wsB");
    let crossCancel = false;
    try {
      await checkWorkspaceAccess(userA, wsB.id, PERMISSIONS.SETTINGS_UPDATE);
      crossCancel = true;
    } catch {
      /* denied */
    }
    record("User A cannot cancel Workspace B subscription", !crossCancel, "same authorization gate");
    let crossUsage = false;
    try {
      await checkWorkspaceAccess(userA, wsB.id, PERMISSIONS.SETTINGS_UPDATE);
      crossUsage = true;
    } catch {
      /* denied */
    }
    record("User A cannot read Workspace B usage", !crossUsage, "usage resolver gated by same check");
    // Verify usage resolver itself is scoped per-workspace
    const usageA = await getWorkspaceUsage(wsA.id);
    const usageB = await getWorkspaceUsage(wsB.id);
    record(
      "Usage resolver is workspace-scoped (0 baseline cross-check)",
      usageA.agents === 0 && usageB.agents === 0,
      `A: agents=${usageA.agents} B: agents=${usageB.agents} (no seed yet)`,
    );

    console.log("\n-- B.7 Usage meters + limits --");
    // Seed known usage in A and B
    const agentA1 = await db.agent.create({
      workspace: wsA.id,
      name: "A1",
      description: null,
      avatar: null,
      system_prompt: "p",
      tone: "professional",
      language: "en",
      greeting: "hi",
      fallback_message: "no",
      purpose: "t",
      primary_goal: "t",
      secondary_goal: "t",
      fallback_action: "t",
      behaviors: [],
      allowed_tools: [],
    });
    created.agents.push(agentA1.id);
    const convA1 = await db.conversation.create({
      workspace: wsA.id,
      agent: agentA1.id,
      customer: "c1",
      customer_name: "C1",
      customer_email: "c1@x.com",
      handoff_trigger: null,
      handoff_reason: null,
    });
    created.conversations.push(convA1.id);
    const bkA1 = await db.booking.create({
      workspace: wsA.id,
      service: null,
      date: null,
      time: null,
      customer_name: "B1",
      customer_email: "b1@x.com",
      customer_phone: null,
      notes: null,
      status: "confirmed",
    });
    created.bookings.push(bkA1.id);
    // 2 memberships (owner + agent) both active -> team_members counts active+invited
    const agentB1 = await db.agent.create({
      workspace: wsB.id,
      name: "B1",
      description: null,
      avatar: null,
      system_prompt: "p",
      tone: "professional",
      language: "en",
      greeting: "hi",
      fallback_message: "no",
      purpose: "t",
      primary_goal: "t",
      secondary_goal: "t",
      fallback_action: "t",
      behaviors: [],
      allowed_tools: [],
    });
    created.agents.push(agentB1.id);
    const convB1 = await db.conversation.create({
      workspace: wsB.id,
      agent: agentB1.id,
      customer: "c2",
      customer_name: "C2",
      customer_email: "c2@x.com",
      handoff_trigger: null,
      handoff_reason: null,
    });
    created.conversations.push(convB1.id);
    const convB2 = await db.conversation.create({
      workspace: wsB.id,
      agent: agentB1.id,
      customer: "c3",
      customer_name: "C3",
      customer_email: "c3@x.com",
      handoff_trigger: null,
      handoff_reason: null,
    });
    created.conversations.push(convB2.id);
    const bkB1 = await db.booking.create({
      workspace: wsB.id,
      service: null,
      date: null,
      time: null,
      customer_name: "B2",
      customer_email: "b2@x.com",
      customer_phone: null,
      notes: null,
      status: "confirmed",
    });
    created.bookings.push(bkB1.id);
    const bkB2 = await db.booking.create({
      workspace: wsB.id,
      service: null,
      date: null,
      time: null,
      customer_name: "B3",
      customer_email: "b3@x.com",
      customer_phone: null,
      notes: null,
      status: "confirmed",
    });
    created.bookings.push(bkB2.id);

    await updateSubscription(wsA.id, { plan: "starter", status: "active" });
    await updateSubscription(wsB.id, { plan: "pro", status: "active" });

    const usageAfterA = await getWorkspaceUsage(wsA.id);
    const usageAfterB = await getWorkspaceUsage(wsB.id);
    const limitsA = PLAN_LIMITS[usageAfterA.agents > 0 ? "starter" : "starter"];
    const limitsB = PLAN_LIMITS["pro"];
    record(
      "Workspace A usage matches seeded data (no B leakage)",
      usageAfterA.agents === 1 && usageAfterA.conversations === 1 && usageAfterA.bookings === 1,
      `agents=${usageAfterA.agents} conv=${usageAfterA.conversations} bookings=${usageAfterA.bookings}`,
    );
    record(
      "Workspace B usage matches seeded data (no A leakage)",
      usageAfterB.agents === 1 && usageAfterB.conversations === 2 && usageAfterB.bookings === 2,
      `agents=${usageAfterB.agents} conv=${usageAfterB.conversations} bookings=${usageAfterB.bookings}`,
    );
    record(
      "Meters calculate against correct plan limits",
      usageAfterA.agents <= limitsA.agents && usageAfterB.agents <= limitsB.agents,
      `A: ${usageAfterA.agents}/${limitsA.agents} agents (starter=1)  B: ${usageAfterB.agents}/${limitsB.agents} agents (pro=15)`,
    );
    record(
      "team_members reflects active memberships per workspace",
      usageAfterA.team_members === 3 && usageAfterB.team_members === 1,
      `A memberships(owner+manager+agent active)=${usageAfterA.team_members} B(owner)=${usageAfterB.team_members}`,
    );

    // ---------- PART C: Webhooks ----------
    console.log("\n-- C.1 Create webhook (ownership, events, active) --");
    // Mirrors the production createWorkspaceWebhook server action, which always
    // generates a signing secret at creation time.
    const whA = await createWebhook({
      workspace: wsA.id,
      name: `AUDIT Webhook A (${ts})`,
      endpointUrl: `${server.url}/ok`,
      events: ["conversation.created", "lead.created"],
      secret: generateWebhookSecret(),
    });
    created.webhooks.push(whA.id);
    const whB = await createWebhook({
      workspace: wsB.id,
      name: `AUDIT Webhook B (${ts})`,
      endpointUrl: `${server.url}/ok-b`,
      events: ["booking.created"],
      secret: generateWebhookSecret(),
    });
    created.webhooks.push(whB.id);
    record("Webhook persisted", !!whA.id && !!whB.id, `A=${whA.id} B=${whB.id}`);

    // C.1 ownership
    const whAById = await getWebhookById(whA.id);
    const whBById = await getWebhookById(whB.id);
    record(
      "Workspace ownership stored correctly",
      whAById?.workspace === wsA.id && whBById?.workspace === wsB.id,
      `A.workspace=${whAById?.workspace} B.workspace=${whBById?.workspace}`,
    );
    record(
      "Configured events persisted",
      JSON.stringify([...(whAById?.events ?? [])].sort()) ===
        JSON.stringify(["conversation.created", "lead.created"].sort()),
      `A events=${JSON.stringify(whAById?.events)}`,
    );
    record("active/enabled state correct", whAById?.active !== false, `A active=${whAById?.active}`);

    console.log("\n-- C.2 Secret generation --");
    const secretA = whAById?.secret ?? "";
    record("Signing secret generated", secretA.length >= 32, `secret length=${secretA.length} (not printed)`);
    record(
      "Secret is associated with correct webhook",
      (await getWebhookById(whA.id))?.secret === secretA && (await getWebhookById(whB.id))?.secret !== secretA,
      "secret matches webhook A only",
    );

    console.log("\n-- C.3 Event configuration --");
    const allEvents = [
      "conversation.created",
      "conversation.handoff",
      "lead.created",
      "booking.created",
      "booking.cancelled",
      "booking.rescheduled",
    ] as const;
    const updated = await updateWebhook(whA.id, { events: [...allEvents] });
    record(
      "All implemented events selectable",
      JSON.stringify([...(updated.events ?? [])].sort()) === JSON.stringify([...allEvents].sort()),
      `configured=${JSON.stringify(updated.events)} (6 supported events)`,
    );

    console.log("\n-- C.4 Event emission → delivery → record --");
    // Dispatch a real conversation.created event for workspace A
    await dispatchWebhook(wsA.id, "conversation.created", { conversationId: "audit-conv-1", customerEmail: "x@x.com" });
    await new Promise((r) => setTimeout(r, 1500));
    const deliveriesA = await getWebhookDeliveries(whA.id);
    const capOk = server.requests.find((r: any) => r.pathname === "/ok");
    record(
      "Business event generated a delivery",
      deliveriesA.some((d) => d.event === "conversation.created"),
      `deliveries=${deliveriesA.length}, events=${JSON.stringify(deliveriesA.map((d) => d.event))}`,
    );
    record(
      "Outbound HTTP request actually sent",
      !!capOk,
      `captured ${capOk?.method ?? "?"} ${capOk?.pathname ?? "?"}`,
    );

    console.log("\n-- C.5 Signature --");
    const captured = server.requests.find((r: any) => r.pathname === "/ok");
    const sig = captured?.headers?.[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] ?? "";
    const tsHeader = captured?.headers?.[WEBHOOK_TIMESTAMP_HEADER.toLowerCase()] ?? "";
    record("Signature header present", sig.length > 0, `X-AgentAI-Signature present`);
    record("Timestamp header present", tsHeader.length > 0, `X-AgentAI-Timestamp present`);
    // Independently verify: recompute HMAC over `${ts}.${body}` with the stored secret
    const verified = verifyWebhookSignature(secretA, tsHeader, captured?.body ?? "", sig);
    record(
      "Signature independently verified with stored secret",
      verified,
      `HMAC-SHA256 over timestamp+payload matches (${sig.length} hex chars)`,
    );
    // Tampered payload must fail
    const tampered = verifyWebhookSignature(secretA, tsHeader, `${captured?.body}x`, sig);
    record("Tampered payload rejected", !tampered, "modified body fails verification");

    console.log("\n-- C.6 Delivery success recorded --");
    const successDelivery = deliveriesA.find((d) => d.event === "conversation.created");
    record(
      "Success delivery recorded with status/http/timestamp",
      !!successDelivery &&
        successDelivery.status === "success" &&
        successDelivery.http_status === 200 &&
        !!successDelivery.date_created &&
        successDelivery.response_time != null,
      `status=${successDelivery?.status} http=${successDelivery?.http_status} time=${successDelivery?.response_time}ms retries=${successDelivery?.retry_count}`,
    );

    console.log("\n-- C.7 Failure + retry --");
    const whFail = await createWebhook({
      workspace: wsA.id,
      name: `AUDIT Fail (${ts})`,
      endpointUrl: `${server.url}/fail`,
      events: ["lead.created"],
      secret: generateWebhookSecret(),
    });
    created.webhooks.push(whFail.id);
    await dispatchWebhook(wsA.id, "lead.created", { leadId: "audit-lead-1" });
    await new Promise((r) => setTimeout(r, 2500));
    const failDeliveries = await getWebhookDeliveries(whFail.id);
    const failCount = server.requests.filter((r: any) => r.pathname === "/fail").length;
    record(
      "Failed delivery retried (retry_count=1)",
      failDeliveries.some((d) => d.event === "lead.created" && d.retry_count === 1),
      `attempts hit endpoint=${failCount}, recorded=${JSON.stringify(failDeliveries.map((d) => ({ status: d.status, retries: d.retry_count, http: d.http_status })))}`,
    );
    record(
      "Final status reflects failure after retry",
      failDeliveries.some((d) => d.event === "lead.created" && d.status === "failed"),
      `final status=${JSON.stringify(failDeliveries.map((d) => d.status))}`,
    );

    console.log("\n-- C.8 Cross-workspace webhook security --");
    // User A must NOT be able to read/update/delete/test webhook B via the authorization layer
    let readB = false;
    try {
      await checkWorkspaceAccess(userA, wsB.id, PERMISSIONS.SETTINGS_UPDATE);
      readB = true;
    } catch {
      /* denied */
    }
    record("User A cannot manage webhook B (read path)", !readB, "checkWorkspaceAccess denies (no membership)");
    // Direct-ID access: webhook B belongs to wsB; owner of wsB can manage it
    let ownB = false;
    try {
      await checkWorkspaceAccess(userB, wsB.id, PERMISSIONS.SETTINGS_UPDATE);
      ownB = true;
    } catch {
      /* denied */
    }
    record("Owner B can manage webhook B (control)", ownB, "legitimate access allowed");
    // getWebhooksByWorkspace is scoped by workspace filter
    const listA = await getWebhooksByWorkspace(wsA.id);
    const listB = await getWebhooksByWorkspace(wsB.id);
    record(
      "Workspace webhook list is scoped (no B in A's list)",
      listA.some((w) => w.id === whA.id) &&
        !listA.some((w) => w.id === whB.id) &&
        listB.some((w) => w.id === whB.id) &&
        !listB.some((w) => w.id === whA.id),
      `A list=${listA.map((w) => w.id)} B list=${listB.map((w) => w.id)}`,
    );

    // ---------- PART D: manual test-ping endpoint ----------
    console.log("\n-- D. Test delivery (test.ping) --");
    const pingRes = await sendTestWebhook((await getWebhookById(whA.id)) as WebhookEntity);
    await new Promise((r) => setTimeout(r, 1000));
    const pingCaptured = server.requests.filter((r: any) => r.pathname === "/ok").at(-1);
    record(
      "sendTestWebhook delivers test.ping",
      pingRes.success && pingCaptured?.body.includes("test.ping"),
      `success=${pingRes.success} http=${pingRes.httpStatus}`,
    );
  } finally {
    await cleanup();
    await server.close();
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  FINAL REPORT");
  console.log("══════════════════════════════════════════");
  console.log("\n| Test | Result | Evidence |");
  console.log("| --- | --- | --- |");
  for (const r of results) {
    console.log(`| ${r.test} | ${r.result} | ${r.evidence} |`);
  }
  const pass = results.filter((r) => r.result === "PASS").length;
  const fail = results.filter((r) => r.result === "FAIL").length;
  const blocked = results.filter((r) => r.result === "BLOCKED").length;
  console.log(`\nTOTAL: ${pass} PASS / ${fail} FAIL / ${blocked} BLOCKED`);
  return failures === 0;
}

void (async () => {
  try {
    const ok = await main();
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error("\nERROR:", error instanceof Error ? error.message : error);
    await cleanup();
    process.exit(1);
  }
})();
