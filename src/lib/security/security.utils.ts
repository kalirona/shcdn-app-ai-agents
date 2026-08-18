import { randomBytes, timingSafeEqual } from "node:crypto";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCsrfToken(token: string, storedToken: string): boolean {
  const tokenBuffer = Buffer.from(token);
  const storedBuffer = Buffer.from(storedToken);

  if (tokenBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, storedBuffer);
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 256;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function generateSecureId(): string {
  return randomBytes(16).toString("hex");
}
