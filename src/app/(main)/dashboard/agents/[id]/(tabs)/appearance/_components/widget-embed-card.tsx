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
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const code = `<!-- Agent AI Chat Widget -->
<script>
(function() {
  var config = {
    agentId: "${agentId}",
    baseUrl: "${baseUrl}",
    primaryColor: "${primaryColor}",
    position: "${position}"
  };

  var iframe = document.createElement('iframe');
  iframe.src = config.baseUrl + '/widget?agent=' + config.agentId;
  iframe.id = 'agent-ai-widget-frame';
  iframe.style.cssText = 'position:fixed;bottom:20px;${position === "bottom-left" ? "left" : "right"}:20px;width:0;height:0;border:none;z-index:999999;transition:all 0.3s ease;';

  var toggle = document.createElement('button');
  toggle.id = 'agent-ai-widget-toggle';
  toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  toggle.style.cssText = 'position:fixed;bottom:20px;${position === "bottom-left" ? "left" : "right"}:20px;width:56px;height:56px;border-radius:50%;border:none;background:' + config.primaryColor + ';color:white;cursor:pointer;z-index:999998;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';

  var isOpen = false;
  toggle.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.width = '380px';
      iframe.style.height = '600px';
      iframe.style.bottom = '88px';
      iframe.style.borderRadius = '12px';
      iframe.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
      toggle.style.transform = 'scale(0.9)';
    } else {
      iframe.style.width = '0';
      iframe.style.height = '0';
      toggle.style.transform = 'scale(1)';
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(toggle);
})();
</script>
<!-- End Agent AI Chat Widget -->`;

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
              <strong>Instructions:</strong> Paste this code before the closing &lt;/body&gt; tag on any page of your website. The widget will appear as a chat button.
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
