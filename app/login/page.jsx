"use client";

import { Container } from "../components/ContainerComponent";
import { Card } from "../components/CardComponent";

import { useState } from "react";
import { supabase } from "../../app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault(); // 🔥 Enter support

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("Invalid credentials. Please try again.");
      setLoading(false);
    } else {
      router.push("/admin/candidates");
    }
  };

  return (
    <Container>
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] px-6">

        <div className="w-full max-w-xl">

          <Card className="bg-[#111827] border border-gray-800 rounded-3xl p-12 shadow-xl transition-all duration-500 hover:shadow-[0_0_60px_rgba(59,130,246,0.25)] animate-fadeIn">

            <form onSubmit={handleLogin} className="space-y-8">

              <div className="text-center space-y-3">
                <h1 className="text-4xl font-extrabold text-white tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-gray-400">
                  Sign in to access the recruitment dashboard
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-6">

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-4 rounded-xl bg-[#1f2937] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all duration-300"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 pr-20 rounded-xl bg-[#1f2937] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all duration-300"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-[46px] text-sm text-gray-400 hover:text-blue-400 transition"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    Forgot password?
                  </Link>
                </div>

              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Login"}
              </button>

            </form>

          </Card>

        </div>
      </div>

      {/* Animation */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>

    </Container>
  );
}
