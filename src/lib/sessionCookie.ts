/** Client-side helpers for the middleware session cookie. */

const MAX_AGE = 60 * 60; // 1 hour — matches Firebase ID token lifetime

export function setSessionCookie(idToken: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";
  document.cookie = `__session=${idToken}; path=/; max-age=${MAX_AGE}; SameSite=Strict${secure}`;
}

export function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "__session=; path=/; max-age=0";
  document.cookie = "valeo_role=; path=/; max-age=0";
}

/** Role hint for edge middleware (Firestore role + custom claims). Not a security boundary — APIs still use requireAuth. */
export function setRoleCookie(role: string | null | undefined) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";
  if (!role) {
    document.cookie = `valeo_role=; path=/; max-age=0`;
    return;
  }
  document.cookie = `valeo_role=${encodeURIComponent(role)}; path=/; max-age=${MAX_AGE}; SameSite=Strict${secure}`;
}
