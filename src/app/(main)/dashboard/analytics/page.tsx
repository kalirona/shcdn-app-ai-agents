"use client";

import { useEffect, useState } from "react";

import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import type { AnalyticsKPIs, TopQuestion, UnansweredQuestion } from "@/lib/auth/actions/analytics/analytics.actions";
import { getWorkspaceAnalytics } from "@/lib/auth/actions/analytics/analytics.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
}

function KPICard({ label, value, icon, subtext }: KPICardProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-semibold text-2xl">{value}</p>
          {subtext && <p className="text-muted-foreground text-xs">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          return;
        }
        const result = await getWorkspaceAnalytics(ws.id);
        if (!cancelled && result.kpis) {
          setKpis(result.kpis);
          setTopQuestions(result.topQuestions);
          setUnansweredQuestions(result.unansweredQuestions);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="size-12 text-muted-foreground" />
        <p className="mt-4 font-medium">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track your AI agent performance and business impact.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Conversations"
          value={kpis.totalConversations}
          icon={<MessageSquare className="size-5 text-muted-foreground" />}
        />
        <KPICard
          label="AI Resolved"
          value={kpis.aiResolved}
          icon={<Bot className="size-5 text-muted-foreground" />}
          subtext={`${kpis.resolutionRate}% resolution rate`}
        />
        <KPICard
          label="Human Handoffs"
          value={kpis.humanHandoffs}
          icon={<UserCheck className="size-5 text-muted-foreground" />}
        />
        <KPICard
          label="Leads Captured"
          value={kpis.leadsCaptured}
          icon={<Users className="size-5 text-muted-foreground" />}
        />
        <KPICard
          label="Bookings Created"
          value={kpis.bookingsCreated}
          icon={<Calendar className="size-5 text-muted-foreground" />}
        />
        <KPICard
          label="Avg Response Time"
          value={kpis.avgResponseTime}
          icon={<Clock className="size-5 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <TrendingUp className="size-4" />
            Top Questions
          </h3>
          {topQuestions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No questions data yet. Start chatting to see insights.
            </p>
          ) : (
            <div className="space-y-2">
              {topQuestions.map((q, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm">{q.question}</span>
                  <span className="text-muted-foreground text-xs">{q.count} times</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <XCircle className="size-4" />
            Unanswered Questions
          </h3>
          {unansweredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="size-8 text-green-500" />
              <p className="mt-2 text-muted-foreground text-sm">All questions have been answered! Great job.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unansweredQuestions.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2"
                >
                  <span className="text-sm">{q.question}</span>
                  <span className="text-muted-foreground text-xs">{q.date}</span>
                </div>
              ))}
              <p className="mt-2 text-muted-foreground text-xs">
                💡 Add these topics to your knowledge base to improve AI responses.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
