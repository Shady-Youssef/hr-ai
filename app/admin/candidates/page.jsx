"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, [filter]);

  const fetchCandidates = async () => {
    setLoading(true);

    let query = supabase
      .from("candidates")
      .select("*")
      .order("final_score", { ascending: false });

    if (filter !== "All") {
      query = query.eq("ai_result->>recommendation", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
    } else {
      setCandidates(data);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Candidate Dashboard</h1>

      <div style={{ marginBottom: 20 }}>
        <label>Filter by Recommendation: </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ marginLeft: 10 }}
        >
          <option>All</option>
          <option>Strong Hire</option>
          <option>Hire</option>
          <option>Consider</option>
          <option>Reject</option>
        </select>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && (
        <table border="1" cellPadding="10" style={{ marginTop: 20, width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Final Score</th>
              <th>Recommendation</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.final_score}</td>
                <td>{c.ai_result?.recommendation}</td>
                <td>
                  <a
                    href={`/admin/candidates/${c.id}`}
                    style={{ color: "blue", textDecoration: "underline" }}
                  >
                    View Details
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}