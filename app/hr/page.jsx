"use client";

import { useState } from "react";
import CsmQuestionManager from "../components/CsmQuestionManager";
import HrFormBuilder from "../components/HrFormBuilder";

export default function HrPage() {
  const [tab, setTab] = useState("forms");

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6">
        <div className="inline-flex rounded-xl border border-gray-700 bg-[#111827] p-1">
          <button
            onClick={() => setTab("forms")}
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === "forms"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            Form Builder
          </button>
          <button
            onClick={() => setTab("questions")}
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === "questions"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            Question Manager
          </button>
        </div>
      </div>

      {tab === "forms" ? <HrFormBuilder /> : <CsmQuestionManager />}
    </div>
  );
}
