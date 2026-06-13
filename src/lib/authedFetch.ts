"use client";

import { auth } from "@/lib/firebase";

// fetch() wrapper that attaches the current user's Firebase ID token as a
// Bearer token, so protected API routes can verify the caller. Falls back to
// a plain request if no user is signed in (the route will then 401).
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
