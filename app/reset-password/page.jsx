"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function isStrongPassword(password) {
  if (password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const initializeRecoveryFlow = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hasRecoveryContext =
          Boolean(code) ||
          url.searchParams.get("type") === "recovery" ||
          url.hash.includes("type=recovery");

        if (!hasRecoveryContext) {
          setError(
            "This page is only available from a valid password recovery link."
          );
          setLoadingSession(false);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            code
          );
          if (exchangeError) {
            setError(exchangeError.message);
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setError(
            "Invalid or expired recovery link. Please request a new reset email."
          );
        }
      } catch (err) {
        setError(err?.message || "Failed to validate recovery link");
      } finally {
        setLoadingSession(false);
      }
    };

    initializeRecoveryFlow();
  }, []);

  const updatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password || !confirmPassword) {
      setError("Please fill both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isStrongPassword(password)) {
      setError(
        "Password must be at least 8 characters and include letters and numbers."
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setSuccess("Password updated successfully. Redirecting to login...");
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err?.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-6 py-12">
      <div className="max-w-md mx-auto rounded-2xl border border-gray-800 bg-[#111827] p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <p className="text-gray-400 mt-2">
          Enter your new password to finish recovery.
        </p>

        {loadingSession ? (
          <p className="mt-6 text-gray-300">Validating recovery link...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={updatePassword}>
            <div>
              <label className="text-sm text-gray-300">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
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
              disabled={submitting || loadingSession}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2.5 font-semibold"
            >
              {submitting ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm text-gray-400">
          <Link href="/login" className="text-blue-400">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
