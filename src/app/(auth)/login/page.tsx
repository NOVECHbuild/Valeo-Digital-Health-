"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email:    z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router   = useRouter();
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginFormData) {
    setError(null);
    setLoading(true);

    try {
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const { user } = userCredential;

      // 2. Set session cookie so middleware allows access to protected routes
      const idToken = await user.getIdToken();
      document.cookie = `__session=${idToken}; path=/; max-age=3600; SameSite=Strict`;

      // 3. Read role from Firestore (not custom claims)
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role     = userData.role as string;

        // 4. If client hasn't onboarded yet, send them there first
        if (role === "client" && userData.onboarded === false) {
          router.push("/onboarding");
          return;
        }

        // 5. Redirect to correct dashboard based on role
        if (role === "admin")       router.push("/admin");
        else if (role === "doctor") router.push("/doctor");
        else                        router.push("/client");

      } else {
        // No Firestore doc — default to client dashboard
        router.push("/client");
      }

    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password. Please try again.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">

      {/* Back to website link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs mb-8 hover:opacity-70 transition-opacity"
        style={{ color: "#8A9BA8" }}
      >
        ← Back to website
      </Link>

      {/* Mobile logo */}
      <div className="lg:hidden mb-8">
        <span
          className="text-2xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
        >
          The Valeo Experience
        </span>
      </div>

      <h1
        className="text-4xl mb-2"
        style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
      >
        Welcome back
      </h1>
      <p className="text-slate-500 mb-8">
        Sign in to your account to continue your journey.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email address
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:border-transparent
                       transition-all placeholder:text-slate-400"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs hover:underline"
              style={{ color: "#8DC63F" }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            {...register("password")}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:border-transparent
                       transition-all placeholder:text-slate-400"
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-6 rounded-lg text-white font-semibold text-sm
                     transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: loading ? "#8A9BA8" : "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

      </form>

      {/* Register link */}
      <p className="text-center text-sm text-slate-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold hover:underline"
          style={{ color: "#2A4A1A" }}
        >
          Create one
        </Link>
      </p>

      {/* Return to homepage */}
      <p className="text-center text-xs mt-4">
        <Link
          href="/"
          className="hover:underline"
          style={{ color: "#8A9BA8" }}
        >
          ← Return to valeoexperience.com
        </Link>
      </p>

    </div>
  );
}
