"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  DollarSign,
  Settings,
  Shield,
  Users,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalAgents: number;
  totalConversations: number;
  totalRevenue: number;
  activeSubscriptions: number;
}

const mockStats: AdminStats = {
  totalUsers: 1,
  totalWorkspaces: 1,
  totalAgents: 0,
  totalConversations: 0,
  totalRevenue: 0,
  activeSubscriptions: 0,
};

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "workspaces", label: "Workspaces", icon: Bot },
  { id: "subscriptions", label: "Subscriptions", icon: DollarSign },
  { id: "system", label: "System Health", icon: Activity },
  { id: "audit", label: "Audit Logs", icon: Shield },
];

function StatCard({ label, value, icon: Icon, subtext }: { label: string; value: string | number; icon: React.ElementType; subtext?: string }) {
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
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
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
            <StatCard label="Total Users" value={mockStats.totalUsers} icon={Users} />
            <StatCard label="Workspaces" value={mockStats.totalWorkspaces} icon={Bot} />
            <StatCard label="AI Agents" value={mockStats.totalAgents} icon={Bot} />
            <StatCard label="Conversations" value={mockStats.totalConversations} icon={Activity} />
            <StatCard label="Revenue" value={`$${mockStats.totalRevenue}`} icon={DollarSign} />
            <StatCard label="Active Subscriptions" value={mockStats.activeSubscriptions} icon={DollarSign} />
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
            <span className="text-muted-foreground text-sm">{mockStats.totalUsers} users</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-sm">User</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Joined</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">Dev User</td>
                  <td className="px-4 py-3 text-sm">Admin</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700 text-xs">Active</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workspaces Tab */}
      {activeTab === "workspaces" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Workspaces</h3>
            <span className="text-muted-foreground text-sm">{mockStats.totalWorkspaces} workspaces</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-sm">Workspace</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Agents</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">Main Workspace</td>
                  <td className="px-4 py-3 text-sm">Starter</td>
                  <td className="px-4 py-3 text-sm">{mockStats.totalAgents}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700 text-xs">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Subscriptions</h3>
            <span className="text-muted-foreground text-sm">{mockStats.activeSubscriptions} active</span>
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
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-sm">Event</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">User</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">User registered</td>
                  <td className="px-4 py-3 text-sm">dev@localhost.com</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{new Date().toLocaleString()}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700 text-xs">Success</span></td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">Workspace created</td>
                  <td className="px-4 py-3 text-sm">dev@localhost.com</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{new Date().toLocaleString()}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700 text-xs">Success</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
