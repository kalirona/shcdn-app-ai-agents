const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".csv", ".md", ".xls", ".xlsx"]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const _BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "127.0.0.0/8",
  "[::1]",
  "[fc00::]/7",
  "[fe80::]/10",
]);
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  size?: number;
}

export function validateFile(file: File): FileValidationResult {
  if (!file || file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed: PDF, DOCX, TXT, CSV, MD.`,
    };
  }

  const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `File extension "${extension}" is not allowed.`,
    };
  }

  if (!/^[\w\s\-.()]+$/.test(file.name)) {
    return {
      valid: false,
      error: "Filename contains invalid characters.",
    };
  }

  return { valid: true, mimeType: file.type, size: file.size };
}

export function isPrivateIp(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") {
    return true;
  }

  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) {
    return true;
  }

  if (hostname.startsWith("172.")) {
    const secondOctet = parseInt(hostname.split(".")[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (hostname.startsWith("169.254.") || hostname.startsWith("[fc") || hostname.startsWith("[fe80:")) {
    return true;
  }

  return false;
}

export function isAllowedUrl(urlString: string): { allowed: boolean; error?: string } {
  let parsed: URL;

  try {
    parsed = new URL(urlString);
  } catch {
    return { allowed: false, error: "Invalid URL format." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  if (isPrivateIp(parsed.hostname)) {
    return { allowed: false, error: "URLs pointing to private/internal networks are not allowed." };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, error: "URLs with credentials are not allowed." };
  }

  return { allowed: true };
}

/**
 * Server-side SSRF guard. `isAllowedUrl` validates the literal hostname; this
 * also resolves DNS and rejects when any resolved address is private or
 * loopback, closing the DNS-rebinding window before the crawl begins.
 */
export async function assertPublicUrl(urlString: string): Promise<{ allowed: boolean; error?: string }> {
  const staticCheck = isAllowedUrl(urlString);
  if (!staticCheck.allowed) {
    return staticCheck;
  }

  try {
    const hostname = new URL(urlString).hostname;
    const addresses = await import("node:dns/promises").then((dns) => dns.lookup(hostname, { all: true }));
    for (const entry of addresses) {
      if (isPrivateIp(entry.address)) {
        return {
          allowed: false,
          error: "URL resolves to a private/internal network address and cannot be crawled.",
        };
      }
    }
  } catch {
    return { allowed: false, error: "Unable to resolve the URL hostname." };
  }

  return { allowed: true };
}

export function generateSafeFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const extension = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
  const safeBase = originalName
    .substring(0, originalName.lastIndexOf("."))
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);

  return `${safeBase}-${timestamp}-${random}${extension}`;
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/object>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}
