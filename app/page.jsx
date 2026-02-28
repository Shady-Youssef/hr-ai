"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CandidateApplicationForm from "./components/CandidateApplicationForm";
import { supabase } from "./lib/supabase";

function QuickCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function TeamHome() {
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    reviewed: 0,
    hired: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const { data } = await supabase
        .from("candidates")
        .select("status");

      const list = data || [];
      setStats({
        total: list.length,
        processing: list.filter((c) => c.status === "Processing").length,
        reviewed: list.filter((c) =>
          ["Reviewed", "Shortlisted", "Rejected", "Failed"].includes(c.status)
        ).length,
        hired: list.filter((c) => c.status === "Hired").length,
      });
    };

    loadStats();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Team Workspace</h1>
          <p className="text-gray-400 mt-2">
            Quick access to forms, candidates, analytics, and user operations.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickCard label="Total Candidates" value={stats.total} />
          <QuickCard label="Processing" value={stats.processing} />
          <QuickCard label="Reviewed" value={stats.reviewed} />
          <QuickCard label="Hired" value={stats.hired} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/hr"
            className="rounded-xl border border-gray-800 bg-[#111827] p-4 hover:border-blue-500 transition"
          >
            <p className="font-semibold">Form Builder</p>
            <p className="text-sm text-gray-400 mt-1">
              Create and manage job application forms.
            </p>
          </Link>

          <Link
            href="/admin/candidates"
            className="rounded-xl border border-gray-800 bg-[#111827] p-4 hover:border-blue-500 transition"
          >
            <p className="font-semibold">Candidates</p>
            <p className="text-sm text-gray-400 mt-1">
              Review candidate status and results.
            </p>
          </Link>

          <Link
            href="/admin/analytics"
            className="rounded-xl border border-gray-800 bg-[#111827] p-4 hover:border-blue-500 transition"
          >
            <p className="font-semibold">Analytics</p>
            <p className="text-sm text-gray-400 mt-1">
              Track funnel and score trends.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="rounded-xl border border-gray-800 bg-[#111827] p-4 hover:border-blue-500 transition"
          >
            <p className="font-semibold">User Management</p>
            <p className="text-sm text-gray-400 mt-1">
              Invite, edit roles, and manage access.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [teamRole, setTeamRole] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      if (!session?.user) {
        setTeamRole(null);
        setReady(true);
        return;
      }

      const { data: profileRoleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      let role = profileRoleData?.role || null;

      if (!role) {
        const { data: userRoleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        role = userRoleData?.role || null;
      }

      setTeamRole(role);
      setReady(true);
    };

    loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (teamRole === "admin" || teamRole === "hr") {
    return <TeamHome />;
  }

  return <CandidateApplicationForm allowFormSelection />;
}
