"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      if (!roleData || !roleData.role) {
        window.location.href = "/login";
        return;
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    }
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return <div style={{ padding: 40 }}>Checking access...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center p-6 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <h1 className="font-bold">
          CSM Dashboard
        </h1>

        <div className="flex gap-4">
          <button
            onClick={logout}
            className="px-4 py-2 border rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}