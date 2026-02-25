"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useParams } from "next/navigation";

export default function CandidateDetails() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [note, setNote] = useState("");

  const fetchCandidate = async () => {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", id)
      .single();

    if (!error) {
      setCandidate(data);
      setNote(data.internal_notes || "");
    }
  };

  useEffect(() => {
    if (id) fetchCandidate();
  }, [id]);

  const updateStatus = async (newStatus) => {
    await supabase
      .from("candidates")
      .update({ status: newStatus, updated_at: new Date() })
      .eq("id", candidate.id);

    fetchCandidate();
  };

  const saveNote = async () => {
    await supabase
      .from("candidates")
      .update({ internal_notes: note, updated_at: new Date() })
      .eq("id", candidate.id);

    alert("Note saved");
  };

  if (!candidate) return <p style={{ padding: 40 }}>Loading...</p>;

  const ai = candidate.ai_result;

  return (
    <div style={{ padding: 40 }}>
      <h1>Candidate Details</h1>

      <h3>Status:</h3>
      <p>{candidate.status}</p>

      <button onClick={() => updateStatus("Shortlisted")}>
        Shortlist
      </button>

      <button onClick={() => updateStatus("Rejected")}>
        Reject
      </button>

      <button onClick={() => updateStatus("Hired")}>
        Hire
      </button>

      <hr style={{ margin: "30px 0" }} />

      <h3>Internal Notes:</h3>
      <textarea
        rows={5}
        style={{ width: "100%" }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <br />
      <button onClick={saveNote}>Save Note</button>

      <hr style={{ margin: "30px 0" }} />

      <h3>Name:</h3>
      <p>{candidate.name}</p>

      <h3>Email:</h3>
      <p>{candidate.email}</p>

      <h3>Final Score:</h3>
      <p>{candidate.final_score}</p>

      <h3>Scores Breakdown:</h3>
      <p>Skills: {ai?.skillsScore}</p>
      <p>Experience: {ai?.experienceScore}</p>
      <p>Assessment: {ai?.assessmentScore}</p>

      <h3>Recommendation:</h3>
      <strong>{ai?.recommendation}</strong>

      <h3>Strengths:</h3>
      <ul>
        {ai?.strengths?.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <h3>Weaknesses:</h3>
      <ul>
        {ai?.weaknesses?.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>

      <h3>Executive Summary:</h3>
      <p>{ai?.summary}</p>

      <h3>CV Text:</h3>
      <pre>{candidate.cv_text}</pre>

      <h3>Answers:</h3>
      <pre>{JSON.stringify(candidate.answers, null, 2)}</pre>
    </div>
  );
}