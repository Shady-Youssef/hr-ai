"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../app/lib/supabase";

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 5;

  useEffect(() => {
    fetchCandidates();
  }, [filter]);

  const fetchCandidates = async () => {
    let query = supabase
      .from("candidates")
      .select("*")
      .order("final_score", { ascending: false });

    if (filter !== "All") {
      query = query.eq("ai_result->>recommendation", filter);
    }

    const { data } = await query;
    setCandidates(data || []);
  };

  const updateStatus = async (id, newStatus) => {
    await supabase
      .from("candidates")
      .update({ status: newStatus })
      .eq("id", id);

    fetchCandidates();
  };

  const filteredCandidates = candidates.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCandidates.length / pageSize);

  const paginatedCandidates = filteredCandidates.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">CSM Dashboard</h1>

      <div className="flex gap-4 mb-6">
        <input
          placeholder="Search by name or email"
          className="border p-2 rounded w-64 dark:bg-gray-700 dark:border-gray-600"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All</option>
          <option>Strong Hire</option>
          <option>Hire</option>
          <option>Consider</option>
          <option>Reject</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Score</th>
              <th className="p-3">Recommendation</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {paginatedCandidates.map((c) => (
              <tr
                key={c.id}
                className="border-t dark:border-gray-600"
              >
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3 font-semibold">{c.final_score}</td>
                <td className="p-3">{c.ai_result?.recommendation}</td>
                <td className="p-3">
                  <select
                    value={c.status || "Pending"}
                    onChange={(e) =>
                      updateStatus(c.id, e.target.value)
                    }
                    className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option>Pending</option>
                    <option>Reviewed</option>
                    <option>Shortlisted</option>
                    <option>Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          Previous
        </button>

        <span className="px-3 py-1">
          Page {page} of {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}