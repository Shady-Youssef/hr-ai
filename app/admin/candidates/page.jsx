"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { Container } from "../../components/ContainerComponent";
import { Card } from "../../components/CardComponent";

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

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [minScore, setMinScore] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState("All");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("desc");
  const [role, setRole] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  
  const [confirmDialog, setConfirmDialog] = useState(getInitialConfirmDialog);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const itemsPerPage = 10;

  // ✅ Wrapped in useCallback عشان متتعملش recreate كل render
  const fetchCandidates = useCallback(async () => {
    const { data } = await supabase
      .from("candidates")
      .select("*")
      .order("created_at", { ascending: false });

    setCandidates(data || []);
  }, []);

  // ✅ Initial fetch + Realtime subscription
  useEffect(() => {
    fetchCandidates();

    const channel = supabase
      .channel("realtime-candidates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidates",
        },
        () => {
          fetchCandidates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCandidates]);

  // ✅ Polling fallback every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCandidates();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchCandidates]);

  // ✅ Fetch user role
  useEffect(() => {
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (roleData?.role) {
          setRole(roleData.role);
        }
      }
    };
    loadRole();
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
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

  const deleteCandidate = async (candidateId) => {
    setDeletingId(candidateId);
    try {
      const res = await fetch("/api/admin/delete-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete candidate");
      }

      showToast("success", "Candidate deleted successfully.");
      fetchCandidates();
    } catch (err) {
      showToast("error", err.message || "Failed to delete candidate");
    } finally {
      setDeletingId(null);
    }
  };

  const requestDeleteCandidate = (candidate) => {
    const targetLabel = candidate.name || candidate.email || candidate.id;
    openConfirmDialog({
      title: "Delete Candidate",
      message: `Are you sure you want to delete candidate ${targetLabel}? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmLabelBusy: "Deleting...",
      onConfirm: () => deleteCandidate(candidate.id),
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const clearSorting = () => {
    setSortField(null);
    setSortDirection("desc");
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <span className="text-gray-400 text-xs">⇅</span>;
    }

    return sortDirection === "asc" ? (
      <span className="text-blue-500 text-xs">↑</span>
    ) : (
      <span className="text-blue-500 text-xs">↓</span>
    );
  };

  const renderSortButton = (field, label) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-2 whitespace-nowrap hover:text-blue-500 transition"
    >
      <span>{label}</span>
      {renderSortIcon(field)}
    </button>
  );

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBadge = (status) => {
    const base =
      "px-3 py-1 rounded-full text-xs font-semibold inline-block";

    switch (status) {
      case "Hired":
        return `${base} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`;
      case "Rejected":
        return `${base} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300`;
      case "Failed":
        return `${base} bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300`;
      case "Shortlisted":
        return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`;
      case "Reviewed":
        return `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300`;
      case "Processing":
        return `${base} bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
      default:
        return `${base} bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
    }
  };

  const formatDate = (date) => {
    const formatted = new Date(date).toLocaleString("en-GB", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return `${formatted} (Africa/Cairo)`;
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesStatus =
      statusFilter === "All" || c.status === statusFilter;

    const matchesScore =
      minScore === "" || Number(c.final_score) >= Number(minScore);

    const matchesSearch =
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRecommendation =
      recommendationFilter === "All" ||
      c.ai_result?.recommendation === recommendationFilter;

    return (
      matchesStatus &&
      matchesScore &&
      matchesSearch &&
      matchesRecommendation
    );
  });

  const sortedCandidates = sortField
    ? [...filteredCandidates].sort((a, b) => {
        let valueA;
        let valueB;

        if (sortField === "recommendation") {
          valueA = a.ai_result?.recommendation || "";
          valueB = b.ai_result?.recommendation || "";
        } else {
          valueA = a[sortField];
          valueB = b[sortField];
        }

        if (valueA == null && valueB != null) {
          return sortDirection === "asc" ? 1 : -1;
        }
        if (valueB == null && valueA != null) {
          return sortDirection === "asc" ? -1 : 1;
        }
        if (typeof valueA === "string") valueA = valueA.toLowerCase();
        if (typeof valueB === "string") valueB = valueB.toLowerCase();

        if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
        if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      })
    : filteredCandidates;

  const totalPages = Math.ceil(
    sortedCandidates.length / itemsPerPage
  );

  const paginated = sortedCandidates.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <Container>
      <Card>

        <a href="/api/export">
          <button className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Export CSV
          </button>
        </a>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          Candidates
          {candidates && (
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">
              {candidates.length}
            </span>
          )}
        </h1>

        {sortField && (
          <button
            onClick={clearSorting}
            className="mb-4 text-sm text-red-500 hover:underline"
          >
            ✕ Clear Sorting
          </button>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-6">

          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="p-2 border rounded w-full lg:w-1/3 dark:bg-gray-800 dark:border-gray-600"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="All">All Status</option>
            <option value="Processing">Processing</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Hired">Hired</option>
            <option value="Rejected">Rejected</option>
            <option value="Failed">Failed</option>
          </select>

          <select
            value={recommendationFilter}
            onChange={(e) => {
              setPage(1);
              setRecommendationFilter(e.target.value);
            }}
            className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="All">All Recommendations</option>
            <option value="Strong Hire">Strong Hire</option>
            <option value="Hire">Hire</option>
            <option value="Consider">Consider</option>
            <option value="Reject">Reject</option>
          </select>

          <input
            type="number"
            placeholder="Minimum Score"
            value={minScore}
            onChange={(e) => {
              setPage(1);
              setMinScore(e.target.value);
            }}
            className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600"
          />
        </div>

        <div className="hidden md:block overflow-x-auto rounded-xl shadow border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <table className="min-w-[900px] w-full text-left">
            <thead className="bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4 select-none">
                  {renderSortButton("final_score", "Score")}
                </th>
                <th className="p-4 select-none">
                  {renderSortButton("recommendation", "Recommendation")}
                </th>
                <th className="p-4 select-none">
                  {renderSortButton("status", "Status")}
                </th>
                <th className="p-4 select-none">
                  {renderSortButton("created_at", "Date")}
                </th>
                <th className="p-4">Details</th>
                {role === "admin" && <th className="p-4">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {paginated.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  <td className="p-4 font-medium">{c.name}</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                    {c.email}
                  </td>
                  <td className={`p-4 font-bold ${getScoreColor(c.final_score)}`}>
                    {c.final_score}
                  </td>
                  <td className="p-4">
                    {c.ai_result?.recommendation}
                  </td>
                  <td className="p-4">
                    <span className={getStatusBadge(c.status)}>
                      {c.status || "Pending"}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      View
                    </Link>
                  </td>
                  {role === "admin" && (
                    <td className="p-4">
                      <button
                        onClick={() => requestDeleteCandidate(c)}
                        disabled={deletingId === c.id}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded disabled:opacity-50"
                      >
                        {deletingId === c.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="flex flex-col gap-4 md:hidden">
          {paginated.map((c) => (
            <div
              key={`mobile-${c.id}`}
              className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900 shadow-sm flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{c.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {c.email}
                  </p>
                </div>
                <div className={`font-bold text-lg ${getScoreColor(c.final_score)}`}>
                  {c.final_score}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 text-sm mt-1">
                <span className={getStatusBadge(c.status)}>
                  {c.status || "Pending"}
                </span>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full font-medium">
                  {c.ai_result?.recommendation || "N/A"}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                <span>{formatDate(c.created_at)}</span>
                <div className="flex items-center gap-3">
                  {role === "admin" && (
                    <button
                      onClick={() => requestDeleteCandidate(c)}
                      disabled={deletingId === c.id}
                      className="text-red-600 dark:text-red-400 hover:underline font-medium disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                  <Link
                    href={`/admin/candidates/${c.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                  >
                    View <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {paginated.length === 0 && (
            <div className="text-center p-8 text-gray-500">No candidates found.</div>
          )}
        </div>

        <div className="flex justify-center items-center gap-2 md:gap-4 mt-6 flex-nowrap">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-2 md:px-4 border border-gray-400 dark:border-gray-600 text-sm md:text-base rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <span className="text-xs md:text-sm whitespace-nowrap">
            Page {page} of {totalPages || 1}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-2 md:px-4 border border-gray-400 dark:border-gray-600 text-sm md:text-base rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
          </button>
        </div>

      </Card>
      
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={(event) => closeOnBackdrop(event, closeConfirmDialog)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full transform transition-all p-6">
            <h3 className="text-xl font-bold mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm whitespace-pre-wrap">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3 font-medium">
              <button
                onClick={closeConfirmDialog}
                disabled={confirmLoading}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={runConfirmDialog}
                disabled={confirmLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
    </Container>
  );
}
