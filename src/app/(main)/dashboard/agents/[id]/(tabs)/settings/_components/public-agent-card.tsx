"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function generateQRCodeUrl(text: string): string {
  const size = 256;
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

export function PublicAgentCard({ agentId }: { agentId: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/a/${agentId}`
    : `/a/${agentId}`;

  const qrCodeUrl = generateQRCodeUrl(publicUrl);

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Public link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadQr() {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `agent-qr-${agentId}.png`;
    link.click();
    toast.success("QR code downloaded!");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink />
          Public AI Agent Page
        </CardTitle>
        <CardDescription>
          Share this link to let anyone chat with your AI agent without embedding on a website.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Public Link</Label>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-sm" />
            <Button onClick={handleCopy} variant="outline">
              {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowQr(!showQr)}>
            <QrCode className="size-4" />
            {showQr ? "Hide" : "Show"} QR Code
          </Button>
          <Button variant="outline" onClick={handleDownloadQr}>
            <Download className="size-4" />
            Download QR
          </Button>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/50 p-6">
            <img
              src={qrCodeUrl}
              alt="QR Code for public agent page"
              className="size-48 rounded-lg"
            />
            <p className="text-muted-foreground text-sm text-center">
              Scan to chat with your AI receptionist
            </p>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 text-xs">
          <strong>Tip:</strong> Print this QR code and put it at your physical location
          (reception desk, storefront, business card) so customers can scan and chat instantly.
        </div>
      </CardContent>
    </Card>
  );
}
