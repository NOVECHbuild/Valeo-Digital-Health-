"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSent(true);
    } catch {
      setError("Could not send reset email. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
          style={{ background: "rgba(141,198,63,0.15)" }}
        >
          ✉️
        </div>
        <h1
          className="text-3xl mb-3"
          style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
        >
          Check your email
        </h1>
        <p className="text-slate-500 mb-2">
          We sent a password reset link to
        </p>
        <p className="font-semibold text-ocean mb-8" style={{ color: "#2A4A1A" }}>
          {getValues("email")}
        </p>
        <p className="text-xs text-slate-400 mb-8">
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <button
            onClick={() => setSent(false)}
            className="underline text-slate-500"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="text-sm font-semibold hover:underline"
          style={{ color: "#2A4A1A" }}
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1
        className="text-4xl mb-2"
        style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
      >
        Reset your password
      </h1>
      <p className="text-slate-500 mb-8">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-6 rounded-lg text-white font-semibold text-sm
                     transition-all duration-200 disabled:opacity-60"
          style={{ background: loading ? "#8A9BA8" : "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        <Link
          href="/login"
          className="font-semibold hover:underline"
          style={{ color: "#2A4A1A" }}
        >
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
