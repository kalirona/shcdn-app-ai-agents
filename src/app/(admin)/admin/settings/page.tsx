import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getAIDefaults } from "@/lib/db/repositories/ai-defaults.repo";
import { getAllModelsSafe } from "@/lib/db/repositories/ai-model.repo";
import { getAllProvidersSafe } from "@/lib/db/repositories/ai-provider.repo";
import { getPlatformSettings } from "@/lib/db/repositories/platform-settings.repo";

import { AIDefaultsSection } from "./_components/ai-defaults-section";
import { AIModelsSection } from "./_components/ai-models-section";
import { AIProvidersSection } from "./_components/ai-providers-section";
import { EmailSection } from "./_components/email-section";
import { GeneralSection } from "./_components/general-section";
import { SecuritySection } from "./_components/security-section";
import { SettingsNav } from "./_components/settings-nav";
import { StorageSection } from "./_components/storage-section";
import { SystemSection } from "./_components/system-section";
import { UsageSection } from "./_components/usage-section";

export const dynamic = "force-dynamic";

export type SettingsSectionId =
  | "general"
  | "ai-providers"
  | "ai-models"
  | "ai-defaults"
  | "usage"
  | "security"
  | "email"
  | "storage"
  | "system";

export interface SettingsSectionDef {
  id: SettingsSectionId;
  label: string;
  group: string;
}

export const SETTINGS_GROUPS: Array<{ label: string; sections: SettingsSectionDef[] }> = [
  {
    label: "Platform",
    sections: [
      { id: "general", label: "General", group: "Platform" },
      { id: "ai-providers", label: "AI Providers", group: "AI" },
      { id: "ai-models", label: "AI Models", group: "AI" },
      { id: "ai-defaults", label: "AI Defaults", group: "AI" },
    ],
  },
  {
    label: "Operations",
    sections: [
      { id: "usage", label: "Usage & Limits", group: "Operations" },
      { id: "security", label: "Security", group: "Operations" },
      { id: "email", label: "Email", group: "Operations" },
      { id: "storage", label: "Storage", group: "Operations" },
    ],
  },
  {
    label: "System",
    sections: [{ id: "system", label: "System", group: "System" }],
  },
];

export default async function AdminSettingsPage() {
  await requirePlatformAccess("platform:settings:manage");

  const [settings, providers, models, defaults] = await Promise.all([
    getPlatformSettings(),
    getAllProvidersSafe(),
    getAllModelsSafe(),
    getAIDefaults(),
  ]);

  const enabledCount = providers.filter((p) => p.enabled).length;
  const modelCount = models.length;

  const content: Record<SettingsSectionId, ReactNode> = {
    general: <GeneralSection settings={settings} />,
    "ai-providers": <AIProvidersSection initialProviders={providers} initialModels={models} />,
    "ai-models": <AIModelsSection initialModels={models} initialProviders={providers} />,
    "ai-defaults": <AIDefaultsSection initialDefaults={defaults} models={models} providers={providers} />,
    usage: <UsageSection />,
    security: <SecuritySection settings={settings} />,
    email: <EmailSection settings={settings} />,
    storage: <StorageSection settings={settings} />,
    system: <SystemSection providers={providers} modelsTotal={modelCount} />,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground">
          Configure the platform, AI providers, models, defaults, and operational settings.
        </p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <SettingsNav groups={SETTINGS_GROUPS} />

        <main className="min-w-0 flex-1 space-y-4">
          <SectionAnchor id="general">
            <SettingsHeader title="General" description="Core platform identity and signup behavior.">
              {content.general}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="ai-providers">
            <SettingsHeader
              title="AI Providers"
              description="Manage API keys, base URLs, and connection to each AI provider. Enable or disable providers, test connections, and discover real models."
              headerRight={<Badge variant={enabledCount > 0 ? "default" : "secondary"}>{enabledCount} enabled</Badge>}
            >
              {content["ai-providers"]}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="ai-models">
            <SettingsHeader
              title="AI Models"
              description="The model registry. Models are discovered from connected providers rather than populated from stale static lists."
              headerRight={<Badge variant="outline">{modelCount} models</Badge>}
            >
              {content["ai-models"]}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="ai-defaults">
            <SettingsHeader
              title="AI Defaults"
              description="Platform-level default models per capability and the default system prompt. Agents and workspaces may override these."
            >
              {content["ai-defaults"]}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="usage">
            <SettingsHeader title="Usage & Limits" description="Platform utilization and configured limits.">
              {content.usage}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="security">
            <SettingsHeader title="Security" description="Authentication and session hardening.">
              {content.security}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="email">
            <SettingsHeader title="Email" description="Outbound SMTP configuration for platform notifications.">
              {content.email}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="storage">
            <SettingsHeader title="Storage" description="Object storage (Cloudflare R2) for uploads and assets.">
              {content.storage}
            </SettingsHeader>
          </SectionAnchor>

          <SectionAnchor id="system">
            <SettingsHeader title="System" description="Environment, versions, and infrastructure status.">
              {content.system}
            </SettingsHeader>
          </SectionAnchor>
        </main>
      </div>
    </div>
  );
}

function SectionAnchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      {children}
    </section>
  );
}

function SettingsHeader({
  title,
  description,
  headerRight,
  children,
}: {
  title: string;
  description: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1 max-w-2xl">{description}</CardDescription>}
        </div>
        {headerRight}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
