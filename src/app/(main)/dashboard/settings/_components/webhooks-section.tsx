"use client";

import { useCallback, useEffect, useState } from "react";

import { CheckCircle2, Copy, History, KeyRound, Loader2, RefreshCcw, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createWorkspaceWebhook,
  deleteWorkspaceWebhook,
  getWebhookDeliveries,
  getWorkspaceWebhooks,
  regenerateWebhookSecret,
  testWorkspaceWebhook,
  updateWorkspaceWebhook,
} from "@/lib/auth/actions/webhook/webhook.actions";
import { WEBHOOK_EVENTS } from "@/lib/auth/schemas/webhook.schema";
import type { WebhookDeliveryEntity, WebhookEntity, WebhookEventName } from "@/lib/db/entities";

const EVENT_LABELS: Record<WebhookEventName, string> = {
  "conversation.created": "Conversation created",
  "conversation.handoff": "Human handoff",
  "lead.created": "Lead created",
  "booking.created": "Booking created",
  "booking.cancelled": "Booking cancelled",
  "booking.rescheduled": "Booking rescheduled",
};

function eventLabel(event: string): string {
  return EVENT_LABELS[event as WebhookEventName] ?? event;
}

function toggleEvent(event: WebhookEventName, current: WebhookEventName[], setter: (v: WebhookEventName[]) => void) {
  setter(current.includes(event) ? current.filter((e) => e !== event) : [...current, event]);
}

function EventPicker({ events, onChange }: { events: WebhookEventName[]; onChange: (v: WebhookEventName[]) => void }) {
  return (
    <div className="grid gap-2">
      {WEBHOOK_EVENTS.map((event) => (
        <label key={event} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={events.includes(event)}
            onChange={() => toggleEvent(event, events, onChange)}
            className="size-4 accent-primary"
          />
          {EVENT_LABELS[event]}
        </label>
      ))}
    </div>
  );
}

interface WebhookRow {
  webhook: WebhookEntity;
  isSaving: boolean;
}

function DeliveryList({ deliveries }: { deliveries: WebhookDeliveryEntity[] }) {
  if (deliveries.length === 0) {
    return <p className="py-8 text-center text-muted-foreground text-sm">No deliveries yet.</p>;
  }

  return (
    <div className="space-y-2">
      {deliveries.map((delivery) => (
        <div key={delivery.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            {delivery.status === "success" ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <span className="font-medium">{eventLabel(delivery.event)}</span>
            {delivery.retry_count && delivery.retry_count > 0 ? (
              <Badge variant="secondary">retried ×{delivery.retry_count}</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {delivery.http_status !== null && (
              <span
                className={
                  delivery.http_status >= 200 && delivery.http_status < 300 ? "text-emerald-600" : "text-red-500"
                }
              >
                HTTP {delivery.http_status}
              </span>
            )}
            <span>{new Date(delivery.date_created).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InviteDeliveriesDialog({ webhookId }: { webhookId: string }) {
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || deliveries.length > 0) return;
    setIsLoading(true);
    void getWebhookDeliveries(webhookId).then((result) => {
      if (result.success) setDeliveries(result.deliveries);
      else if (result.error) toast.error(result.error);
      setIsLoading(false);
    });
  }, [open, webhookId, deliveries.length]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delivery history</DialogTitle>
          <DialogDescription>Recent webhook delivery attempts and their results.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DeliveryList deliveries={deliveries} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevealSecretDialog({ webhook }: { webhook: WebhookEntity }) {
  const [secret, setSecret] = useState<string | null>(webhook.secret);

  async function handleRegenerate() {
    const result = await regenerateWebhookSecret(webhook.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.secret) setSecret(result.secret);
    toast.success("New signing secret generated");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyRound />
          Secret
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>
            Use this secret to verify that requests genuinely came from Agent AI. Deliveries include{" "}
            <code className="text-xs">X-AgentAI-Signature</code> (HMAC-SHA256 over &quot;timestamp.payload&quot;) and{" "}
            <code className="text-xs">X-AgentAI-Timestamp</code>.
          </DialogDescription>
        </DialogHeader>
        {!secret ? (
          <Button onClick={handleRegenerate} variant="outline">
            Generate secret
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={secret} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  toast.success("Secret copied to clipboard");
                }}
                title="Copy secret"
              >
                <Copy />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCcw />
              Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksSection({ workspaceId }: { workspaceId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookEntity | null>(null);

  // create form
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventName[]>(["lead.created", "booking.created"]);
  const [isCreating, setIsCreating] = useState(false);

  // edit form
  const [editName, setEditName] = useState("");
  const [editEndpointUrl, setEditEndpointUrl] = useState("");
  const [editEvents, setEditEvents] = useState<WebhookEventName[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    const result = await getWorkspaceWebhooks(workspaceId);
    if (result.success) {
      setWebhooks(result.webhooks.map((webhook) => ({ webhook, isSaving: false })));
    } else if (result.error) {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event.");
      return;
    }
    setIsCreating(true);
    const result = await createWorkspaceWebhook(workspaceId, {
      name,
      endpointUrl,
      events: selectedEvents,
    });
    setIsCreating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Webhook created");
    setName("");
    setEndpointUrl("");
    setSelectedEvents(["lead.created", "booking.created"]);
    setCreateOpen(false);
    await load();
  }

  function openEdit(webhook: WebhookEntity) {
    setEditWebhook(webhook);
    setEditName(webhook.name);
    setEditEndpointUrl(webhook.endpoint_url);
    setEditEvents(webhook.events);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editWebhook) return;
    if (editEvents.length === 0) {
      toast.error("Select at least one event.");
      return;
    }
    setIsEditing(true);
    const result = await updateWorkspaceWebhook(editWebhook.id, {
      name: editName,
      endpointUrl: editEndpointUrl,
      events: editEvents,
    });
    setIsEditing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Webhook updated");
    setEditWebhook(null);
    await load();
  }

  async function handleToggleActive(row: WebhookRow) {
    setWebhooks((prev) => prev.map((r) => (r.webhook.id === row.webhook.id ? { ...r, isSaving: true } : r)));
    const result = await updateWorkspaceWebhook(row.webhook.id, { active: !row.webhook.active });
    setWebhooks((prev) => prev.map((r) => (r.webhook.id === row.webhook.id ? { ...r, isSaving: false } : r)));
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.webhook?.active ? "Webhook enabled" : "Webhook disabled");
    await load();
  }

  async function handleTest(row: WebhookRow) {
    setWebhooks((prev) => prev.map((r) => (r.webhook.id === row.webhook.id ? { ...r, isSaving: true } : r)));
    const result = await testWorkspaceWebhook(row.webhook.id);
    setWebhooks((prev) => prev.map((r) => (r.webhook.id === row.webhook.id ? { ...r, isSaving: false } : r)));
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Test delivered (HTTP ${result.httpStatus})`);
  }

  async function handleDelete(row: WebhookRow) {
    if (!confirm(`Delete webhook "${row.webhook.name}"? This cannot be undone.`)) return;
    const result = await deleteWorkspaceWebhook(row.webhook.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Webhook deleted");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Webhooks</p>
          <p className="text-muted-foreground text-sm">Send leads, bookings and conversations to external systems.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Send />
              Create webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create webhook</DialogTitle>
              <DialogDescription>Deliver Agent AI events to your own endpoint.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wh-name">Name</Label>
                <Input
                  id="wh-name"
                  placeholder="CRM / Zapier"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-url">Endpoint URL</Label>
                <Input
                  id="wh-url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <EventPicker events={selectedEvents} onChange={setSelectedEvents} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="size-4 animate-spin" />}
                  Create webhook
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editWebhook !== null} onOpenChange={(o) => !o && setEditWebhook(null)}>
        <DialogContent className="max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit webhook</DialogTitle>
            <DialogDescription>Update events, endpoint, or delivery settings.</DialogDescription>
          </DialogHeader>
          {editWebhook && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url">Endpoint URL</Label>
                <Input
                  id="edit-url"
                  type="url"
                  value={editEndpointUrl}
                  onChange={(e) => setEditEndpointUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <EventPicker events={editEvents} onChange={setEditEvents} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isEditing}>
                  {isEditing && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WebhookTable
          webhooks={webhooks}
          onToggleActive={(row) => void handleToggleActive(row)}
          onTest={(row) => void handleTest(row)}
          onEdit={openEdit}
          onDelete={(row) => void handleDelete(row)}
        />
      )}
    </div>
  );
}

function WebhookTable({
  webhooks,
  onToggleActive,
  onTest,
  onEdit,
  onDelete,
}: {
  webhooks: WebhookRow[];
  onToggleActive: (row: WebhookRow) => void;
  onTest: (row: WebhookRow) => void;
  onEdit: (webhook: WebhookEntity) => void;
  onDelete: (row: WebhookRow) => void;
}) {
  if (webhooks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        No webhooks configured yet. Create one to forward events to your endpoint.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {webhooks.map(({ webhook, isSaving }) => (
            <TableRow key={webhook.id}>
              <TableCell>
                <p className="font-medium">{webhook.name}</p>
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">{webhook.endpoint_url}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {eventLabel(event)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={webhook.active !== false}
                    disabled={isSaving}
                    onCheckedChange={() => onToggleActive({ webhook, isSaving })}
                    aria-label="Toggle webhook"
                  />
                  <span className="text-muted-foreground text-xs">
                    {webhook.active !== false ? "Active" : "Disabled"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onTest({ webhook, isSaving })} disabled={isSaving}>
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(webhook)}>
                    Edit
                  </Button>
                  <InviteDeliveriesDialog webhookId={webhook.id} />
                  <RevealSecretDialog webhook={webhook} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete({ webhook, isSaving })}
                    className="text-red-600 hover:text-red-600"
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
