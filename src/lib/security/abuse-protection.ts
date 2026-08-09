export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  status: "success" | "failure" | "warning";
}

const AUDIT_STORAGE_KEY = "agent_ai_audit_logs";

export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  const logs = getAuditLogs();
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newEntry);
  if (logs.length > 1000) logs.slice(0, 1000);
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
}

export interface AbuseProtectionResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 10,
  windowMs: number = 60000,
): AbuseProtectionResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    addAuditLog({
      userId: "system",
      action: "rate_limit_exceeded",
      resource: identifier,
      details: `Rate limit exceeded. Retry after ${retryAfter}s`,
      ipAddress: "localhost",
      status: "warning",
    });
    return {
      allowed: false,
      reason: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    };
  }

  entry.count += 1;
  return { allowed: true };
}

export function validateInput(input: string, maxLength: number = 10000): { valid: boolean; error?: string } {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Input cannot be empty." };
  }
  if (input.length > maxLength) {
    return { valid: false, error: `Input exceeds maximum length of ${maxLength} characters.` };
  }
  if (/<script|javascript:|on\w+\s*=/i.test(input)) {
    return { valid: false, error: "Input contains potentially malicious content." };
  }
  return { valid: true };
}

export function sanitizeOutput(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function detectPromptInjection(input: string): { safe: boolean; reason?: string } {
  const suspiciousPatterns = [
    /ignore (all |previous )?(instructions|rules|prompts)/i,
    /you are now/i,
    /system prompt/i,
    /reveal your (instructions|prompt|rules)/i,
    /read this document and execute/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      addAuditLog({
        userId: "system",
        action: "prompt_injection_detected",
        resource: "chat",
        details: `Suspicious input detected: ${input.slice(0, 100)}`,
        ipAddress: "localhost",
        status: "warning",
      });
      return { safe: false, reason: "Suspicious input detected." };
    }
  }

  return { safe: true };
}
