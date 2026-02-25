"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function CandidateDetails() {
  const { id } = useParams();
  const router = useRouter();

  const [candidate, setCandidate] = useState(null);
  const [note, setNote] = useState("");
  const [questions, setQuestions] = useState([]);
  // const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

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

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from("questions")
      .select("*");

    setQuestions(data || []);
  };

  useEffect(() => {
    if (id) {
      fetchCandidate();
      fetchQuestions();
    }
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

  setShowToast(true);

  setTimeout(() => {
    setShowToast(false);
  }, 2500);
};

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

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  if (!candidate)
    return <div className="p-10 text-center">Loading...</div>;

  const ai = candidate.ai_result;
  let answersObject = {};

try {
  if (typeof candidate.answers === "string") {
    answersObject = JSON.parse(candidate.answers);
  } else {
    answersObject = candidate.answers || {};
  }
} catch (error) {
  console.error("Error parsing answers:", error);
  answersObject = {};
}

  return (
    <div className="p-6 md:p-10 space-y-8">

      {/* Back Button */}
      <button
        onClick={() => router.push("/admin/candidates")}
        className="px-4 py-2 border rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
      >
        ← Back to Candidates
      </button>

      <h1 className="text-3xl font-bold">
        Candidate Details
      </h1>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-6">

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow">
          <h3 className="text-sm text-gray-500 mb-2">Name</h3>
          <p className="font-semibold text-lg">{candidate.name}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow">
          <h3 className="text-sm text-gray-500 mb-2">Email</h3>
          <p>{candidate.email}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow">
          <h3 className="text-sm text-gray-500 mb-2">Final Score</h3>
          <p className={`text-2xl font-bold ${getScoreColor(candidate.final_score)}`}>
            {candidate.final_score}
          </p>
        </div>

      </div>

      {/* Status */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm text-gray-500 mb-2">Status</h3>
          <span className={getStatusBadge(candidate.status)}>
            {candidate.status || "Pending"}
          </span>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => updateStatus("Shortlisted")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Shortlist
          </button>

          <button
            onClick={() => updateStatus("Rejected")}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Reject
          </button>

          <button
            onClick={() => updateStatus("Hired")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Hire
          </button>
        </div>
      </div>

      {/* Internal Notes */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow space-y-4">
        <h2 className="text-xl font-semibold">Internal Notes</h2>

        <textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-3 border rounded dark:bg-gray-800 dark:border-gray-600"
        />

        <button
          onClick={saveNote}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
        >
          Save Note
        </button>
      </div>

      {/* AI Evaluation */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow space-y-4">
        <h2 className="text-xl font-semibold">AI Evaluation</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div>Skills: {ai?.skillsScore}</div>
          <div>Experience: {ai?.experienceScore}</div>
          <div>Assessment: {ai?.assessmentScore}</div>
        </div>

        <div>
          <strong>Recommendation:</strong> {ai?.recommendation}
        </div>

        <div>
          <strong>Strengths:</strong>
          <ul className="list-disc ml-6">
            {ai?.strengths?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        <div>
          <strong>Weaknesses:</strong>
          <ul className="list-disc ml-6">
            {ai?.weaknesses?.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div>
          <strong>Executive Summary:</strong>
          <p className="mt-2">{ai?.summary}</p>
        </div>
      </div>

      {/* Clean Answers */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow space-y-4">
        <h2 className="text-xl font-semibold">Answers</h2>

        {questions.map((q) => {
          const answer = answersObject[q.id];

          if (!answer) return null;

          return (
            <div key={q.id} className="border-b pb-4">
              <p className="font-semibold mb-2">
                {q.question_text}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                {answer}
              </p>
            </div>
          );
        })}
      </div>

      {/* CV Text */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">
          CV Text
        </h2>
        <pre className="whitespace-pre-wrap text-sm">
          {candidate.cv_text}
        </pre>
      </div>
{showToast && (
  <div className="fixed top-6 right-6 z-50 animate-fadeIn">
    <div className="flex items-center gap-3 bg-green-600 text-white px-6 py-4 rounded-xl shadow-lg">
      
      {/* Success Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>

      <span className="font-semibold">
        Note saved successfully
      </span>
    </div>
  </div>
)}
    </div>
    
  );
}