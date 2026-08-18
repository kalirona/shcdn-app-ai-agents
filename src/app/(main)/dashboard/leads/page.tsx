"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWorkspaceLeads, updateLeadStatus, exportLeads } from "@/lib/auth/actions/lead/lead.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import type { LeadEntity } from "@/lib/db/entities";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "contacted", label: "Contacted", color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  { value: "qualified", label: "Qualified", color: "border-green-200 bg-green-50 text-green-700" },
  { value: "won", label: "Won", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "lost", label: "Lost", color: "border-red-200 bg-red-50 text-red-700" },
];

function StatusBadge({ status }: { status: LeadEntity["status"] }) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${option?.color ?? ""}`}>
      {option?.label ?? status}
    </span>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          setIsLoading(false);
          return;
        }
        setWorkspaceId(ws.id);
        const result = await getWorkspaceLeads(ws.id);
        if (result.leads) {
          setLeads(result.leads);
        }
      } catch {
        // ignore
      }
      setIsLoading(false);
    };

    loadLeads();
  }, []);

  async function handleStatusChange(leadId: string, newStatus: LeadEntity["status"]) {
    const result = await updateLeadStatus(leadId, newStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
      toast.success("Lead status updated.");
    }
  }

  async function handleExport() {
    if (!workspaceId) return;
    const result = await exportLeads(workspaceId);
    if (result.error || !result.data || !result.filename) {
      toast.error(result.error ?? "Export failed");
      return;
    }

    const blob = new Blob([result.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLeads = statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Track leads captured by your AI agents.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <User className="size-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-lg">No leads yet</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Leads captured by your AI agents will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-sm">Lead</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Source</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{lead.name}</p>
                      {lead.company && (
                        <p className="text-muted-foreground text-xs">{lead.company}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-sm">
                        <Mail className="size-3 text-muted-foreground" />
                        {lead.email}
                      </p>
                      {lead.phone && (
                        <p className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Phone className="size-3" />
                          {lead.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {lead.source ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={lead.status}
                      onValueChange={(v) => handleStatusChange(lead.id, v as LeadEntity["status"])}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(lead.date_created).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
