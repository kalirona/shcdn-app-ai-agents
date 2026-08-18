"use client";

import { useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
  { value: "archived", label: "Archived" },
] as const;

export function UsersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";

  function update(next: Record<string, string>) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search email, name..."
          defaultValue={q}
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") update({ q: e.currentTarget.value });
          }}
          onBlur={(e) => update({ q: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="users-status" className="text-xs">
          Status
        </Label>
        <NativeSelect
          id="users-status"
          className="w-full md:w-40"
          value={status}
          onChange={(e) => update({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
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
