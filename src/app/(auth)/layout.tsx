import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Valeo Experience | Account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "linear-gradient(160deg, #2A4A1A 0%, #3D6B24 100%)" }}
      >
        {/* Logo */}
        <div>
          <span
            className="text-white text-2xl"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            The Valeo Experience
          </span>
          <p className="text-teal-light text-sm mt-1 tracking-widest uppercase">
            Digital Health Platform
          </p>
        </div>

        {/* Quote */}
        <div>
          <blockquote
            className="text-white text-3xl leading-snug mb-6"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            "Healing is not a destination. It is a journey we take together."
          </blockquote>
          <p className="text-white/50 text-sm">— Dr. Jozelle M. Miller, PhD</p>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-xs">
          © 2026 The Valeo Experience · All Rights Reserved
        </p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
}
