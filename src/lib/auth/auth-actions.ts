"use server";

import { redirect } from "next/navigation";

import { handleSignIn, signIn, signOut } from "@logto/next/server-actions";

import { logtoConfig } from "./logto-config";

export async function signInAction() {
  await signIn(logtoConfig, `${logtoConfig.baseUrl}/callback`);
}

export async function signOutAction() {
  await signOut(logtoConfig, `${logtoConfig.baseUrl}/`);
}

export async function signUpAction() {
  await signIn(logtoConfig, `${logtoConfig.baseUrl}/callback?interaction-mode=sign-up`);
}

export async function callbackAction() {
  const url = new URL(`${logtoConfig.baseUrl}/callback`);
  await handleSignIn(logtoConfig, url);
  redirect("/dashboard");
}
