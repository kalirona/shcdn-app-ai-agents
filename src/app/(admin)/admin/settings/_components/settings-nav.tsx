"use client";

import { useEffect, useState } from "react";
import { Boxes, Building2, Cpu, Gauge, Globe, Mail, Shield, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SettingsSectionDef, SettingsSectionId } from "../page";

const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  general: Globe,
  "ai-providers": Cpu,
  "ai-models": Boxes,
  "ai-defaults": SlidersHorizontal,
  usage: Gauge,
  security: Shield,
  email: Mail,
  storage: Building2,
  system: Boxes,
};

interface Props {
  groups: Array<{ label: string; sections: SettingsSectionDef[] }>;
  activeId: SettingsSectionId;
  onActiveChange: (id: SettingsSectionId) => void;
}

export function SettingsNav({ groups, activeId, onActiveChange }: Props) {
  return (
    <nav aria-label="Platform settings sections" className="sticky top-6 flex w-full shrink-0 flex-col gap-4 md:w-52">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 font-medium text-muted-foreground text-xs tracking-wider uppercase">{group.label}</p>
          {group.sections.map((section) => {
            const Icon = SECTION_ICONS[section.id];
            const isActive = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onActiveChange(section.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-sm transition-colors",
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}