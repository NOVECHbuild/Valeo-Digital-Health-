"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#F2F8EA" }}
    >
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-4"
        style={{ color: "#F7941D" }}
      >
        Something went wrong
      </p>
      <h1
        className="text-3xl mb-3"
        style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
      >
        We hit a snag
      </h1>
      <p className="text-sm mb-8 max-w-md" style={{ color: "#58595B" }}>
        Please try again. If it keeps happening, return home and sign back in.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.2)" }}
        >
          Homepage
        </Link>
      </div>
    </div>
  );
}
