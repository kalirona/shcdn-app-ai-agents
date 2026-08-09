"use server";

import { cookies } from "next/headers";

import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
  path: "/",
  secure: isProduction,
  httpOnly: true,
  sameSite: "lax" as const,
};

export async function getValueFromCookie(key: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(key)?.value;
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number; httpOnly?: boolean } = {},
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    path: options.path ?? COOKIE_OPTIONS.path,
    maxAge: options.maxAge ?? 60 * 60 * 24 * 7,
    secure: COOKIE_OPTIONS.secure,
    httpOnly: options.httpOnly ?? COOKIE_OPTIONS.httpOnly,
    sameSite: COOKIE_OPTIONS.sameSite,
  });
}

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);

  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }

  const cookieStore = await cookies();
  return parsePreference(key, cookieStore.get(key)?.value.trim());
}
