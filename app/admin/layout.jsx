"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../app/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    };

    checkUser();
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checking) return <p className="p-10">Checking session...</p>;

  return (
    <div>
      <div className="flex justify-between items-center p-5 bg-gray-200 dark:bg-gray-900">
        <h3 className="font-bold">CSM Dashboard</h3>

        <div className="flex gap-4">
          <button
            onClick={() => setDark(!dark)}
            className="px-3 py-1 border rounded"
          >
            {dark ? "Light Mode" : "Dark Mode"}
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1 border rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}