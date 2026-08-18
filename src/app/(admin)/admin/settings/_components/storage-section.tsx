"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStorageSettings } from "@/lib/auth/actions/admin/settings.actions";
import type { PlatformSettingsEntity } from "@/lib/db/entities";

interface Props {
  settings: PlatformSettingsEntity | null;
}

export function StorageSection({ settings }: Props) {
  const [accountId, setAccountId] = useState(settings?.r2_account_id ?? "");
  const [accessKeyId, setAccessKeyId] = useState(settings?.r2_access_key_id ?? "");
  const [accessKeySecret, setAccessKeySecret] = useState("");
  const [bucket, setBucket] = useState(settings?.r2_bucket ?? "");
  const [publicUrl, setPublicUrl] = useState(settings?.r2_public_url ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveStorageSettings({
        r2AccountId: accountId,
        r2AccessKeyId: accessKeyId,
        r2AccessKeySecret: accessKeySecret,
        r2Bucket: bucket,
        r2PublicUrl: publicUrl,
      });
      if (result.ok) {
        toast.success("Storage settings saved");
        setAccessKeySecret("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="r2-account-id">Cloudflare account ID</Label>
          <Input
            id="r2-account-id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="abc123..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r2-access-key-id">Access key ID</Label>
          <Input id="r2-access-key-id" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r2-access-key-secret">Access key secret</Label>
          <Input
            id="r2-access-key-secret"
            type="password"
            value={accessKeySecret}
            onChange={(e) => setAccessKeySecret(e.target.value)}
            placeholder={settings?.r2_access_key_secret ? "Leave blank to keep" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r2-bucket">Bucket name</Label>
          <Input
            id="r2-bucket"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="agent-ai-assets"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r2-public-url">Public bucket URL</Label>
          <Input
            id="r2-public-url"
            type="url"
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="https://pub-xxx.r2.dev"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
