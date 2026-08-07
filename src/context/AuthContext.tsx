"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Role } from "@/types/user";

interface AuthContextValue {
  user:        User | null;
  role:        Role | null;
  loading:     boolean;
  /** Firestore users/{uid}.displayName — stays fresh when profile is edited */
  displayName: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user:        null,
  role:        null,
  loading:     true,
  displayName: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [role,        setRole]        = useState<Role | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let profileUnsub: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      profileUnsub?.();
      profileUnsub = undefined;

      if (firebaseUser) {
        setUser(firebaseUser);
        setDisplayName(firebaseUser.displayName ?? null);

        // Live profile — keeps shell greetings in sync after Firestore name edits
        profileUnsub = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data.role) setRole(data.role as Role);
          if (typeof data.displayName === "string" && data.displayName.trim()) {
            setDisplayName(data.displayName.trim());
          }
        });

        // One-shot for routing / onboarding (avoid race with first snapshot)
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const userRole = data.role as Role;
          setRole(userRole);
          if (typeof data.displayName === "string" && data.displayName.trim()) {
            setDisplayName(data.displayName.trim());
          }

          const currentPath = window.location.pathname;
          const onOnboarding = currentPath.startsWith("/onboarding");
          const onAuth = ["/login", "/register"].some(p =>
            currentPath.startsWith(p)
          );

          if (userRole === "client" && data.onboarded === false && !onOnboarding) {
            window.location.assign("/onboarding");
          } else if (onAuth && !currentPath.startsWith("/register")) {
            if (userRole === "admin") window.location.assign("/admin");
            else if (userRole === "doctor") window.location.assign("/doctor");
            else window.location.assign("/client");
          }
        }

        const idToken = await firebaseUser.getIdToken();
        document.cookie = `__session=${idToken}; path=/; max-age=3600; SameSite=Strict`;

      } else {
        setUser(null);
        setRole(null);
        setDisplayName(null);
        document.cookie = "__session=; path=/; max-age=0";
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
      profileUnsub?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, displayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
