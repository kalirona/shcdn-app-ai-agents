/**
 * Temporary Phase 2 Directus auth verification test.
 *
 * Validates the exact Directus /auth/* flows the new abstraction relies on,
 * against the live instance. Uses credentials from env so no secrets are
 * committed. Read-only: only logs in/out with the provided credentials and
 * never mutates data.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts-tests.json scripts/test-directus-auth.ts
 * Requires DIRECTUS_URL (from .env.local) and optionally:
 *   DIRECTUS_TEST_EMAIL + DIRECTUS_TEST_PASSWORD (for a real login/refresh test)
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const fileEnv = loadEnvFile(path.resolve(process.cwd(), ".env.local"));
const base = (process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "").replace(/\/$/, "");
const email = process.env.DIRECTUS_TEST_EMAIL ?? "";
const password = process.env.DIRECTUS_TEST_PASSWORD ?? "";

let failures = 0;

function assert(ok: boolean, label: string) {
  if (ok) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label}`);
  }
}

function has(status: number, good: number[]) {
  return good.includes(status);
}

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  let body: unknown;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  console.log("=== Directus Auth Verification ===\n");
  if (!base) {
    console.error("ERROR: DIRECTUS_URL required");
    process.exit(1);
  }
  console.log(`Directus: ${base}`);

  // 1. /users/me requires a bearer token (401 without one)
  console.log("\n-- Unauthenticated access --");
  const noToken = await call("/users/me");
  assert(noToken.status === 401, "/users/me without token -> 401 (rejected)");

  // 2. invalid login rejected
  console.log("\n-- Invalid login --");
  const bad = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "nobody@example.com", password: "wrongpass" }),
  });
  assert(has(bad.status, [401, 400]), `bad credentials -> ${bad.status} (rejected)`);

  // 3. valid login + session + me + refresh + logout
  if (email && password) {
    console.log("\n-- Valid login --");
    const login = await call("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    assert(login.status === 200, `login -> ${login.status}`);
    const tokens = (login.body as { data?: { access_token?: string; refresh_token?: string; expires?: number } })?.data;
    assert(!!tokens?.access_token, "login returns access_token");
    assert(!!tokens?.refresh_token, "login returns refresh_token");
    assert(typeof tokens?.expires === "number" && tokens.expires > 0, "login returns expires (milliseconds; Directus uses ms)");
    const accessToken = tokens?.access_token;
    const refreshToken = tokens?.refresh_token;

    if (accessToken && refreshToken) {
      const me = await call("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = me.body as { data?: { id?: string; email?: string } };
      assert(me.status === 200 && !!meData.data?.id, "/users/me with access_token -> 200 + user id");

      const refresh = await call("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
      });
      const refData = (refresh.body as { data?: { access_token?: string } })?.data;
      assert(refresh.status === 200 && !!refData?.access_token, "/auth/refresh -> new access_token");

      const logout = await call("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
      });
      assert(logout.status === 204, `/auth/logout -> ${logout.status}`);

      const afterLogout = await call("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
      assert(has(afterLogout.status, [200, 401]), `/users/me after logout -> ${afterLogout.status} (token may be revoked)`);
    }
  } else {
    console.log("\n  (skipped valid-login test - set DIRECTUS_TEST_EMAIL + DIRECTUS_TEST_PASSWORD to enable)");
  }

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();