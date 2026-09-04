"use client";

import { useState, type ReactNode } from "react";

import { SettingsNav } from "./settings-nav";

import type { SettingsSectionDef, SettingsSectionId } from "../page";

interface Props {
  groups: Array<{ label: string; sections: SettingsSectionDef[] }>;
  sections: Record<SettingsSectionId, ReactNode>;
}

/**
 * Tabbed settings layout: only the active section is mounted, so long
 * registries (e.g. 400+ AI models) don't all render on one huge page.
 */
export function SettingsShell({ groups, sections }: Props) {
  const [activeId, setActiveId] = useState<SettingsSectionId>("general");

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start">
      <SettingsNav groups={groups} activeId={activeId} onActiveChange={setActiveId} />
      <main className="min-w-0 flex-1 space-y-4">{sections[activeId]}</main>
    </div>
  );
}