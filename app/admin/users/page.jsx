"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const ROLE_OPTIONS = ["candidate", "hr", "admin"];
const PAGE_SIZE = 10;

function getInitialConfirmDialog() {
  return {
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    confirmLabelBusy: "Working...",
    onConfirm: null,
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyByUser, setBusyByUser] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [toast, setToast] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);

  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "candidate",
    passwordMethod: "invite",
    password: "",
    confirmPassword: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState(getInitialConfirmDialog);
  const [confirmLoading, setConfirmLoading] = useState(false);

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

  const actionMenuStyle = useMemo(() => {
    if (!actionMenu) return {};

    const menuWidth = 220;
    const menuHeight = 230;
    const left = Math.max(
      8,
      Math.min(actionMenu.left, window.innerWidth - menuWidth - 8)
    );
    const top = Math.max(
      8,
      Math.min(actionMenu.top, window.innerHeight - menuHeight - 8)
    );

    return { left, top };
  }, [actionMenu]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const setUserBusy = (userId, busy) => {
    setBusyByUser((prev) => ({ ...prev, [userId]: busy }));
  };

  const openConfirmDialog = ({
    title,
    message,
    onConfirm,
    confirmLabel,
    confirmLabelBusy,
  }) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      confirmLabel: confirmLabel || "Confirm",
      confirmLabelBusy: confirmLabelBusy || "Working...",
      onConfirm,
    });
  };

  const runConfirmDialog = async () => {
    if (confirmLoading) return;

    setConfirmLoading(true);
    try {
      if (typeof confirmDialog.onConfirm === "function") {
        await confirmDialog.onConfirm();
      }
      setConfirmDialog(getInitialConfirmDialog());
    } finally {
      setConfirmLoading(false);
    }
  };

  const closeConfirmDialog = () => {
    if (confirmLoading) return;
    setConfirmDialog(getInitialConfirmDialog());
  };

  const closeOnBackdrop = (event, onClose) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const showManualAccessLink = async (actionLink, contextLabel) => {
    if (!actionLink) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(actionLink);
        showToast(
          "success",
          `${contextLabel}: email limit hit, access link copied to clipboard.`
        );
      } else {
        window.prompt("Copy this access link and send it to the user:", actionLink);
      }
    } catch {
      window.prompt("Copy this access link and send it to the user:", actionLink);
    }
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
      setCurrentUserId(data.currentUserId || null);
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

  const createUser = async () => {
    const email = createForm.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      showToast("error", "Please enter a valid email address.");
      return;
    }

    if (createForm.passwordMethod === "direct") {
      if (createForm.password.length < 8) {
        showToast("error", "Password must be at least 8 characters.");
        return;
      }
      if (!/[A-Za-z]/.test(createForm.password) || !/\d/.test(createForm.password)) {
        showToast("error", "Password must include letters and numbers.");
        return;
      }
      if (createForm.password !== createForm.confirmPassword) {
        showToast("error", "Passwords do not match.");
        return;
      }
    }

    setCreatingUser(true);
    try {
      const payload = {
        email,
        role: createForm.role,
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        phone: createForm.phone,
        passwordMethod: createForm.passwordMethod,
        password:
          createForm.passwordMethod === "direct" ? createForm.password : undefined,
      };

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create user");
      }

      if (
        data?.mode === "existing_user_manual_link" ||
        data?.mode === "manual_link"
      ) {
        await showManualAccessLink(data?.actionLink, "Create user");
      } else if (data?.mode === "existing_user_reset") {
        showToast("success", "User exists. Access email sent.");
      } else if (data?.mode === "created_direct") {
        showToast("success", "User created with direct password.");
      } else {
        showToast("success", "User created successfully.");
      }

      setCreateForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        role: "candidate",
        passwordMethod: "invite",
        password: "",
        confirmPassword: "",
      });
      setCreateUserOpen(false);

      fetchUsers();
    } catch (err) {
      showToast("error", err.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditModal = (user) => {
    setActionMenu(null);
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

  const applyRoleChange = async (userId, nextRole) => {
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

  const requestRoleChange = (userId, currentRole, nextRole) => {
    if (nextRole === currentRole) return;

    openConfirmDialog({
      title: "Confirm Role Change",
      message: `Change role from ${currentRole} to ${nextRole}?`,
      confirmLabel: "Change",
      confirmLabelBusy: "Changing...",
      onConfirm: () => applyRoleChange(userId, nextRole),
    });
  };

  const sendResetPassword = async (userId, email) => {
    setActionMenu(null);
    if (!email) {
      showToast("error", "User has no email");
      return;
    }

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

      if (data?.mode === "manual_link") {
        await showManualAccessLink(data?.actionLink, "Resend access");
      } else {
        showToast("success", "Access/reset email sent.");
      }
    } catch (err) {
      showToast("error", err.message || "Failed to send reset email");
    } finally {
      setUserBusy(userId, false);
    }
  };

  const requestSendResetPassword = (userId, email) => {
    if (!email) {
      showToast("error", "User has no email");
      return;
    }

    openConfirmDialog({
      title: "Send Access Email",
      message: `Send access/reset email to ${email}?`,
      confirmLabel: "Send",
      confirmLabelBusy: "Sending...",
      onConfirm: () => sendResetPassword(userId, email),
    });
  };

  const generateAccessLink = async (userId, email) => {
    setActionMenu(null);
    if (!email) {
      showToast("error", "User has no email");
      return;
    }

    setUserBusy(userId, true);
    try {
      const res = await fetch("/api/admin/generate-access-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate access link");
      }

      await showManualAccessLink(data?.actionLink, "Generate access link");
    } catch (err) {
      showToast("error", err.message || "Failed to generate access link");
    } finally {
      setUserBusy(userId, false);
    }
  };

  const openPasswordModal = (user) => {
    setActionMenu(null);
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

  const deleteUser = async (user) => {
    setActionMenu(null);
    if (user.id === currentUserId) {
      showToast("error", "You cannot delete your own account.");
      return;
    }

    setUserBusy(user.id, true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete user");
      }

      if (data?.warning) {
        showToast("success", `User deleted with warning: ${data.warning}`);
      } else {
        showToast("success", "User deleted successfully.");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setTotalUsers((prev) => Math.max(0, prev - 1));
      fetchUsers();
    } catch (err) {
      showToast("error", err.message || "Failed to delete user");
    } finally {
      setUserBusy(user.id, false);
    }
  };

  const requestDeleteUser = (user) => {
    const targetLabel = user.email || user.id;
    setActionMenu(null);
    openConfirmDialog({
      title: "Delete User",
      message: `Delete user ${targetLabel}? This removes the account and all related user data.`,
      confirmLabel: "Delete",
      confirmLabelBusy: "Deleting...",
      onConfirm: () => deleteUser(user),
    });
  };

  const openActionMenu = (event, user) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const preferredLeft = rect.right - menuWidth;
    const preferredTop = rect.bottom + 8;

    setActionMenu({
      user,
      left: preferredLeft,
      top: preferredTop,
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-400 mt-1">
              Manage users, roles, profile details, and password access.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateUserOpen(true)}
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Create User
            </button>
            <a
              href="/api/admin/export-users"
              className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Export CSV
            </a>
          </div>
        </div>

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

          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
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
                            requestRoleChange(user.id, user.role, e.target.value)
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
                        <button
                          onClick={(e) => openActionMenu(e, user)}
                          disabled={busyByUser[user.id]}
                          className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="rounded-xl border border-gray-800 bg-[#0b1220] px-4 py-6 text-center text-sm text-gray-400">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-[#0b1220] px-4 py-6 text-center text-sm text-gray-400">
                No users found.
              </div>
            ) : (
              users.map((user) => (
                <article
                  key={`mobile-${user.id}`}
                  className="rounded-xl border border-gray-800 bg-[#0b1220] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-all">{user.email || "-"}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {`${user.first_name || "-"} ${user.last_name || "-"}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => openActionMenu(e, user)}
                      disabled={busyByUser[user.id]}
                      className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-1">Phone</p>
                      <p>{user.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Role</p>
                      <select
                        value={user.role || "candidate"}
                        onChange={(e) =>
                          requestRoleChange(user.id, user.role, e.target.value)
                        }
                        disabled={busyByUser[user.id]}
                        className="w-full rounded-md border border-gray-700 bg-[#111827] px-2 py-1 text-xs"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Created</p>
                      <p>{formatDate(user.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Updated</p>
                      <p>{formatDate(user.updated_at)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 text-sm">
            <span className="text-gray-400">
              {totalUsers} users, page {page} of {totalPages}
            </span>

            <div className="flex gap-2 flex-nowrap">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-50"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
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

      {actionMenu && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setActionMenu(null)}
          />
          <div
            className="fixed z-40 w-56 rounded-lg border border-gray-700 bg-[#0b1220] shadow-2xl p-1"
            style={actionMenuStyle}
          >
            <button
              onClick={() => openEditModal(actionMenu.user)}
              disabled={busyByUser[actionMenu.user.id]}
              className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-gray-800 disabled:opacity-50"
            >
              Edit Profile
            </button>
            <button
              onClick={() =>
                requestSendResetPassword(actionMenu.user.id, actionMenu.user.email)
              }
              disabled={busyByUser[actionMenu.user.id]}
              className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-gray-800 disabled:opacity-50"
            >
              Resend Access Email
            </button>
            <button
              onClick={() =>
                generateAccessLink(actionMenu.user.id, actionMenu.user.email)
              }
              disabled={busyByUser[actionMenu.user.id]}
              className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-gray-800 disabled:opacity-50"
            >
              Generate Access Link
            </button>
            <button
              onClick={() => openPasswordModal(actionMenu.user)}
              disabled={busyByUser[actionMenu.user.id]}
              className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-gray-800 disabled:opacity-50"
            >
              Set Password
            </button>
            <button
              onClick={() => requestDeleteUser(actionMenu.user)}
              disabled={
                busyByUser[actionMenu.user.id] ||
                actionMenu.user.id === currentUserId
              }
              className="w-full text-left rounded-md px-3 py-2 text-xs text-rose-400 hover:bg-gray-800 disabled:opacity-40"
              title={
                actionMenu.user.id === currentUserId
                  ? "You cannot delete your own account."
                  : "Delete user"
              }
            >
              Delete User
            </button>
          </div>
        </>
      )}

      {confirmDialog.open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(event) => closeOnBackdrop(event, closeConfirmDialog)}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-300">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeConfirmDialog}
                disabled={confirmLoading}
                className="rounded-lg border border-gray-700 px-4 py-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={runConfirmDialog}
                disabled={confirmLoading}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2"
              >
                {confirmLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {confirmDialog.confirmLabelBusy}
                  </span>
                ) : (
                  confirmDialog.confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(event) => closeOnBackdrop(event, () => setEditOpen(false))}
        >
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
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(event) => closeOnBackdrop(event, () => setPasswordOpen(false))}
        >
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

      {createUserOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(event) => closeOnBackdrop(event, () => setCreateUserOpen(false))}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">Create User</h3>
              <button
                onClick={() => setCreateUserOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                value={createForm.first_name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, first_name: e.target.value }))
                }
                placeholder="First name"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                value={createForm.last_name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, last_name: e.target.value }))
                }
                placeholder="Last name"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Phone"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              />
              <input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="Email"
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2 md:col-span-2"
              />
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0b1220] p-3 space-y-3">
              <p className="text-sm font-medium">Password Method</p>
              <div className="flex flex-col md:flex-row gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="passwordMethod"
                    checked={createForm.passwordMethod === "invite"}
                    onChange={() =>
                      setCreateForm((prev) => ({ ...prev, passwordMethod: "invite" }))
                    }
                  />
                  Send invitation email (user sets password)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="passwordMethod"
                    checked={createForm.passwordMethod === "direct"}
                    onChange={() =>
                      setCreateForm((prev) => ({ ...prev, passwordMethod: "direct" }))
                    }
                  />
                  Set password directly (admin sets password)
                </label>
              </div>

              {createForm.passwordMethod === "direct" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Password"
                    className="rounded-lg border border-gray-700 bg-[#111827] px-3 py-2"
                  />
                  <input
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Confirm password"
                    className="rounded-lg border border-gray-700 bg-[#111827] px-3 py-2"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreateUserOpen(false)}
                className="rounded-lg border border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={createUser}
                disabled={creatingUser}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 font-medium"
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
