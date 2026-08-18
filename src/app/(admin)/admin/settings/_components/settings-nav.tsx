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
}

export function SettingsNav({ groups }: Props) {
  const [activeId, setActiveId] = useState<SettingsSectionId>("general");

  useEffect(() => {
    const ids = groups.flatMap((g) => g.sections.map((s) => s.id));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost section currently in view.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          setActiveId((top.target as HTMLElement).id as SettingsSectionId);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((el) => {
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [groups]);

  return (
    <nav aria-label="Platform settings sections" className="sticky top-6 flex w-full shrink-0 flex-col gap-4 md:w-52">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 font-medium text-muted-foreground text-xs tracking-wider uppercase">{group.label}</p>
          {group.sections.map((section) => {
            const Icon = SECTION_ICONS[section.id];
            const isActive = section.id === activeId;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {section.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}