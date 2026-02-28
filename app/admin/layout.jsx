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

      const { data: profileRoleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      let role = profileRoleData?.role;

      if (!role) {
        const { data: userRoleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", userData.user.id)
          .maybeSingle();
        role = userRoleData?.role;
      }

      if (!role) {
        window.location.href = "/";
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
