import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Live deploy fingerprint — not a static file, so the service worker cannot
 * precache a stale buildId (that was defeating /version.json polling).
 */
export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";

  return NextResponse.json(
    {
      buildId,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      builtAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
