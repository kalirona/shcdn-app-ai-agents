process.env.DIRECTUS_URL = process.env.DIRECTUS_URL || "https://vip.sitenexai.com";
process.env.DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "AHGd29-uqMpkrjjhtD5iVT1jtdkA-nld";

async function main() {
  const [{ db }, webhookRepo, { dispatchWebhook }] = await Promise.all([
    import("../src/lib/db/client"),
    import("../src/lib/db/repositories/webhook.repo"),
    import("../src/lib/webhooks/delivery"),
  ]);
  const workspaces = await db.workspace.getMany({ limit: 1 });
  const workspaceId = workspaces[0]?.id;
  if (!workspaceId) throw new Error("no workspace found");

  const webhook = await webhookRepo.createWebhook({
    workspace: workspaceId,
    name: "smoke-test",
    endpointUrl: "https://httpbin.org/post",
    events: ["lead.created"],
  });
  console.log("created webhook:", webhook.id, "events:", webhook.events, "active:", webhook.active);

  await dispatchWebhook(workspaceId, "lead.created", { hello: "world" });

  const deliveries = await db.webhookDelivery.getByWebhook(webhook.id);
  console.log(
    "deliveries:",
    deliveries.length,
    JSON.stringify(deliveries.map((d) => ({ status: d.status, http: d.http_status, retries: d.retry_count }))),
  );

  // cleanup
  await db.webhookDelivery.getByWebhook(webhook.id).then((rows) =>
    Promise.all(
      rows.map((r) =>
        fetch(`https://vip.sitenexai.com/items/webhook_deliveries/${r.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
        }),
      ),
    ),
  );
  await db.webhook.delete(webhook.id);
  console.log("cleaned up");
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});
