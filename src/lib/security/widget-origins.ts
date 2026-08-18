import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  return (
    process.env.ALLOWED_WIDGET_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0) ?? []
  );
}

/**
 * Returns the app's own origin (from NEXT_PUBLIC_APP_URL) when configured.
 * The widget iframe is served from this origin, so its same-origin requests
 * must always be permitted regardless of the third-party allow-list.
 */
function getAppOrigin(): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

function originMatches(origin: string, entry: string): boolean {
  if (entry.startsWith("*.")) {
    const domain = entry.slice(2);
    return origin === `https://${domain}` || origin.endsWith(`.${domain}`);
  }
  return origin === entry;
}

function isOriginAllowed(origin: string): boolean {
  const appOrigin = getAppOrigin();
  if (appOrigin && origin === appOrigin) return true;

  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return true;

  return allowed.some((entry) => originMatches(origin, entry));
}

/**
 * Returns true when the request's Origin header (if present) is permitted.
 * Requests without an Origin header are treated as same-origin / non-browser
 * and allowed (their responses get no CORS headers). The app's own origin is
 * always permitted so the embedded widget keeps working.
 */
export function isWidgetOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return isOriginAllowed(origin);
}

export function buildWidgetCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
