"use client";

import { useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AuditCategory, AuditSeverity } from "@/lib/db/entities";

const CATEGORY_OPTIONS: { value: AuditCategory; label: string }[] = [
  { value: "auth", label: "Auth" },
  { value: "admin", label: "Admin" },
  { value: "workspace", label: "Workspace" },
  { value: "user", label: "User" },
  { value: "security", label: "Security" },
  { value: "system", label: "System" },
];

const SEVERITY_OPTIONS: { value: AuditSeverity; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

export function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const status = searchParams.get("status") ?? "";

  function update(next: Record<string, string>) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Reset to the first page when filters change.
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search actor, action, target..."
          defaultValue={q}
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const el = e.currentTarget;
              update({ q: el.value });
            }
          }}
          onBlur={(e) => update({ q: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-category" className="text-xs">
          Category
        </Label>
        <NativeSelect
          id="audit-category"
          className="w-full md:w-40"
          value={category}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-severity" className="text-xs">
          Severity
        </Label>
        <NativeSelect
          id="audit-severity"
          className="w-full md:w-36"
          value={severity}
          onChange={(e) => update({ severity: e.target.value })}
        >
          <option value="">All</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-status" className="text-xs">
          Status
        </Label>
        <NativeSelect
          id="audit-status"
          className="w-full md:w-36"
          value={status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </NativeSelect>
      </div>

      {isPending && (
        <Button variant="ghost" size="sm" disabled className="md:self-end">
          Loading...
        </Button>
      )}
    </div>
  );
}
