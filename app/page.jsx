"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CandidateApplicationForm from "./components/CandidateApplicationForm";
import { supabase } from "./lib/supabase";

function QuickCard({ label, value, index }) {
  return (
    <div
      className="rounded-xl border border-gray-800 bg-[#111827] p-4 animate-riseIn"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function WorkspaceCard({ href, title, description, index }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-800 bg-[#111827] p-4 hover:border-blue-500 hover:-translate-y-0.5 transition animate-riseIn"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </Link>
  );
}

function TeamHome({ role }) {
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    reviewed: 0,
    hired: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const { data } = await supabase.from("candidates").select("status");

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

    const channel = supabase
      .channel("realtime-home-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const actions = useMemo(() => {
    const common = [
      {
        href: "/hr",
        title: "Form Builder",
        description: "Create and manage job application forms.",
      },
      {
        href: "/admin/candidates",
        title: "Candidates",
        description: "Review candidate status and AI evaluations.",
      },
      {
        href: "/admin/analytics",
        title: "Analytics",
        description: "Track funnel health and score trends.",
      },
    ];

    if (role === "admin") {
      return [
        ...common,
        {
          href: "/admin/users",
          title: "User Management",
          description: "Invite users, assign roles, and manage access.",
        },
      ];
    }

    return [
      ...common,
      {
        href: "/profile",
        title: "Profile & Preferences",
        description: "Update your profile, avatar, and workspace settings.",
      },
    ];
  }, [role]);

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-riseIn">
          <h1 className="text-3xl font-bold">Team Workspace</h1>
          <p className="text-gray-400 mt-2">
            Quick access to core recruiting workflows and live pipeline metrics.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickCard label="Total Candidates" value={stats.total} index={0} />
          <QuickCard label="Processing" value={stats.processing} index={1} />
          <QuickCard label="Reviewed" value={stats.reviewed} index={2} />
          <QuickCard label="Hired" value={stats.hired} index={3} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {actions.map((action, index) => (
            <WorkspaceCard
              key={action.title}
              href={action.href}
              title={action.title}
              description={action.description}
              index={index}
            />
          ))}
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
    return <TeamHome role={teamRole} />;
  }

  return <CandidateApplicationForm allowFormSelection />;
}
