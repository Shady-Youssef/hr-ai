"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CsmQuestionManager() {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(1);

  const itemsPerPage = 5;

  async function fetchQuestions() {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setQuestions(data);
  }

  useEffect(() => {
    fetchQuestions();
  }, []);

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

  const confirmDelete = async () => {
    await supabase.from("questions").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchQuestions();
  };

  const toggleStatus = async (id, currentStatus) => {
    await supabase
      .from("questions")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    fetchQuestions();
  };

  const saveEdit = async () => {
    await supabase
      .from("questions")
      .update({ question_text: editText })
      .eq("id", editingId);

    setEditingId(null);
    setEditText("");
    fetchQuestions();
  };

  const filtered = questions.filter((q) =>
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginated = filtered.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-10">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-6 md:p-10 space-y-8">
        <h1 className="text-3xl font-bold">CSM Question Manager</h1>

        <div className="flex flex-col md:flex-row gap-4">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Enter new question"
            className="flex-1 p-3 rounded-lg border dark:bg-gray-800"
          />

          <button
            onClick={addQuestion}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Add
          </button>

          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="flex-1 p-3 rounded-lg border dark:bg-gray-800"
          />
        </div>

        <div className="space-y-4">
          {paginated.map((q) => (
            <div
              key={q.id}
              className="border rounded-xl p-5 flex flex-col md:flex-row justify-between gap-4 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex-1">
                {editingId === q.id ? (
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 rounded border dark:bg-gray-700"
                  />
                ) : (
                  <p className="font-medium">{q.question_text}</p>
                )}

                <span className="text-xs mt-2 inline-block px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700">
                  {q.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => toggleStatus(q.id, q.is_active)}
                  className="px-3 py-2 border rounded text-sm"
                >
                  {q.is_active ? "Deactivate" : "Activate"}
                </button>

                {editingId === q.id ? (
                  <button
                    onClick={saveEdit}
                    className="px-3 py-2 bg-green-600 text-white rounded text-sm"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(q.id);
                      setEditText(q.question_text);
                    }}
                    className="px-3 py-2 bg-yellow-500 text-white rounded text-sm"
                  >
                    Edit
                  </button>
                )}

                <button
                  onClick={() => setDeleteId(q.id)}
                  className="px-3 py-2 bg-red-600 text-white rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 border rounded"
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages || 1}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 border rounded"
          >
            Next
          </button>
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-xl w-[90%] max-w-sm text-center">
            <p className="mb-4 font-medium">
              Are you sure you want to delete this question?
            </p>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
