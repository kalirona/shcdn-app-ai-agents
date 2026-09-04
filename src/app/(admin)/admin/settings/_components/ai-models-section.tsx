"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AI_CAPABILITIES } from "@/lib/ai/registry";
import {
  getAdminAIModels,
  setModelCapabilities,
  syncProviderModels,
  toggleModelEnabled,
} from "@/lib/auth/actions/admin/ai.actions";
import type { AIModelSafe } from "@/lib/db/repositories/ai-model.repo";
import type { AIProviderSafe } from "@/lib/db/repositories/ai-provider.repo";

interface Props {
  initialModels: AIModelSafe[];
  initialProviders: AIProviderSafe[];
}

function formatCost(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  return `$${value.toFixed(4)}`;
}

export function AIModelsSection({ initialModels, initialProviders }: Props) {
  const [models, setModels] = useState<AIModelSafe[]>(initialModels);
  const [providers] = useState<AIProviderSafe[]>(initialProviders);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AIModelSafe | null>(null);
  const [capsDraft, setCapsDraft] = useState<string[]>([]);
  const [syncProviderId, setSyncProviderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Reset to the first page whenever filters or search change.
  useEffect(() => {
    setPage(1);
  }, [providerFilter, capabilityFilter, statusFilter, search]);

  function refresh() {
    void getAdminAIModels().then((m) => setModels(m));
  }

  function toggleEnabled(model: AIModelSafe) {
    void toggleModelEnabled({ modelId: model.id, enabled: !model.enabled }).then((result) => {
      if (result.ok) {
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function syncModels(providerId: string) {
    setSyncProviderId(providerId);
    startTransition(async () => {
      const result = await syncProviderModels({ providerId });
      setSyncProviderId(null);
      if (result.ok) {
        toast.success(`Synced ${result.data.added} models.`);
      } else {
        toast.error(result.error);
      }
      refresh();
    });
  }

  function openEdit(model: AIModelSafe) {
    setEditing(model);
    setCapsDraft([...model.capabilities]);
  }

  function saveCaps() {
    if (!editing) return;
    void setModelCapabilities({ modelId: editing.id, capabilities: capsDraft }).then((result) => {
      if (result.ok) {
        toast.success("Capabilities updated");
        setEditing(null);
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((m) => {
      if (providerFilter !== "all" && m.providerKey !== providerFilter) return false;
      if (capabilityFilter !== "all" && !m.capabilities.includes(capabilityFilter as never)) return false;
      if (statusFilter === "enabled" && !m.enabled) return false;
      if (statusFilter === "disabled" && m.enabled) return false;
      if (query) {
        const haystack = `${m.name} ${m.modelId} ${m.providerName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [models, providerFilter, capabilityFilter, statusFilter, search]);

  const enabledCount = models.filter((m) => m.enabled).length;
  const providerOptions = providers.filter((p) => p.id);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={providerFilter === "all" ? "default" : "outline"}
            onClick={() => setProviderFilter("all")}
          >
            All
          </Button>
          {providerOptions.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={providerFilter === p.provider_key ? "default" : "outline"}
              onClick={() => setProviderFilter(p.provider_key)}
            >
              {p.name}
              <RefreshCw
                className="ml-1.5 size-3"
                onClick={(e) => {
                  e.stopPropagation();
                  syncModels(p.id);
                }}
              />
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="pl-8"
          />
        </div>
        <NativeSelect value={capabilityFilter} onChange={(e) => setCapabilityFilter(e.target.value)} size="sm">
          <option value="all">All capabilities</option>
          {AI_CAPABILITIES.map((cap) => (
            <option key={cap.value} value={cap.value}>
              {cap.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} size="sm">
          <option value="all">All status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </NativeSelect>
        <Badge variant="outline" className="shrink-0">
          {enabledCount}/{models.length} enabled
        </Badge>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>In / Out $/1M</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No models match your filters. Sync a provider to discover its real model list.
                </TableCell>
              </TableRow>
            )}
            {paged.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="text-muted-foreground text-xs">{model.providerName}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => openEdit(model)}
                    className="text-left font-medium hover:underline"
                  >
                    {model.name}
                  </button>
                  <div className="font-mono text-muted-foreground text-xs">{model.modelId}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px]">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {model.contextWindow ? model.contextWindow.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatCost(model.inputCostPerMillion)} / {formatCost(model.outputCostPerMillion)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={model.enabled ? "default" : "outline"}
                    onClick={() => toggleEnabled(model)}
                  >
                    {model.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-muted-foreground text-xs">
            Showing {rangeStart}–{rangeEnd} of {filtered.length} models
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit model capabilities</DialogTitle>
            <DialogDescription>
              {editing?.name} · {editing?.providerName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 py-2">
            {AI_CAPABILITIES.map((cap) => {
              const active = capsDraft.includes(cap.value);
              return (
                <Button
                  key={cap.value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() =>
                    setCapsDraft((prev) => (active ? prev.filter((c) => c !== cap.value) : [...prev, cap.value]))
                  }
                >
                  {cap.label}
                </Button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveCaps} disabled={syncProviderId !== null}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {syncProviderId !== null && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Refreshing models…
        </div>
      )}
    </div>
  );
}