"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return null;
  }

  return { email, password };
}

function authRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function safeAuthError() {
  return "We could not sign you in. Check your email and password, then try again.";
}

export async function login(formData: FormData) {
  const credentials = readCredentials(formData);
  if (!credentials) authRedirect("/login", "error", "Email and password are required.");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) authRedirect("/login", "error", safeAuthError());
  redirect("/dashboard");
}
