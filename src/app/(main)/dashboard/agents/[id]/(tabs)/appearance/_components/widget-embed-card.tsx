"use client";

import { useState } from "react";

import { CheckCheck, Code, Copy, ExternalLink, Palette, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WidgetEmbedCard({ agentId }: { agentId: string }) {
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");

  function generateEmbedCode() {
    // CRITICAL: use the application origin (from NEXT_PUBLIC_APP_URL), NOT
    // window.location.origin. On a customer site the iframe must point at this
    // app's /widget route, otherwise it would embed the host site itself.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const code = `<!-- Agent AI Chat Widget -->\n<script src="${baseUrl}/embed.js"\n        data-agent="${agentId}"\n        data-base-url="${baseUrl}"\n        data-position="${position}"\n        data-primary-color="${primaryColor}">\n</script>\n<!-- End Agent AI Chat Widget -->`;

    setEmbedCode(code);
    toast.success("Embed code generated!");
  }

  async function handleCopy() {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Embed code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code />
          Website Embed
        </CardTitle>
        <CardDescription>Generate and copy the embed code for your website.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customization Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="embed-color">Widget Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="size-8 cursor-pointer rounded border-0"
              />
              <Input
                id="embed-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="max-w-28"
                maxLength={7}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <div className="flex gap-2">
              <Button
                variant={position === "bottom-right" ? "default" : "outline"}
                size="sm"
                onClick={() => setPosition("bottom-right")}
              >
                Bottom Right
              </Button>
              <Button
                variant={position === "bottom-left" ? "default" : "outline"}
                size="sm"
                onClick={() => setPosition("bottom-left")}
              >
                Bottom Left
              </Button>
            </div>
          </div>
        </div>

        {!embedCode ? (
          <Button onClick={generateEmbedCode} className="w-full">
            <Code />
            Generate Embed Code
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 text-xs">
                <code>{embedCode}</code>
              </pre>
              <Button size="icon" variant="secondary" className="absolute top-2 right-2" onClick={handleCopy}>
                {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-800 text-xs">
              <strong>Instructions:</strong> Paste the single <code>script</code> tag above before the closing &lt;/body&gt; tag on any page of your website. The widget will appear as a chat button in the corner you selected.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WidgetCustomizationCard() {
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette />
          Widget Appearance
        </CardTitle>
        <CardDescription>Customize how the chat widget looks on your site.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="widget-color">Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="size-10 cursor-pointer rounded border-0"
            />
            <Input
              id="widget-color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="max-w-32"
              maxLength={7}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Position</Label>
          <div className="flex gap-2">
            <Button
              variant={position === "bottom-right" ? "default" : "outline"}
              onClick={() => setPosition("bottom-right")}
            >
              Bottom Right
            </Button>
            <Button
              variant={position === "bottom-left" ? "default" : "outline"}
              onClick={() => setPosition("bottom-left")}
            >
              Bottom Left
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
