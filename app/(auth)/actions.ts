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

function safeAuthError(context: "login" | "signup") {
  return context === "login"
    ? "We could not sign you in. Check your email and password, then try again."
    : "We could not create your account. Check your details or try a different email address.";
}

export async function login(formData: FormData) {
  const credentials = readCredentials(formData);
  if (!credentials) authRedirect("/login", "error", "Email and password are required.");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) authRedirect("/login", "error", safeAuthError("login"));
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const credentials = readCredentials(formData);
  if (!credentials) authRedirect("/signup", "error", "Email and password are required.");
  if (credentials.password.length < 8) {
    authRedirect("/signup", "error", "Password must be at least 8 characters.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) authRedirect("/signup", "error", safeAuthError("signup"));
  if (!data.session) {
    authRedirect("/login", "message", "Check your email to confirm your account, then log in.");
  }

  redirect("/dashboard");
}
