"use client";

import { useRef, useState } from "react";

import { CheckCheck, Code, Copy, FileText, Globe, Loader2, MessageSquare, Upload } from "lucide-react";
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
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getStoredSources(): KnowledgeSource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("agent_ai_knowledge_sources");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSources(sources: KnowledgeSource[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("agent_ai_knowledge_sources", JSON.stringify(sources));
}

function StatusBadge({ status }: { status: KnowledgeSource["status"] }) {
  const config = {
    pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    processing: { label: "Processing", color: "text-blue-600 bg-blue-50 border-blue-200" },
    ready: { label: "Ready", color: "text-green-600 bg-green-50 border-green-200" },
    failed: { label: "Failed", color: "text-red-600 bg-red-50 border-red-200" },
  };

  const { label, color } = config[status];
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

  function handleDelete() {
    setIsDeleting(true);
    const sources = getStoredSources().filter((s) => s.id !== source.id);
    saveSources(sources);
    toast.success("Knowledge source deleted.");
    if (onDelete) onDelete();
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
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4 cursor-pointer text-xs">✕</span>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AddWebsiteSourceDialog({ agentId }: { agentId?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const source: KnowledgeSource = {
      id: generateId(),
      workspace: "workspace-1",
      agent: agentId ?? null,
      type: "website",
      title: new URL(url).hostname,
      url,
      fileName: null,
      status: "ready",
      chunkCount: Math.floor(Math.random() * 20) + 5,
      dateCreated: new Date().toISOString(),
    };

    const sources = getStoredSources();
    sources.push(source);
    saveSources(sources);

    toast.success("Website source added successfully!");
    setUrl("");
    setOpen(false);
    setIsLoading(false);
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
          <DialogDescription>
            Enter a URL to crawl and extract content from.
          </DialogDescription>
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 10) {
      toast.error("Content must be at least 10 characters.");
      return;
    }

    setIsLoading(true);

    const source: KnowledgeSource = {
      id: generateId(),
      workspace: "workspace-1",
      agent: agentId ?? null,
      type: "text",
      title: title.trim(),
      url: null,
      fileName: null,
      status: "ready",
      chunkCount: Math.ceil(content.length / 1000),
      dateCreated: new Date().toISOString(),
      content: content.trim(),
    };

    const sources = getStoredSources();
    sources.push(source);
    saveSources(sources);

    toast.success("Text source added successfully!");
    setTitle("");
    setContent("");
    setOpen(false);
    setIsLoading(false);
    if (onSuccess) onSuccess();
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file.");
      return;
    }

    setIsLoading(true);

    const source: KnowledgeSource = {
      id: generateId(),
      workspace: "workspace-1",
      agent: agentId ?? null,
      type: "document",
      title: title.trim() || file.name,
      url: null,
      fileName: file.name,
      status: "ready",
      chunkCount: Math.floor(file.size / 1000),
      dateCreated: new Date().toISOString(),
    };

    const sources = getStoredSources();
    sources.push(source);
    saveSources(sources);

    toast.success(`"${file.name}" uploaded successfully!`);
    setTitle("");
    setFile(null);
    setOpen(false);
    setIsLoading(false);
    if (onSuccess) onSuccess();
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 px-6 py-8 transition-colors hover:border-primary/50"
              onClick={() => fileInputRef.current?.click()}
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
            </div>
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
  const [faqs, setFaqs] = useState([{ question: "", answer: "" }]);
  const [isLoading, setIsLoading] = useState(false);

  function addFaq() {
    setFaqs([...faqs, { question: "", answer: "" }]);
  }

  function removeFaq(index: number) {
    setFaqs(faqs.filter((_, i) => i !== index));
  }

  function updateFaq(index: number, field: "question" | "answer", value: string) {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (validFaqs.length === 0) {
      toast.error("Please add at least one FAQ.");
      return;
    }

    setIsLoading(true);

    const content = validFaqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

    const source: KnowledgeSource = {
      id: generateId(),
      workspace: "workspace-1",
      agent: agentId ?? null,
      type: "faq",
      title: title.trim() || "FAQ",
      url: null,
      fileName: null,
      status: "ready",
      chunkCount: validFaqs.length,
      dateCreated: new Date().toISOString(),
      content,
    };

    const sources = getStoredSources();
    sources.push(source);
    saveSources(sources);

    toast.success(`${validFaqs.length} FAQs added successfully!`);
    setTitle("");
    setFaqs([{ question: "", answer: "" }]);
    setOpen(false);
    setIsLoading(false);
    if (onSuccess) onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare />
          Add FAQ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add FAQ source</DialogTitle>
          <DialogDescription>
            Add frequently asked questions and their answers.
          </DialogDescription>
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
              <div key={index} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">FAQ {index + 1}</span>
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

export function getKnowledgeSourcesForAgent(agentId: string): KnowledgeSource[] {
  return getStoredSources().filter((s) => s.agent === agentId);
}
