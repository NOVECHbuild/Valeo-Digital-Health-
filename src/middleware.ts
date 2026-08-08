import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Best-effort role from JWT custom claim (no verify — APIs still use requireAuth). */
function roleFromJwt(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { role?: string; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function resolveRole(request: NextRequest): string | null {
  const cookieRole = request.cookies.get("valeo_role")?.value;
  if (cookieRole) {
    try { return decodeURIComponent(cookieRole); } catch { return cookieRole; }
  }
  const token =
    request.cookies.get("__session")?.value ||
    request.cookies.get("token")?.value;
  return roleFromJwt(token);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow onboarding through ──────────────────────────────────────
  if (pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("__session")?.value ||
    request.cookies.get("token")?.value;

  // ── Protect dashboard routes ──────────────────────────────────────────────
  const protectedPaths = ["/client", "/doctor", "/admin"];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Role gate (defense-in-depth; Firestore rules + requireAuth remain primary) ─
  if (isProtected && token) {
    const role = resolveRole(request);
    if (role) {
      if (pathname.startsWith("/admin") && role !== "admin") {
        const home =
          role === "doctor" ? "/doctor" : role === "client" ? "/client" : "/login";
        return NextResponse.redirect(new URL(home, request.url));
      }
      if (pathname.startsWith("/doctor") && role !== "doctor" && role !== "admin") {
        const home = role === "client" ? "/client" : "/login";
        return NextResponse.redirect(new URL(home, request.url));
      }
      if (pathname.startsWith("/client") && role !== "client" && role !== "admin") {
        const home = role === "doctor" ? "/doctor" : "/login";
        return NextResponse.redirect(new URL(home, request.url));
      }
    }
  }

  // ── Auth pages: don't block if user has token ─────────────────────────────
  const authPaths = ["/login", "/register"];
  const isAuthPage = authPaths.some(p => pathname.startsWith(p));
  if (isAuthPage && token) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/client/:path*",
    "/doctor/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/onboarding/:path*",
  ],
};
