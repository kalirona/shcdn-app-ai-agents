/**
 * PHASE 4.3B verification — crypto fail-closed behavior, api-key policy rules,
 * and Gemini header auth (no ?key= in URLs).
 *
 * Run inside a node container against the repo mount:
 *   npx tsx scripts/ai-crypto-verify.ts
 * Exits 0 only when every check passes.
 */

import { assertCreatableSecret, isBlankSecret, resolveApiKeyPatch } from "../src/lib/ai/api-key-policy";
import { decryptApiKey, encryptApiKey } from "../src/lib/ai/crypto";
import { discoverModels } from "../src/lib/ai/discovery";
import { createServer } from "node:http";

let failures = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS  ${name}`))
    .catch((e: unknown) => {
      failures += 1;
      console.log(`FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
    });
}

function expectThrows(fn: () => unknown, needle?: string): void {
  try {
    fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (needle && !msg.includes(needle)) {
      throw new Error(`threw, but message lacks "${needle}": ${msg}`);
    }
    // Secret-free error assertion: none of the inputs we use in this suite are
    // real secrets, but the pattern proves errors never echo arguments.
    if (/supersecret|plaintext-key/.test(msg)) {
      throw new Error("error message leaked secret material");
    }
    return;
  }
  throw new Error("expected throw, got none");
}

const KEY = "unit-test-passphrase-0123456789abcdef";

async function main(): Promise<void> {
  // A. Missing encryption key -> clear failure on encrypt
  delete process.env.AI_API_KEY_ENCRYPTION_KEY;
  await check("A. missing key: encrypt fails clearly", () => {
    expectThrows(() => encryptApiKey("x"), "AI_API_KEY_ENCRYPTION_KEY must be set");
  });
  await check("A2. missing key: decrypt fails closed", () => {
    expectThrows(() => decryptApiKey("AAAA"), "AI_API_KEY_ENCRYPTION_KEY");
  });

  // B/C. Valid key: encrypt + roundtrip
  process.env.AI_API_KEY_ENCRYPTION_KEY = KEY;
  let ciphertext = "";
  await check("B. valid key: encrypts successfully", () => {
    ciphertext = encryptApiKey("plaintext-key-value");
    if (!ciphertext || ciphertext.includes("plaintext-key-value")) {
      throw new Error("ciphertext empty or echoes plaintext");
    }
  });
  await check("C. roundtrip decrypts to original", () => {
    if (decryptApiKey(ciphertext) !== "plaintext-key-value") throw new Error("mismatch");
  });

  // D. Invalid (different) key -> fails closed
  await check("D. wrong key: decrypt fails closed", async () => {
    process.env.AI_API_KEY_ENCRYPTION_KEY = "a-different-passphrase";
    await new Promise((r) => setTimeout(r, 10));
    expectThrows(() => decryptApiKey(ciphertext), "Failed to decrypt API key");
    process.env.AI_API_KEY_ENCRYPTION_KEY = KEY;
    await new Promise((r) => setTimeout(r, 10));
  });

  // E. Corrupted ciphertext -> fails closed
  await check("E. corrupted ciphertext: fails closed", () => {
    const buf = Buffer.from(ciphertext, "base64url");
    buf[buf.length - 1] ^= 0xff;
    expectThrows(() => decryptApiKey(buf.toString("base64url")), "Failed to decrypt API key");
    expectThrows(() => decryptApiKey("not-a-ciphertext"), "Failed to decrypt API key");
  });

  // F/G. Policy rules
  await check("F. blank submitted key keeps existing (empty patch)", () => {
    if (Object.keys(resolveApiKeyPatch("", encryptApiKey)).length !== 0) throw new Error("blank not stripped");
    if (Object.keys(resolveApiKeyPatch("   ", encryptApiKey)).length !== 0) throw new Error("whitespace not stripped");
    if (Object.keys(resolveApiKeyPatch(null, encryptApiKey)).length !== 0) throw new Error("null not stripped");
    const out = resolveApiKeyPatch("new-secret", encryptApiKey);
    if (!out.apiKey || out.apiKey.includes("new-secret")) throw new Error("non-blank not encrypted");
  });
  await check("F2. isBlankSecret semantics", () => {
    if (!isBlankSecret("") || !isBlankSecret("  ") || !isBlankSecret(null) || !isBlankSecret(undefined)) {
      throw new Error("blank detection wrong");
    }
    if (isBlankSecret("k")) throw new Error("non-blank flagged");
  });
  await check("G. create: required key enforced (non-ollama)", () => {
    expectThrows(() => assertCreatableSecret("openai", ""), "An API key is required");
    expectThrows(() => assertCreatableSecret("openrouter", null), "An API key is required");
    expectThrows(() => assertCreatableSecret("gemini", "   "), "An API key is required");
    if (assertCreatableSecret("ollama", "").apiKey !== null) throw new Error("ollama should allow missing");
    if (assertCreatableSecret("openai", "  sk-test  ").apiKey !== "sk-test") throw new Error("trim failed");
  });

  // H. Gemini discovery uses secure header, never ?key=
  await check("H. gemini discovery: key in header, not URL", async () => {
    let seenUrl = "";
    let seenAuthHeader = "";
    let seenGoogleHeader = "";
    const server = createServer((req, res) => {
      seenUrl = req.url ?? "";
      seenAuthHeader = String(req.headers.authorization ?? "");
      seenGoogleHeader = String(req.headers["x-goog-api-key"] ?? "");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ models: [{ name: "models/gemini-2.0-flash" }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    try {
      const result = await discoverModels({
        id: "test",
        provider_key: "gemini",
        name: "Gemini",
        type: "gemini",
        api_key: "g-key-123",
        base_url: `http://127.0.0.1:${addr.port}/v1beta`,
        enabled: true,
        priority: 0,
        default_model: "",
        capabilities: ["chat"],
        status: "untested",
        last_tested_at: null,
        last_error: null,
        discoverable: true,
        input_cost_per_million: null,
        output_cost_per_million: null,
      } as Parameters<typeof discoverModels>[0]);
      if (!seenUrl.startsWith("/v1beta/models")) throw new Error(`unexpected path: ${seenUrl}`);
      if (seenUrl.includes("key=")) throw new Error(`key leaked in URL: ${seenUrl}`);
      if (seenAuthHeader) throw new Error("unexpected authorization header for gemini native endpoint");
      if (seenGoogleHeader !== "g-key-123") throw new Error("missing x-goog-api-key header");
      if (result.models[0]?.modelId !== "gemini-2.0-flash") throw new Error("parse failed");
    } finally {
      server.close();
    }
  });

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
