import { cache } from "react";

import { cookies } from "next/headers";

import { DIRECTUS_ACCESS_TOKEN_SKEW_MS, DIRECTUS_SESSION_COOKIE, DIRECTUS_SESSION_EXP_COOKIE } from "./provider";
import type { User } from "./types";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Directus authentication client (server-only).
 *
 * Owns every Directus /auth/* call and the encrypted httpOnly session cookie.
 * It is the single place the application talks to Directus for authentication;
 * workspace/platform authorization stays behind the existing getAuthContext().
 *
 * IMPORTANT: never import this module from the Edge runtime (middleware). It
 * uses node:crypto and next/headers cookies. The middleware only checks for
 * the presence of DIRECTUS_SESSION_COOKIE.
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL ?? "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days (Directus refresh TTL default)
const ACCESS_TOKEN_SKEW_MS = DIRECTUS_ACCESS_TOKEN_SKEW_MS; // refresh 30s before the token actually expires
export interface DirectusAuthTokens {
  access_token: string;
  expires: number; // milliseconds (Directus returns ms, e.g. 900000 = 15min)
  refresh_token: string;
}

export interface DirectusUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  force_password_reset: boolean | null;
}

interface DirectusSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
}

function requireDirectusUrl(): string {
  if (!DIRECTUS_URL) {
    throw new Error("DIRECTUS_URL must be set when AUTH_PROVIDER=directus.");
  }
  return DIRECTUS_URL;
}

function requireSessionSecret(): string {
  if (!SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET must be set when AUTH_PROVIDER=directus. Run `openssl rand -base64 32` to generate one.",
    );
  }
  return SESSION_SECRET;
}

// --- Directus REST calls ---------------------------------------------------

interface DirectusErrorResponse {
  errors?: { message?: string; extensions?: { code?: string } }[];
}

async function directusRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${requireDirectusUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const err = body as DirectusErrorResponse | undefined;
    const code = err?.errors?.[0]?.extensions?.code;
    const message =
      err?.errors?.[0]?.message ?? `Directus ${init.method ?? "GET"} ${path} failed with status ${response.status}.`;
    const error = new Error(message) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = code;
    throw error;
  }

  return (body as { data: T }).data;
}

export async function directusLogin(email: string, password: string): Promise<DirectusAuthTokens> {
  return directusRequest<DirectusAuthTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function directusRefresh(refreshToken: string): Promise<DirectusAuthTokens> {
  return directusRequest<DirectusAuthTokens>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
  });
}

export async function directusLogout(refreshToken: string): Promise<void> {
  await directusRequest<undefined>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
  });
}

export async function directusGetCurrentUser(accessToken: string): Promise<DirectusUser> {
  // Authenticate against /users/me (always returns at least the user id, even
  // for role-less users whose field permissions hide their own profile).
  const me = await directusRequest<{ id: string }>("/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Resolve the full profile via the app's static service token. A Directus
  // user without a role (or whose role lacks read on directus_users) cannot
  // read their own email/name from /users/me; the app needs those fields, and
  // the static token (already used for all data reads) has full read access.
  if (!DIRECTUS_TOKEN) {
    throw new Error("DIRECTUS_TOKEN must be set to resolve the authenticated user profile.");
  }
  return directusRequest<DirectusUser>(
    `/users/${me.id}?fields=id,email,first_name,last_name,status,force_password_reset`,
    { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } },
  );
}

export interface DirectusCreateUserInput {
  email: string;
  password: string;
  name: string;
}

/**
 * Creates a Directus user (self-service registration). Uses the static service
 * token. The returned id can be used to resolve the profile and to assign
 * application resources (e.g. a personal workspace) after signup.
 */
export async function directusCreateUser(input: DirectusCreateUserInput): Promise<{ id: string }> {
  if (!DIRECTUS_TOKEN) {
    throw new Error("DIRECTUS_TOKEN must be set to create a Directus user.");
  }
  const [first_name, last_name] = input.name.trim().split(/\s+/, 2);
  return directusRequest<{ id: string }>("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      status: "active",
    }),
  });
}

/**
 * Changes the current user's password and clears the force_password_reset flag.
 * Uses the user's access token for the password change, then the static token
 * to clear the flag.
 */
export async function changeUserPassword(accessToken: string, newPassword: string): Promise<void> {
  if (!DIRECTUS_TOKEN) {
    throw new Error("DIRECTUS_TOKEN must be set to clear force_password_reset.");
  }

  // First, get the current user's ID via /users/me
  const me = await directusRequest<{ id: string }>("/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Change password using the user's access token (PATCH /users/me)
  await directusRequest<void>("/users/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });

  // Clear the force_password_reset flag using the static admin token
  await directusRequest<void>(`/users/${me.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force_password_reset: false }),
  });
}

// --- Encrypted session cookie ---------------------------------------------

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Effective session lifetime in seconds, derived from the admin-configured
 * session_timeout_hours setting (falls back to the 7-day Directus default).
 * Capped at the Directus refresh-token TTL so the encrypted cookie never
 * outlives the underlying refresh token.
 */
async function getSessionMaxAgeSeconds(): Promise<number> {
  try {
    const { getPlatformSettings } = await import("@/lib/db/repositories/platform-settings.repo");
    const settings = await getPlatformSettings();
    const hours = settings?.session_timeout_hours ?? 24;
    const seconds = Math.max(1, hours) * 60 * 60;
    return Math.min(seconds, SESSION_MAX_AGE_SECONDS);
  } catch {
    return SESSION_MAX_AGE_SECONDS;
  }
}

function getCipherKey(): Buffer {
  return createHash("sha256").update(requireSessionSecret()).digest();
}

function encryptSession(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptSession(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getCipherKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function toAppUser(user: DirectusUser): User {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null;
  return {
    id: user.id,
    email: user.email,
    name,
    avatar: null,
    forcePasswordReset: user.force_password_reset ?? false,
  };
}

async function writeSessionCookie(session: DirectusSession): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = await getSessionMaxAgeSeconds();
  cookieStore.set(DIRECTUS_SESSION_COOKIE, encryptSession(JSON.stringify(session)), { ...COOKIE_OPTIONS, maxAge });
  cookieStore.set(DIRECTUS_SESSION_EXP_COOKIE, String(session.accessTokenExpiresAt), { ...COOKIE_OPTIONS, maxAge });
}

export async function clearDirectusSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DIRECTUS_SESSION_COOKIE);
  cookieStore.delete(DIRECTUS_SESSION_EXP_COOKIE);
}

async function readSession(): Promise<DirectusSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DIRECTUS_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const decrypted = decryptSession(raw);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted) as DirectusSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Directus rotates refresh tokens on every /auth/refresh: the previous token is
// invalidated the moment a new one is issued. Refresh happens exclusively in the
// /api/auth/session route handler, but a single page load (and its RSC
// prefetches) can redirect several requests there concurrently, all carrying the
// same near-expiry session. If two of them refresh with the same token at the
// same time, the first wins and rotates it; the second gets a 401 — and without
// a safeguard would clear the session, logging the user out or leaving a blank /
// redirecting dashboard.
//
// Two-layer guard keyed by the *old* refresh token:
//   1. In-flight promise dedupe — concurrent calls share one rotation.
//   2. Short-TTL result cache — a request that arrives after the rotation
//      completed still carries the old token and reuses the rotated session
//      instead of re-refreshing (which would 401).
const inFlightRefreshes = new Map<string, Promise<DirectusAuthTokens>>();
const refreshCache = new Map<string, { tokens: DirectusAuthTokens; at: number }>();
const REFRESH_CACHE_TTL_MS = 30_000;

async function refreshSession(session: DirectusSession): Promise<DirectusSession | null> {
  const cached = refreshCache.get(session.refreshToken);
  if (cached && Date.now() - cached.at < REFRESH_CACHE_TTL_MS) {
    const next: DirectusSession = {
      accessToken: cached.tokens.access_token,
      refreshToken: cached.tokens.refresh_token,
      accessTokenExpiresAt: Date.now() + cached.tokens.expires,
      user: session.user,
    };
    await writeSessionCookie(next);
    return next;
  }

  let inFlight = inFlightRefreshes.get(session.refreshToken);
  if (!inFlight) {
    inFlight = directusRefresh(session.refreshToken)
      .then((tokens) => {
        refreshCache.set(session.refreshToken, { tokens, at: Date.now() });
        return tokens;
      })
      .finally(() => {
        inFlightRefreshes.delete(session.refreshToken);
      });
    inFlightRefreshes.set(session.refreshToken, inFlight);
  }

  try {
    const tokens = await inFlight;
    const next: DirectusSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: Date.now() + tokens.expires,
      user: session.user,
    };
    await writeSessionCookie(next);
    return next;
  } catch {
    return null;
  }
}

/**
 * Resolves the current Directus session from the encrypted cookie. PURE READ:
 * never writes, deletes, or refreshes the cookie here — cookie mutation is only
 * allowed in a Server Action or Route Handler in Next.js. Near-expiry sessions
 * are refreshed by the /api/auth/session Route Handler (the edge proxy redirects
 * to it via the companion expiry cookie); invalid cookies are cleared there too.
 *
 * Returns null when there is no usable session.
 */
export const getDirectusSession = cache(async function getDirectusSession(): Promise<DirectusSession | null> {
  const cookieStore = await cookies();
  const hasCookie = Boolean(cookieStore.get(DIRECTUS_SESSION_COOKIE)?.value);
  if (!hasCookie) return null;

  const session = await readSession();
  if (!session) return null;

  return session;
});

/**
 * Returns the current Directus user (verified against /users/me), or null when
 * the session is missing or invalid. PURE READ: never writes cookies during
 * render. Token rotation is delegated to the /api/auth/session Route Handler;
 * a 401 here simply means "unauthenticated" for this request (the proxy already
 * redirected near-expiry sessions to the refresh handler).
 */
export const getCurrentDirectusUser = cache(async function getCurrentDirectusUser(): Promise<DirectusUser | null> {
  const session = await getDirectusSession();
  if (!session) return null;

  if (Date.now() >= session.accessTokenExpiresAt - ACCESS_TOKEN_SKEW_MS) {
    return null;
  }

  try {
    return await directusGetCurrentUser(session.accessToken);
  } catch {
    return null;
  }
});

/**
 * Session revalidation used by the /api/auth/session Route Handler (the proxy
 * redirects near-expiry sessions here, and layouts redirect when a cookie is
 * present but the user cannot be resolved). Cookie mutation is allowed in these
 * contexts, unlike during Server Component render. Always rotates the access
 * token when a session exists (keeping the cookie fresh), and clears the session
 * when none can be produced (the token's refresh credential died or the cookie
 * is garbage), which ends any redirect loop.
 */
export async function revalidateDirectusSession(): Promise<"ok" | "cleared"> {
  const session = await readSession();
  if (!session) {
    await clearDirectusSession();
    return "cleared";
  }

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    await clearDirectusSession();
    return "cleared";
  }
  return "ok";
}

/**
 * Logs into Directus, establishes the encrypted session cookie, and returns
 * the authenticated application user. Throws on invalid credentials.
 */
export async function loginWithDirectus(email: string, password: string): Promise<User> {
  const tokens = await directusLogin(email, password);
  const directusUser = await directusGetCurrentUser(tokens.access_token);

  const session: DirectusSession = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: Date.now() + tokens.expires,
    user: toAppUser(directusUser),
  };
  await writeSessionCookie(session);

  return toAppUser(directusUser);
}

/**
 * Invalidates the Directus session and clears the application cookie.
 * The remote logout is best-effort (Directus returns 204 even for unknown
 * refresh tokens); the local cookie is always cleared.
 */
export async function signOutFromDirectus(): Promise<void> {
  const session = await readSession();
  if (session?.refreshToken) {
    try {
      await directusLogout(session.refreshToken);
    } catch {
      // best effort — the cookie is cleared regardless
    }
  }
  await clearDirectusSession();
}
