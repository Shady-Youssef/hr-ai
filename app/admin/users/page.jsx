"use client";

import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/export-users");
    const text = await res.text();
    console.log(text);
  };

  const inviteUser = async () => {
    await fetch("/api/admin/invite", {
      method: "POST",
      body: JSON.stringify({ email, role: "hr" }),
    });
    alert("Invitation sent");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

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
  );
}