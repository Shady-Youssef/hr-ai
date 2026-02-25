"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      if (roleData?.role) {
        setRole(roleData.role);
      }

      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const showNav =
    role === "admin" || pathname.startsWith("/admin");

  const navItem = (path, label) => (
    <Link
      href={path}
      className={`relative px-3 py-2 text-sm font-medium transition ${
        pathname === path
          ? "text-blue-500"
          : "text-gray-300 hover:text-white"
      }`}
    >
      {label}
      {pathname === path && (
        <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-blue-500 transition-all duration-300" />
      )}
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">

      {showNav && (
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/60 border-b border-gray-800 transition-all duration-300">

          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

            <div className="flex items-center gap-6">
              <span className="font-bold text-lg">
                CSM Dashboard
              </span>

              <nav className="hidden md:flex items-center gap-6">
                {navItem("/", "Home")}
                {navItem("/admin", "Admin")}
                {navItem("/admin/candidates", "Candidates")}
                {navItem("/admin/analytics", "Analytics")}
              </nav>
            </div>

            <div className="flex items-center gap-4">

              {role && (
                <span className="hidden md:inline-block px-3 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                  {role.toUpperCase()}
                </span>
              )}

              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 transition flex items-center justify-center"
                >
                  👤
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-[#1f2937] border border-gray-700 rounded-xl shadow-xl p-2 animate-fadeIn">
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition text-sm"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              <button
                className="md:hidden text-xl"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                ☰
              </button>

            </div>
          </div>

          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ${
              mobileOpen ? "max-h-60" : "max-h-0"
            }`}
          >
            <div className="px-6 pb-4 flex flex-col gap-3 bg-black/80 backdrop-blur-md">
              {navItem("/", "Home")}
              {navItem("/admin", "Admin")}
              {navItem("/admin/candidates", "Candidates")}
              {navItem("/admin/analytics", "Analytics")}

              <button
                onClick={logout}
                className="text-left text-sm text-red-400 mt-2"
              >
                Logout
              </button>
            </div>
          </div>

        </header>
      )}

      <main className="p-6">
        {children}
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out;
        }
      `}</style>

    </div>
  );
}