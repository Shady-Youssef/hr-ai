"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [email, setEmail] = useState("");

  async function fetchUsers() {
    const res = await fetch("/api/admin/export-users");
    const text = await res.text();
    console.log(text);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const inviteUser = async () => {
    if (!email.trim()) {
      alert("Please enter an email.");
      return;
    }

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "hr" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Invitation failed");
      return;
    }

    alert("Invitation sent");
    setEmail("");
  };

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto rounded-2xl p-6 md:p-10">
        <h1 className="text-3xl font-bold mb-6">Admin</h1>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">User Management</h2>

          <div className="mb-6 flex gap-4">
            <input
              className="border p-2 rounded text-black"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={inviteUser}
              className="bg-blue-600 px-4 py-2 rounded"
            >
              Send Invitation
            </button>

            <a
              href="/api/admin/export-users"
              className="bg-green-600 px-4 py-2 rounded"
            >
              Export CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
