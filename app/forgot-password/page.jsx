"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

function isRateLimitError(message) {
  return (message || "").toLowerCase().includes("rate limit");
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sendResetLink = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = new URL("/reset-password", siteUrl).toString();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (resetError) {
        if (isRateLimitError(resetError.message)) {
          throw new Error(
            "Too many reset requests. Please wait and try again, or contact admin for a direct access link."
          );
        }
        throw resetError;
      }

      setSuccess("Password reset email sent. Check your inbox.");
      setEmail("");
    } catch (err) {
      setError(err?.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">Forgot Password</h1>
        <p className="text-gray-400 mt-2">
          Enter your email and we will send a reset link.
        </p>

        <form className="mt-6 space-y-4" onSubmit={sendResetLink}>
          <div>
            <label className="text-sm text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2.5 font-semibold"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-400">
          <Link href="/login" className="text-blue-400">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
