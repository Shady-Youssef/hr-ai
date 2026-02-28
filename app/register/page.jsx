"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function isStrongPassword(password) {
  if (password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

export default function RegisterPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const initializeInviteFlow = async () => {
      try {
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        if (existingSession?.user) {
          setEmail(existingSession.user.email || "");
          setLoadingSession(false);
          return;
        }

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const queryType = url.searchParams.get("type");
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );
        const hashType = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const flowType = queryType || hashType;
        let resolved = false;

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            code
          );
          if (exchangeError) {
            throw exchangeError;
          }
          resolved = true;
        }

        if (!resolved && tokenHash && ["invite", "signup", "magiclink"].includes(flowType || "")) {
          const otpType = flowType === "invite" ? "invite" : "signup";
          const { error: otpError } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (otpError) {
            throw otpError;
          }
          resolved = true;
        }

        if (!resolved && accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            throw setSessionError;
          }
          resolved = true;
        }

        if (!resolved) {
          throw new Error("This page is only available from a valid invite link.");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setError(
            "Invalid or expired invite link. Please request a new invitation."
          );
          setLoadingSession(false);
          return;
        }

        setEmail(session.user.email || "");
        window.history.replaceState({}, "", "/register");
      } catch (err) {
        setError(err?.message || "Failed to validate invitation");
      } finally {
        setLoadingSession(false);
      }
    };

    initializeInviteFlow();
  }, []);

  const completeRegistration = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password || !confirmPassword) {
      setError("Please fill all required fields.");
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Session expired. Please use a new invite link.");
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      });
      if (passwordError) throw passwordError;

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            first_name: firstName || "",
            last_name: lastName || "",
            phone: phone || "",
            role: existingProfile?.role || "candidate",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;

      setSuccess("Registration complete. Redirecting to login...");
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err?.message || "Failed to complete registration");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-6 py-12">
      <div className="max-w-xl mx-auto rounded-2xl border border-gray-800 bg-[#111827] p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">Complete Your Registration</h1>
        <p className="text-gray-400 mt-2">
          This page is for invited users to set their password and profile.
        </p>

        {loadingSession ? (
          <p className="mt-6 text-gray-300">Validating invitation...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={completeRegistration}>
            <div>
              <label className="text-sm text-gray-300">Email</label>
              <input
                value={email}
                disabled
                className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2 text-gray-300"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300">Password</label>
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
              {submitting ? "Saving..." : "Complete Registration"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm text-gray-400">
          Already have access? <Link href="/login" className="text-blue-400">Login</Link>
        </div>
      </div>
    </div>
  );
}
