"use server";

import { signIn, signOut } from "@logto/next/server-actions";

import { logtoConfig } from "./logto-config";

export async function signInAction() {
  await signIn(logtoConfig, `${logtoConfig.baseUrl}/callback`);
}

export async function signOutAction() {
  await signOut(logtoConfig, `${logtoConfig.baseUrl}/`);
}

export async function signUpAction() {
  await signIn(logtoConfig, `${logtoConfig.baseUrl}/callback`, "signUp");
}
