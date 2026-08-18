"use client";

import { useRef, useState } from "react";

import { FileText, Globe, Loader2, MessageSquare, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAgentById } from "@/lib/auth/actions/agent.actions";
import {
  addDocumentSource,
  addFaqSource,
  addTextSource,
  addWebsiteSource,
  deleteKnowledgeSource,
  getAgentKnowledgeSources,
  reindexKnowledgeSource,
} from "@/lib/auth/actions/knowledge/knowledge.actions";

interface KnowledgeSource {
  id: string;
  workspace: string;
  agent: string | null;
  type: "website" | "document" | "faq" | "text";
  title: string;
  url: string | null;
  fileName: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  chunkCount: number;
  dateCreated: string;
  content?: string;
  errorMessage?: string | null;
}

function statusBadgeConfig(status: KnowledgeSource["status"]) {
  const config: Record<KnowledgeSource["status"], { label: string; color: string }> = {
    pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    processing: { label: "Processing", color: "text-blue-600 bg-blue-50 border-blue-200" },
    ready: { label: "Ready", color: "text-green-600 bg-green-50 border-green-200" },
    failed: { label: "Failed", color: "text-red-600 bg-red-50 border-red-200" },
  };
  return config[status];
}

function mapSource(server: {
  id: string;
  workspace: string;
  agent: string | null;
  type: "website" | "document" | "faq" | "text";
  title: string;
  url: string | null;
  file: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count: number;
  date_created: string;
  error_message?: string | null;
  content_hash?: string | null;
  token_count?: number | null;
  visibility?: "public" | "internal";
}): KnowledgeSource {
  return {
    id: server.id,
    workspace: server.workspace,
    agent: server.agent,
    type: server.type,
    title: server.title,
    url: server.url,
    fileName: server.file,
    status: server.status,
    chunkCount: server.chunk_count,
    dateCreated: server.date_created,
    errorMessage: server.error_message,
  };
}

async function resolveWorkspaceId(agentId?: string): Promise<string> {
  if (agentId) {
    const result = await getAgentById(agentId);
    if (result.agent?.workspace) {
      return result.agent.workspace;
    }
  }
  return "workspace-1";
}

function StatusBadge({ status }: { status: KnowledgeSource["status"] }) {
  const { label, color } = statusBadgeConfig(status);
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}>{label}</span>;
}

function SourceIcon({ type }: { type: KnowledgeSource["type"] }) {
  switch (type) {
    case "website":
      return <Globe className="size-4" />;
    case "document":
      return <FileText className="size-4" />;
    case "faq":
      return <MessageSquare className="size-4" />;
    default:
      return <FileText className="size-4" />;
  }
}

export function KnowledgeSourceCard({ source, onDelete }: { source: KnowledgeSource; onDelete?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteKnowledgeSource({ sourceId: source.id });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Knowledge source deleted.");
      if (onDelete) onDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleReindex() {
    setIsReindexing(true);
    try {
      const result = await reindexKnowledgeSource({ sourceId: source.id });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reindexed ${result.written} chunks.`);
      if (onDelete) onDelete();
    } finally {
      setIsReindexing(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <SourceIcon type={source.type} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-medium text-sm">{source.title}</h4>
              <StatusBadge status={source.status} />
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-muted-foreground text-xs">
              <span className="capitalize">{source.type}</span>
              {source.url && <span className="truncate">{new URL(source.url).hostname}</span>}
              {source.fileName && <span className="truncate">{source.fileName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReindex}
              disabled={isReindexing || isDeleting}
              title="Re-index this source"
              aria-label="Re-index this source"
            >
              {isReindexing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting || isReindexing}>
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <span className="size-4 cursor-pointer text-xs">✕</span>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AddWebsiteSourceDialog({ agentId, onSuccess }: { agentId?: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const workspaceId = await resolveWorkspaceId(agentId);
      const result = await addWebsiteSource({
        workspaceId,
        url: url.trim(),
        agentId,
      });

      if (result.error || !result.success || !result.source) {
        toast.error(result.error ?? "Failed to add website source.");
        setIsLoading(false);
        return;
      }

      const source = mapSource(result.source);

      if (source.status === "ready") {
        toast.success("Website source added successfully!");
      } else if (source.status === "failed") {
        toast.error(`Website source added but crawling failed: ${result.source.error_message ?? "unknown error"}`);
      } else {
        toast.success("Website source added. Crawling is in progress.");
      }
      setUrl("");
      setOpen(false);
      setIsLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message || "Failed to add website source.");
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Globe />
          Add Website
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add website source</DialogTitle>
          <DialogDescription>Enter a URL to crawl and extract content from.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source-url">Website URL</Label>
            <Input
              id="source-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={isLoading}
              maxLength={2048}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !url.trim()}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Add Website
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddTextSourceDialog({ agentId, onSuccess }: { agentId?: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 10) {
      toast.error("Content must be at least 10 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const workspaceId = await resolveWorkspaceId(agentId);
      const result = await addTextSource({
        workspaceId,
        title: title.trim(),
        content: content.trim(),
        agentId,
      });

      if (result.error || !result.success || !result.source) {
        toast.error(result.error ?? "Failed to add text source.");
        setIsLoading(false);
        return;
      }

      const source = mapSource(result.source);
      if (source.status === "failed") {
        toast.error(`Text source added but processing failed: ${result.source.error_message ?? "unknown error"}`);
      } else {
        toast.success("Text source added successfully!");
      }
      setTitle("");
      setContent("");
      setOpen(false);
      setIsLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message || "Failed to add text source.");
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText />
          Add Text
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add text source</DialogTitle>
          <DialogDescription>
            Paste text content directly. This will be chunked and made available to your AI agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text-title">Title</Label>
            <Input
              id="text-title"
              placeholder="e.g. Product Information"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isLoading}
              maxLength={256}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="text-content">Content</Label>
            <Textarea
              id="text-content"
              placeholder="Paste your content here... (minimum 10 characters)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              disabled={isLoading}
              rows={15}
              className="min-h-[300px] text-sm leading-relaxed"
              maxLength={50000}
            />
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Minimum 10 characters</span>
              <span>{content.length}/50,000 characters</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim() || content.trim().length < 10}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Add Text
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddDocumentSourceDialog({ agentId, onSuccess }: { agentId?: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Only PDF, DOCX, TXT, and CSV files are supported.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB.");
      return;
    }

    setFile(selectedFile);
    if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file.");
      return;
    }

    setIsLoading(true);

    try {
      const workspaceId = await resolveWorkspaceId(agentId);
      const formData = new FormData();
      formData.append("file", file);
      const result = await addDocumentSource(formData, workspaceId, agentId);

      if (result.error || !result.success || !result.source) {
        toast.error(result.error ?? "Failed to upload document.");
        setIsLoading(false);
        return;
      }

      const source = mapSource(result.source);
      if (source.status === "failed") {
        toast.error(`Document added but processing failed: ${result.source.error_message ?? "unknown error"}`);
      } else {
        toast.success(`"${file.name}" uploaded successfully!`);
      }
      setTitle("");
      setFile(null);
      setOpen(false);
      setIsLoading(false);
      if (onSuccess) onSuccess();
      fileInputRef.current?.setAttribute("value", "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message || "Failed to upload document.");
      setIsLoading(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Upload a PDF, DOCX, TXT, or CSV file. The content will be extracted and made available to your AI agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              placeholder="e.g. Product Manual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              maxLength={256}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-file">File (PDF, DOCX, TXT, CSV)</Label>
            <button
              type="button"
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 px-6 py-8 transition-colors hover:border-primary/50"
              onClick={openFilePicker}
              tabIndex={0}
            >
              {file ? (
                <div className="text-center">
                  <FileText className="mx-auto size-8 text-primary" />
                  <p className="mt-2 font-medium text-sm">{file.name}</p>
                  <p className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground text-sm">Click to upload or drag and drop</p>
                  <p className="text-muted-foreground text-xs">PDF, DOCX, TXT, CSV up to 10MB</p>
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              id="doc-file"
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !file}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddFaqSourceDialog({ agentId, onSuccess }: { agentId?: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [faqs, setFaqs] = useState([{ id: `faq-${Date.now()}`, question: "", answer: "" }]);
  const [isLoading, setIsLoading] = useState(false);

  function addFaq() {
    setFaqs([...faqs, { id: `faq-${Date.now()}`, question: "", answer: "" }]);
  }

  function removeFaq(index: number) {
    setFaqs(faqs.filter((_, i) => i !== index));
  }

  function updateFaq(index: number, field: "question" | "answer", value: string) {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (validFaqs.length === 0) {
      toast.error("Please add at least one FAQ.");
      return;
    }

    setIsLoading(true);

    try {
      const workspaceId = await resolveWorkspaceId(agentId);
      const result = await addFaqSource({
        workspaceId,
        title: title.trim() || "FAQ",
        faqs: validFaqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
        agentId,
      });

      if (result.error || !result.success || !result.source) {
        toast.error(result.error ?? "Failed to add FAQ source.");
        setIsLoading(false);
        return;
      }

      const source = mapSource(result.source);
      if (source.status === "failed") {
        toast.error(`FAQ source added but processing failed: ${result.source.error_message ?? "unknown error"}`);
      } else {
        toast.success(`${validFaqs.length} FAQs added successfully!`);
      }
      setTitle("");
      setFaqs([{ id: `faq-${Date.now()}`, question: "", answer: "" }]);
      setOpen(false);
      setIsLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message || "Failed to add FAQ source.");
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare />
          Add FAQ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add FAQ source</DialogTitle>
          <DialogDescription>Add frequently asked questions and their answers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="faq-title">Title</Label>
            <Input
              id="faq-title"
              placeholder="e.g. General FAQ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              maxLength={256}
            />
          </div>
          <div className="space-y-3">
            <Label>FAQs</Label>
            {faqs.map((faq, index) => (
              <div key={faq.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">FAQ {index + 1}</span>
                  {faqs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFaq(index)}
                      className="text-muted-foreground text-xs hover:text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Question"
                  value={faq.question}
                  onChange={(e) => updateFaq(index, "question", e.target.value)}
                  disabled={isLoading}
                />
                <Textarea
                  placeholder="Answer"
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, "answer", e.target.value)}
                  disabled={isLoading}
                  rows={2}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFaq}>
              + Add Another FAQ
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Add FAQs
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export async function loadKnowledgeSources(agentId: string, workspaceId: string): Promise<KnowledgeSource[]> {
  const result = await getAgentKnowledgeSources({ agentId, workspaceId });
  if (result.error || !result.success) {
    if (result.error) {
      console.error("Failed to load knowledge sources:", result.error);
    }
    return [];
  }
  return result.sources.map(mapSource);
}
