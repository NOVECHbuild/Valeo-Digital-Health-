import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#F2F8EA" }}
    >
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-4"
        style={{ color: "#8DC63F" }}
      >
        Valeo Experience
      </p>
      <h1
        className="text-4xl mb-3"
        style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
      >
        Page not found
      </h1>
      <p className="text-sm mb-8 max-w-md" style={{ color: "#58595B" }}>
        That link doesn&apos;t match anything on the site. Head home or sign in if you have an account.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
        >
          Back to homepage
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.2)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
