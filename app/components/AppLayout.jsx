"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(resolveInitialTheme);

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
          setLoading(false);
        }
        return;
      }

      try {
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

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const showNav = role === "admin" || role === "hr";

  const navItems = useMemo(() => {
    const items = [{ path: "/", label: "Home" }];
    if (role === "admin") items.push({ path: "/admin", label: "Admin" });
    if (role === "admin" || role === "hr") {
      items.push({ path: "/hr", label: "HR" });
      items.push({ path: "/admin/candidates", label: "Candidates" });
      items.push({ path: "/admin/analytics", label: "Analytics" });
    }
    return items;
  }, [role]);

  const navItem = (path, label) => (
    <Link
      href={path}
      prefetch
      className={`relative px-3 py-2 text-sm font-medium transition ${
        pathname === path ? "text-blue-500" : "text-gray-300 hover:text-white"
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
    <div className="min-h-screen app-shell text-white">
      {showNav && (
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/60 border-b border-gray-800 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <span className="font-bold text-lg">CSM Dashboard</span>
              <nav className="hidden md:flex items-center gap-4 lg:gap-6">
                {navItems.map((item) => navItem(item.path, item.label))}
              </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={toggleTheme}
                className="rounded-full border border-gray-700 bg-[#0b1220] hover:bg-[#162338] w-9 h-9 flex items-center justify-center text-sm transition"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>

              {role && (
                <span className="hidden md:inline-block px-3 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                  {role.toUpperCase()}
                </span>
              )}

              {profile?.first_name && (
                <span className="hidden md:block text-sm font-medium text-gray-300">
                  {profile.first_name}
                </span>
              )}

              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 transition flex items-center justify-center overflow-hidden cursor-pointer"
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
                  <div className="absolute right-0 mt-2 w-44 bg-[#1f2937] border border-gray-700 rounded-xl shadow-xl p-2 animate-fadeIn">
                    <Link
                      href="/profile"
                      className="block px-3 py-2 rounded-md hover:bg-gray-700 transition text-sm"
                    >
                      Profile Settings
                    </Link>
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
            <div className="px-4 pb-4 flex flex-col gap-2 bg-black/80 backdrop-blur-md">
              {navItems.map((item) => navItem(item.path, item.label))}
              <Link href="/profile" className="text-left text-sm text-gray-300 px-3 py-1">
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

      {!showNav && (
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-40 rounded-full border border-gray-700 bg-[#0b1220] hover:bg-[#162338] w-10 h-10 flex items-center justify-center text-sm transition shadow-lg"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      )}

      <main className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
