"use server";

import { callbackAction } from "@/lib/auth/auth-actions";

export default async function CallbackPage() {
  await callbackAction();
  return null;
}
