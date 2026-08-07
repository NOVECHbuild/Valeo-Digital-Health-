"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Role } from "@/types/user";

interface AuthContextValue {
  user:    User | null;
  role:    Role | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  role:    null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [role,    setRole]    = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Read role and onboarding status from Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const userRole = data.role as Role;
          setRole(userRole);

          // Route based on role and onboarding status
          const currentPath = window.location.pathname;
          const onDashboard = ["/client", "/doctor", "/admin"].some(p =>
            currentPath.startsWith(p)
          );
          const onOnboarding = currentPath.startsWith("/onboarding");
          const onAuth = ["/login", "/register"].some(p =>
            currentPath.startsWith(p)
          );

          if (userRole === "client" && data.onboarded === false && !onOnboarding) {
            // New client — send to onboarding (full load so shell layouts paint correctly)
            window.location.assign("/onboarding");
          } else if (onAuth && !currentPath.startsWith("/register")) {
            // Already logged in on login page — hard nav to dashboard
            if (userRole === "admin") window.location.assign("/admin");
            else if (userRole === "doctor") window.location.assign("/doctor");
            else window.location.assign("/client");
          }
        }

        // Set session cookie for middleware
        const idToken = await firebaseUser.getIdToken();
        document.cookie = `__session=${idToken}; path=/; max-age=3600; SameSite=Strict`;

      } else {
        setUser(null);
        setRole(null);
        document.cookie = "__session=; path=/; max-age=0";
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
