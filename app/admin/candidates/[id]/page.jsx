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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTimeout(() => setShowToast(false), 2500);
  };

  const getStatusBadge = (status) => {
    const base =
      "px-3 py-1 rounded-full text-xs font-semibold inline-block transition-all duration-300 hover:scale-105";

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

  const hasEnvelope =
    answersObject &&
    typeof answersObject === "object" &&
    ("assessment" in answersObject ||
      "extra_fields" in answersObject ||
      "form" in answersObject);
  const assessmentAnswers = hasEnvelope
    ? answersObject.assessment || {}
    : answersObject || {};
  const extraFields = hasEnvelope ? answersObject.extra_fields || {} : {};
  const formMeta = hasEnvelope ? answersObject.form || {} : {};

  const cardStyle =
    "bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-800 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1";

  return (
    <div className="p-6 md:p-10 space-y-10">

      <button
        onClick={() => router.push("/admin/candidates")}
        className="px-4 py-2 border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-105"
      >
        ← Back to Candidates
      </button>

      <h1 className="text-3xl font-bold tracking-tight">
        Candidate Details
      </h1>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className={cardStyle}>
          <h3 className="text-sm text-gray-500 mb-2">Name</h3>
          <p className="font-semibold text-lg">{candidate.name}</p>
        </div>

        <div className={cardStyle}>
          <h3 className="text-sm text-gray-500 mb-2">Email</h3>
          <p>{candidate.email}</p>
        </div>

        <div className={cardStyle}>
          <h3 className="text-sm text-gray-500 mb-2">Final Score</h3>
          <p className={`text-3xl font-bold transition-all duration-500 ${getScoreColor(candidate.final_score)} animate-pulse`}>
            {candidate.final_score}
          </p>
        </div>
      </div>

      {(formMeta?.title || formMeta?.slug || formMeta?.subject) && (
        <div className={cardStyle}>
          <h3 className="text-sm text-gray-500 mb-3">Application Form</h3>
          <div className="space-y-1 text-sm">
            {formMeta?.title && <p><strong>Title:</strong> {formMeta.title}</p>}
            {formMeta?.slug && <p><strong>Slug:</strong> {formMeta.slug}</p>}
            {formMeta?.subject && (
              <p><strong>Subject:</strong> {formMeta.subject}</p>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`${cardStyle} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h3 className="text-sm text-gray-500 mb-2">Status</h3>
          <span className={getStatusBadge(candidate.status)}>
            {candidate.status || "Pending"}
          </span>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => updateStatus("Shortlisted")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg transition-all duration-300 hover:bg-blue-700 hover:scale-105"
          >
            Shortlist
          </button>

          <button
            onClick={() => updateStatus("Rejected")}
            className="px-4 py-2 bg-red-600 text-white rounded-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
          >
            Reject
          </button>

          <button
            onClick={() => updateStatus("Hired")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg transition-all duration-300 hover:bg-green-700 hover:scale-105"
          >
            Hire
          </button>
        </div>
      </div>

      {/* Internal Notes */}
      <div className={`${cardStyle} space-y-4`}>
        <h2 className="text-xl font-semibold">Internal Notes</h2>

        <textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
        />

        <button
          onClick={saveNote}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all duration-300 hover:scale-105"
        >
          Save Note
        </button>
      </div>

      {/* AI Evaluation */}
      <div className={`${cardStyle} space-y-4`}>
        <h2 className="text-xl font-semibold">AI Evaluation</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg transition hover:shadow-md">
            Skills: {ai?.skillsScore}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg transition hover:shadow-md">
            Experience: {ai?.experienceScore}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg transition hover:shadow-md">
            Assessment: {ai?.assessmentScore}
          </div>
        </div>

        <div><strong>Recommendation:</strong> {ai?.recommendation}</div>

        <div>
          <strong>Strengths:</strong>
          <ul className="list-disc ml-6 space-y-1">
            {ai?.strengths?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        <div>
          <strong>Weaknesses:</strong>
          <ul className="list-disc ml-6 space-y-1">
            {ai?.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>

        <div>
          <strong>Executive Summary:</strong>
          <p className="mt-2">{ai?.summary}</p>
        </div>
      </div>

      {/* Answers */}
      <div className={`${cardStyle} space-y-4`}>
        <h2 className="text-xl font-semibold">Answers</h2>

        {questions.map((q) => {
          const answer = assessmentAnswers[q.id];
          if (!answer) return null;

          return (
            <div key={q.id} className="border-b pb-4 last:border-none transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-3">
              <p className="font-semibold mb-2">{q.question_text}</p>
              <p className="text-gray-700 dark:text-gray-300">{answer}</p>
            </div>
          );
        })}
      </div>

      {Object.keys(extraFields || {}).length > 0 && (
        <div className={`${cardStyle} space-y-4`}>
          <h2 className="text-xl font-semibold">Additional Information</h2>
          {Object.entries(extraFields).map(([key, value]) => (
            <div
              key={key}
              className="border-b pb-3 last:border-none text-sm space-y-1"
            >
              <p className="font-semibold">{key}</p>
              <p className="text-gray-700 dark:text-gray-300">
                {String(value || "-")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* CV */}
      <div className={cardStyle}>
        <h2 className="text-xl font-semibold mb-4">CV Text</h2>
        <pre className="whitespace-pre-wrap text-sm">
          {candidate.cv_text}
        </pre>
      </div>

      {showToast && (
        <div className="fixed top-6 right-6 z-50 animate-fadeIn">
          <div className="flex items-center gap-3 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl transition-all duration-300">
            <span className="font-semibold">
              Note saved successfully
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
