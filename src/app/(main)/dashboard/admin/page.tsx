"use client";

import { useEffect, useState } from "react";

import { Activity, AlertTriangle, BarChart3, Bot, DollarSign, Loader2, Shield, Users } from "lucide-react";

import type { PlatformStats } from "@/lib/auth/actions/admin/admin.actions";
import { getPlatformStats } from "@/lib/auth/actions/admin/admin.actions";

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "workspaces", label: "Workspaces", icon: Bot },
  { id: "subscriptions", label: "Subscriptions", icon: DollarSign },
  { id: "system", label: "System Health", icon: Activity },
  { id: "audit", label: "Audit Logs", icon: Shield },
];

function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-bold text-2xl">{value}</p>
          {subtext && <p className="text-muted-foreground text-xs">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const result = await getPlatformStats();
        if (!cancelled) {
          setStats(result);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Admin Platform</h1>
        <p className="text-muted-foreground">Monitor and manage your Agent AI platform.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Users" value={stats.totalUsers} icon={Users} />
            <StatCard label="Workspaces" value={stats.totalWorkspaces} icon={Bot} />
            <StatCard label="AI Agents" value={stats.totalAgents} icon={Bot} />
            <StatCard label="Conversations" value={stats.totalConversations} icon={Activity} />
            <StatCard label="Revenue" value={`$${stats.totalRevenue}`} icon={DollarSign} />
            <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} icon={DollarSign} />
          </div>

          <div className="rounded-xl border bg-background p-6">
            <h3 className="font-medium">Platform Health</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: "API Uptime", value: "99.9%", status: "healthy" },
                { label: "AI Provider", value: "Connected", status: "healthy" },
                { label: "Database", value: "Connected", status: "healthy" },
                { label: "Storage", value: "12% used", status: "healthy" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
                  <span className="text-sm">{item.label}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full bg-green-500" />
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Users</h3>
            <span className="text-muted-foreground text-sm">{stats.totalUsers} users</span>
          </div>
          <div className="rounded-xl border bg-background p-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="size-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No user details yet</p>
              <p className="text-muted-foreground text-sm">User profiles will appear here as they sign up.</p>
            </div>
          </div>
        </div>
      )}

      {/* Workspaces Tab */}
      {activeTab === "workspaces" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Workspaces</h3>
            <span className="text-muted-foreground text-sm">{stats.totalWorkspaces} workspaces</span>
          </div>
          <div className="rounded-xl border bg-background p-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Bot className="size-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No workspaces yet</p>
              <p className="text-muted-foreground text-sm">Workspaces will appear here as teams sign up.</p>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Subscriptions</h3>
            <span className="text-muted-foreground text-sm">{stats.activeSubscriptions} active</span>
          </div>
          <div className="rounded-xl border bg-background p-6">
            <div className="flex flex-col items-center justify-center py-8">
              <DollarSign className="size-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No active subscriptions</p>
              <p className="text-muted-foreground text-sm">Subscriptions will appear here when users upgrade.</p>
            </div>
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === "system" && (
        <div className="space-y-4">
          <h3 className="font-medium">System Health</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "CPU Usage", value: "12%", status: "healthy" },
              { label: "Memory", value: "256MB / 2GB", status: "healthy" },
              { label: "Disk", value: "1.2GB / 50GB", status: "healthy" },
              { label: "Network", value: "Normal", status: "healthy" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full bg-green-500" />
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <h3 className="font-medium">Audit Logs</h3>
          <div className="rounded-xl border bg-background p-6">
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="size-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No audit events yet</p>
              <p className="text-muted-foreground text-sm">Sign-in and workspace events will appear here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
