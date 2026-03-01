"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const THEME_KEY = "hr-ai-theme";

function resolveInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function AppLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(resolveInitialTheme);
  const profileMenuRef = useRef(null);

  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme === "dark");
    root.classList.toggle("light", nextTheme === "light");
  };

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async (session) => {
      if (!session?.user) {
        if (isMounted) {
          setRole(null);
          setProfile(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsAuthenticated(true);
        }

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();

        if (isMounted) {
          if (roleData?.role) setRole(roleData.role);
          if (profileData) setProfile(profileData);
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) setLoading(false);
      }
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      loadUserData(session);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session);
    });

    const timeoutId = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;

    const onPointerDown = (event) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [profileOpen]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const showNav = role === "admin" || role === "hr";

  const navItems = useMemo(() => {
    const items = [{ path: "/", label: "Home" }];
    if (role === "admin") items.push({ path: "/admin", label: "Admin" });
    if (role === "admin" || role === "hr") {
      items.push({ path: "/hr", label: "Form Editor" });
      items.push({ path: "/admin/candidates", label: "Candidates" });
      items.push({ path: "/admin/analytics", label: "Analytics" });
    }
    return items;
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        Loading...
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen app-shell ${
        theme === "light" ? "text-slate-900" : "text-white"
      }`}
    >
      {showNav && (
        <header
          className={`sticky top-0 z-50 backdrop-blur-lg border-b transition-all duration-300 ${
            theme === "light"
              ? "bg-white/90 border-slate-200"
              : "bg-black/60 border-gray-800"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <Link href="/" className="font-bold text-lg hover:text-blue-500 transition-colors">
                CSM Dashboard
              </Link>
              <nav className="hidden md:flex items-center gap-4 lg:gap-6">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    prefetch
                    className={`relative px-3 py-2 text-sm font-medium transition ${
                      pathname === item.path
                        ? "text-blue-500"
                        : theme === "light"
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-gray-300 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {pathname === item.path && (
                      <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-blue-500 transition-all duration-300" />
                    )}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={toggleTheme}
                className={`rounded-full border w-9 h-9 flex items-center justify-center text-sm transition ${
                  theme === "light"
                    ? "border-slate-300 bg-slate-100 hover:bg-slate-200"
                    : "border-gray-700 bg-[#0b1220] hover:bg-[#162338]"
                }`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>

              {role && (
                <span
                  className={`hidden md:inline-block px-3 py-1 text-xs rounded-full ${
                    theme === "light"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {role.toUpperCase()}
                </span>
              )}

              {profile?.first_name && (
                <span
                  className={`hidden md:block text-sm font-medium ${
                    theme === "light" ? "text-slate-600" : "text-gray-300"
                  }`}
                >
                  {profile.first_name}
                </span>
              )}

              <div ref={profileMenuRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={`w-9 h-9 rounded-full transition flex items-center justify-center overflow-hidden cursor-pointer ${
                    theme === "light"
                      ? "bg-slate-200 hover:bg-slate-300"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>U</span>
                  )}
                </button>

                {profileOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-44 rounded-xl shadow-xl p-2 animate-fadeIn ${
                      theme === "light"
                        ? "bg-white border border-slate-200"
                        : "bg-[#1f2937] border border-gray-700"
                    }`}
                  >
                    <Link
                      href="/profile"
                      className={`block px-3 py-2 rounded-md transition text-sm ${
                        theme === "light" ? "hover:bg-slate-100" : "hover:bg-gray-700"
                      }`}
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={logout}
                      className={`w-full text-left px-3 py-2 rounded-md transition text-sm ${
                        theme === "light" ? "hover:bg-slate-100" : "hover:bg-gray-700"
                      }`}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              <button
                className="md:hidden text-xl px-1"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                ☰
              </button>
            </div>
          </div>

          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ${
              mobileOpen ? "max-h-72" : "max-h-0"
            }`}
          >
            <div
              className={`px-4 pb-4 flex flex-col gap-2 backdrop-blur-md ${
                theme === "light" ? "bg-white/95" : "bg-black/80"
              }`}
            >
              {navItems.map((item) => (
                <Link
                  key={`mobile-${item.path}`}
                  href={item.path}
                  prefetch
                  className={`relative px-3 py-2 text-sm font-medium transition ${
                    pathname === item.path
                      ? "text-blue-500"
                      : theme === "light"
                        ? "text-slate-600 hover:text-slate-900"
                        : "text-gray-300 hover:text-white"
                  }`}
                >
                  {item.label}
                  {pathname === item.path && (
                    <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-blue-500 transition-all duration-300" />
                  )}
                </Link>
              ))}
              <Link
                href="/profile"
                className={`text-left text-sm px-3 py-1 ${
                  theme === "light" ? "text-slate-700" : "text-gray-300"
                }`}
              >
                Profile Settings
              </Link>
              <button
                onClick={logout}
                className="text-left text-sm text-red-400 mt-1 px-3 py-1"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {!showNav && isAuthenticated && (
        <button
          onClick={toggleTheme}
          className={`fixed top-4 right-4 z-40 rounded-full border w-10 h-10 flex items-center justify-center text-sm transition shadow-lg ${
            theme === "light"
              ? "border-slate-300 bg-white hover:bg-slate-100"
              : "border-gray-700 bg-[#0b1220] hover:bg-[#162338]"
          }`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      )}

      <main className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
