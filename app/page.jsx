"use client";

import { useState, useEffect } from "react";
import { supabase } from "../app/lib/supabase";

export default function Home() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadQuestions = async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("is_active", true);

      if (!error) setQuestions(data);
    };

    loadQuestions();
  }, []);

  const handleSubmit = async () => {
    if (!file || !name || !email) {
      setError("Please complete all required fields.");
      return;
    }

    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("cv", file);
    formData.append("name", name);
    formData.append("email", email);
    formData.append("assessment", JSON.stringify(answers));

    await fetch("/api/evaluate", {
      method: "POST",
      body: formData,
    });

    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-10 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-green-600">
            Application Submitted
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Thank you for applying. Our team will review your application and contact you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 shadow-2xl rounded-2xl p-8 md:p-12 w-full max-w-3xl space-y-8">

        <div>
          <h1 className="text-3xl font-bold mb-2">
            Apply for Frontend Developer
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Please complete the form below and upload your CV (PDF only).
          </p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Full Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Upload CV (PDF) *
          </label>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="cvUpload"
            />
            <label htmlFor="cvUpload" className="cursor-pointer">
              {file ? (
                <p className="text-green-600 font-medium">
                  {file.name}
                </p>
              ) : (
                <p className="text-gray-500">
                  Click to upload your CV
                </p>
              )}
            </label>
          </div>
        </div>

        {/* Questions */}
        {questions.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">
              Assessment Questions
            </h3>

            {questions.map((q) => (
              <div key={q.id}>
                <p className="font-medium mb-2">
                  {q.question_text}
                </p>
                <textarea
                  rows={4}
                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  onChange={(e) =>
                    setAnswers({
                      ...answers,
                      [q.id]: e.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Application"}
        </button>

      </div>
    </div>
  );
}