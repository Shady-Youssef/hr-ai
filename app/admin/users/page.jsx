"use client";

import { useCallback, useEffect, useState } from "react";

const ROLE_OPTIONS = ["candidate", "hr", "admin"];
const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyByUser, setBusyByUser] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("candidate");
  const [inviting, setInviting] = useState(false);

  const [toast, setToast] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [passwordUserEmail, setPasswordUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const setUserBusy = (userId, busy) => {
    setBusyByUser((prev) => ({ ...prev, [userId]: busy }));
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        role: roleFilter,
      });

      const res = await fetch(`/api/admin/list-users?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load users");
      }

      setUsers(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalUsers(data.total || 0);
    } catch (err) {
      showToast("error", err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(id);
  }, [fetchUsers]);

  const inviteUser = async () => {
    if (!inviteEmail.trim()) {
      showToast("error", "Please enter an email.");
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole || "candidate",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = [data?.error, data?.details, data?.hint]
          .filter(Boolean)
          .join(" | ");
        throw new Error(message || "Invitation failed");
      }

      setInviteEmail("");
      setInviteRole("candidate");
      if (data?.mode === "existing_user_reset") {
        showToast(
          "success",
          "User already existed. Password setup/reset email sent."
        );
      } else {
        showToast("success", "Invitation sent successfully.");
      }
      fetchUsers();
    } catch (err) {
      showToast("error", err.message || "Invitation failed");
    } finally {
      setInviting(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUserId(user.id);
    setEditFirstName(user.first_name || "");
    setEditLastName(user.last_name || "");
    setEditPhone(user.phone || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingUserId) return;
    setSavingEdit(true);

    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUserId,
          first_name: editFirstName,
          last_name: editLastName,
          phone: editPhone,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update user");
      }

      setEditOpen(false);
      showToast("success", "User profile updated.");
      fetchUsers();
    } catch (err) {
      showToast("error", err.message || "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const changeRole = async (userId, currentRole, nextRole) => {
    if (nextRole === currentRole) return;

    if (!window.confirm(`Change role from ${currentRole} to ${nextRole}?`)) {
      fetchUsers();
      return;
    }

    setUserBusy(userId, true);
    try {
      const res = await fetch("/api/admin/change-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to change role");
      }

      showToast("success", "Role updated.");
      fetchUsers();
    } catch (err) {
      showToast("error", err.message || "Failed to change role");
      fetchUsers();
    } finally {
      setUserBusy(userId, false);
    }
  };

  const sendResetPassword = async (userId, email) => {
    if (!email) {
      showToast("error", "User has no email");
      return;
    }

    if (!window.confirm(`Send password reset email to ${email}?`)) return;

    setUserBusy(userId, true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to send reset email");
      }

      showToast("success", "Reset email sent.");
    } catch (err) {
      showToast("error", err.message || "Failed to send reset email");
    } finally {
      setUserBusy(userId, false);
    }
  };

  const openPasswordModal = (user) => {
    setPasswordUserId(user.id);
    setPasswordUserEmail(user.email || "");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordOpen(true);
  };

  const setPassword = async () => {
    if (!passwordUserId) return;
    if (newPassword.length < 8) {
      showToast("error", "Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showToast("error", "Password must include letters and numbers.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("error", "Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: passwordUserId, password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to set password");
      }

      setPasswordOpen(false);
      showToast("success", "Password updated successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to set password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-400 mt-1">
              Manage invites, roles, profile details, and passwords.
            </p>
          </div>
          <a
            href="/api/admin/export-users"
            className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Export CSV
          </a>
        </div>

        <section className="bg-[#111827] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">Invite User</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="md:col-span-2 rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              onClick={inviteUser}
              disabled={inviting}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 font-medium"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </section>

        <section className="bg-[#111827] border border-gray-800 rounded-2xl p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by email or name..."
              className="flex-1 rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value);
              }}
              className="w-full md:w-48 rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
            >
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0b1220] text-gray-300">
                <tr>
                  <th className="text-left px-3 py-3">Email</th>
                  <th className="text-left px-3 py-3">First Name</th>
                  <th className="text-left px-3 py-3">Last Name</th>
                  <th className="text-left px-3 py-3">Phone</th>
                  <th className="text-left px-3 py-3">Role</th>
                  <th className="text-left px-3 py-3">Created</th>
                  <th className="text-left px-3 py-3">Updated</th>
                  <th className="text-left px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-800">
                      <td className="px-3 py-3">{user.email || "-"}</td>
                      <td className="px-3 py-3">{user.first_name || "-"}</td>
                      <td className="px-3 py-3">{user.last_name || "-"}</td>
                      <td className="px-3 py-3">{user.phone || "-"}</td>
                      <td className="px-3 py-3">
                        <select
                          value={user.role || "candidate"}
                          onChange={(e) =>
                            changeRole(user.id, user.role, e.target.value)
                          }
                          disabled={busyByUser[user.id]}
                          className="rounded-md border border-gray-700 bg-[#0b1220] px-2 py-1 text-sm"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-gray-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-3 py-3 text-gray-400">
                        {formatDate(user.updated_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            disabled={busyByUser[user.id]}
                            className="rounded-md bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => sendResetPassword(user.id, user.email)}
                            disabled={busyByUser[user.id]}
                            className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                          >
                            Reset Email
                          </button>
                          <button
                            onClick={() => openPasswordModal(user)}
                            disabled={busyByUser[user.id]}
                            className="rounded-md bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                          >
                            Set Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 text-sm">
            <span className="text-gray-400">
              {totalUsers} users, page {page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">Edit User</h3>
            <div className="grid grid-cols-1 gap-3">
              <input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="First name"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Last name"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Phone"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">Set Password</h3>
            <p className="text-sm text-gray-400">
              Set a new password for <strong>{passwordUserEmail || "-"}</strong>
            </p>
            <div className="grid grid-cols-1 gap-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPasswordOpen(false)}
                className="rounded-lg border border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={setPassword}
                disabled={savingPassword}
                className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 px-4 py-2"
              >
                {savingPassword ? "Updating..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
