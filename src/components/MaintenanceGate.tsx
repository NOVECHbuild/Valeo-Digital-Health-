"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Wrench } from "lucide-react";

/**
 * When settings/platform.maintenanceMode is on, non-admins are held on a
 * simple maintenance screen (admins keep full access).
 */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      setMaintenance(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "settings", "platform"),
      (snap) => setMaintenance(!!snap.data()?.maintenanceMode),
      () => setMaintenance(false),
    );
    return () => unsub();
  }, [user, authLoading]);

  // Admins (or anyone) who open /maintenance while mode is off → send home
  useEffect(() => {
    if (authLoading || pathname !== "/maintenance") return;
    if (!maintenance || role === "admin") {
      if (role === "admin") router.replace("/admin");
      else if (role === "doctor") router.replace("/doctor");
      else if (role === "client") router.replace("/client");
      else if (!user) router.replace("/");
    }
  }, [authLoading, pathname, maintenance, role, user, router]);

  const block =
    !!user &&
    !authLoading &&
    maintenance &&
    role !== "admin" &&
    !pathname.startsWith("/maintenance") &&
    !pathname.startsWith("/login");

  if (block) {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
}

export function MaintenanceScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)" }}
    >
      <div
        className="max-w-md w-full rounded-3xl p-8 sm:p-10 text-center"
        style={{ background: "white", boxShadow: "0 20px 60px rgba(42,74,26,0.25)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(247,148,29,0.12)" }}
        >
          <Wrench size={28} style={{ color: "#F7941D" }} />
        </div>
        <h1
          className="text-2xl mb-2"
          style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
        >
          We&apos;ll be right back
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#8A9BA8" }}>
          Valeo is undergoing brief maintenance. Your data is safe — please try again shortly.
          If you need urgent support, email{" "}
          <a href="mailto:support@valeoexperience.com" style={{ color: "#2A4A1A" }}>
            support@valeoexperience.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
