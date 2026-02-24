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
      alert("Please complete all required fields.");
      return;
    }

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
      <div style={{ padding: 40 }}>
        <h2>Thank you.</h2>
        <p>Your application has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Apply for Frontend Developer</h1>

      <input
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <h3 style={{ marginTop: 30 }}>Assessment Questions</h3>

      {questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p>{q.question_text}</p>
          <textarea
            rows={4}
            style={{ width: "100%" }}
            onChange={(e) =>
              setAnswers({
                ...answers,
                [q.id]: e.target.value,
              })
            }
          />
        </div>
      ))}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </div>
  );
}