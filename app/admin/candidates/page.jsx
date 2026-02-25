"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { Container } from "../../components/ContainerComponent";
import { Card } from "../../components/CardComponent";

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

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
        (payload) => {
          console.log("Realtime change:", payload);
          fetchCandidates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCandidates = async () => {
    const { data } = await supabase
      .from("candidates")
      .select("*")
      .order("final_score", { ascending: false });

    setCandidates(data || []);
  };

  // 🎨 Score Heat Coloring
  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  // 🎨 Status Badge Colors
  const getStatusBadge = (status) => {
    const base =
      "px-3 py-1 rounded-full text-xs font-semibold inline-block";

    switch (status) {
      case "Hired":
        return `${base} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`;
      case "Rejected":
        return `${base} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300`;
      case "Shortlisted":
        return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`;
      default:
        return `${base} bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
    }
  };

  const totalPages = Math.ceil(candidates.length / itemsPerPage);
  const paginated = candidates.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <Container>
      <Card>

        {/* Export Button */}
        <a href="/api/export">
          <button className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Export CSV
          </button>
        </a>

        <h1 className="text-2xl font-bold mb-6">
          Candidates
        </h1>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto rounded-xl shadow border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

          <table className="min-w-[700px] w-full text-left">

            <thead className="bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Score</th>
                <th className="p-4">Recommendation</th>
                <th className="p-4">Status</th>
                <th className="p-4">Details</th>
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

                  <td
                    className={`p-4 font-bold ${getScoreColor(
                      c.final_score
                    )}`}
                  >
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

                  <td className="p-4">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 border border-gray-400 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 border border-gray-400 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            Next
          </button>
        </div>

      </Card>
    </Container>
  );
}