import { getPayPalBaseUrl, getPayPalClientId, getPayPalClientSecret } from "./config";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Fetches a PayPal OAuth access token (client_credentials), caching it until
 * just before expiry so we don't hammer the token endpoint on every call.
 * The token is never exposed outside the server runtime.
 */
export async function getPayPalAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const clientId = getPayPalClientId();
  const clientSecret = getPayPalClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_NOT_CONFIGURED");
  }

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PayPal OAuth failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("PayPal OAuth returned no access token");
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 32400) - 60) * 1000,
  };

  // Only used for authenticated requests later, never logged or returned to clients.
  return data.access_token;
}

export class PayPalApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown,
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}

interface PayPalRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Authenticated JSON request to the PayPal REST API. Handles JSON encoding,
 * bearer auth, and error normalisation. Never returns raw credentials.
 */
export async function paypalApi<T>(pathname: string, options: PayPalRequestOptions = {}): Promise<T> {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${getPayPalBaseUrl()}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new PayPalApiError(`PayPal API error (${response.status})`, response.status, data);
  }

  return data as T;
}

/** Clears the cached token so a configuration change takes effect immediately. */
export function resetPayPalAccessToken(): void {
  cachedAccessToken = null;
}
