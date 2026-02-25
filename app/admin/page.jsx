"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../app/lib/supabase";

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setQuestions(data);
  };

  const addQuestion = async () => {
    if (!newQuestion) return;

    await supabase.from("questions").insert([
      {
        question_text: newQuestion,
        is_active: true,
      },
    ]);

    setNewQuestion("");
    fetchQuestions();
  };

  const deleteQuestion = async (id) => {
    await supabase.from("questions").delete().eq("id", id);
    fetchQuestions();
  };

  const toggleStatus = async (id, currentStatus) => {
    await supabase
      .from("questions")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    fetchQuestions();
  };

  return (
    
    <div style={{ padding: 40 }}>
      <h1>CSM Question Manager</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Enter new question"
          style={{ width: "70%", marginRight: 10 }}
        />
        <button onClick={addQuestion}>Add Question</button>
      </div>

      <h3>Existing Questions</h3>

      {questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 15 }}>
          <p>
            <strong>{q.question_text}</strong>
          </p>

          <button onClick={() => toggleStatus(q.id, q.is_active)}>
            {q.is_active ? "Deactivate" : "Activate"}
          </button>

          <button
            onClick={() => deleteQuestion(q.id)}
            style={{ marginLeft: 10 }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}