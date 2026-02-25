"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminLayout({ children }) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Checking access...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}