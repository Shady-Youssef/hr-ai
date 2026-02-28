"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
]);
const ALLOWED_EXTENSIONS = [".pdf", ".csv"];

function isAllowedFile(selectedFile) {
  if (!selectedFile) return false;
  const lowerName = (selectedFile.name || "").toLowerCase();
  const extensionAllowed = ALLOWED_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );
  const mimeAllowed = ALLOWED_MIME_TYPES.has(selectedFile.type);
  return extensionAllowed || mimeAllowed;
}

function getFormErrorMessage(errorText) {
  if (!errorText) return "Failed to load application form.";
  const normalized = errorText.toLowerCase();
  if (normalized.includes("not found")) {
    return "This form is unavailable or has been disabled.";
  }
  return errorText;
}

export default function CandidateApplicationForm({
  slug = null,
  showFormsCatalog = false,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [formConfig, setFormConfig] = useState(null);
  const [formsCatalog, setFormsCatalog] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState(null);
  const [answers, setAnswers] = useState({});
  const [extraFields, setExtraFields] = useState({});

  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  const customFields = useMemo(
    () => (Array.isArray(formConfig?.fields) ? formConfig.fields : []),
    [formConfig]
  );

  useEffect(() => {
    const loadCurrentUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      setCurrentUser(session.user);
      setEmail((prev) => prev || session.user.email || "");

      const { data: profileRoleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      let role = profileRoleData?.role || null;

      if (!role) {
        const { data: userRoleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        role = userRoleData?.role || null;
      }

      setCurrentRole(role);
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      setError("");

      try {
        const formEndpoint = slug
          ? `/api/forms/${encodeURIComponent(slug)}`
          : "/api/forms/default";

        const [formRes, formsRes, questionsRes] = await Promise.all([
          fetch(formEndpoint),
          showFormsCatalog ? fetch("/api/forms") : Promise.resolve(null),
          supabase
            .from("questions")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
        ]);

        const formPayload = await formRes.json();
        if (!formRes.ok) {
          throw new Error(formPayload?.error || "Form not found");
        }

        if (!formPayload?.item) {
          throw new Error("No active form available right now.");
        }

        setFormConfig(formPayload.item);
        setExtraFields({});

        if (formsRes) {
          const formsPayload = await formsRes.json();
          if (!formsRes.ok) {
            throw new Error(formsPayload?.error || "Failed to load forms list");
          }
          setFormsCatalog(formsPayload.items || []);
        }

        if (!questionsRes.error) {
          setQuestions(questionsRes.data || []);
        }
      } catch (err) {
        setError(getFormErrorMessage(err?.message || ""));
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [slug, showFormsCatalog]);

  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      setFile(null);
      return;
    }

    if (selectedFiles.length > 1) {
      setError("Only one file is allowed.");
      e.target.value = "";
      return;
    }

    const selectedFile = selectedFiles[0];
    if (!isAllowedFile(selectedFile)) {
      setError("Only PDF or CSV files are allowed.");
      setFile(null);
      e.target.value = "";
      return;
    }

    setError("");
    setFile(selectedFile);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !file) {
      setError("Please complete all required fields.");
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isAllowedFile(file)) {
      setError("Only PDF or CSV files are allowed.");
      return;
    }

    for (const field of customFields) {
      if (field.required && !String(extraFields[field.key] || "").trim()) {
        setError(`Please fill the required field: ${field.label}`);
        return;
      }
    }

    setError("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("cv", file);
      formData.append("name", name.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("assessment", JSON.stringify(answers));
      formData.append("extra_fields", JSON.stringify(extraFields));
      formData.append("form_slug", formConfig?.slug || "");
      formData.append("form_title", formConfig?.title || "");
      formData.append("form_subject", formConfig?.subject || "");

      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.result || data?.error || "Submission failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="text-center">Loading form...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-10 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-green-600">
            Application Submitted
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Thank you for applying. Our team will review your application and
            contact you soon.
          </p>
        </div>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 md:px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
          <h1 className="text-2xl font-bold">Application Form Unavailable</h1>
          <p className="text-sm text-red-500">
            {error || "No active form is available right now."}
          </p>
          {formsCatalog.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Try one of these forms:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formsCatalog.map((item) => (
                  <Link
                    key={item.id}
                    href={`/apply/${item.slug}`}
                    className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm hover:border-blue-500"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 md:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {showFormsCatalog && formsCatalog.length > 0 && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold">Open Application Forms</h2>
              <span className="text-xs text-gray-500">
                Share form links by role or domain
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {formsCatalog.map((item) => {
                const active = item.slug === formConfig?.slug;
                return (
                  <Link
                    key={item.id}
                    href={`/apply/${item.slug}`}
                    className={`rounded-xl border p-3 transition ${
                      active
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    }`}
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">/{item.slug}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="bg-white dark:bg-gray-900 shadow-2xl rounded-2xl p-6 md:p-10 space-y-7">
          {currentUser && (currentRole === "candidate" || !currentRole) && (
            <div className="flex justify-end">
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Logout
              </button>
            </div>
          )}

          <div>
            <h1 className="text-3xl font-bold mb-2">
              {formConfig?.title || "Application Form"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {formConfig?.subject ||
                "Please complete the form below and upload your CV (PDF or CSV only)."}
            </p>
            {formConfig?.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                {formConfig.description}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Full Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium mb-2">
              Upload CV (PDF or CSV) *
            </label>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer">
              <input
                type="file"
                accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
                id="candidateCvUpload"
              />
              <label htmlFor="candidateCvUpload" className="cursor-pointer">
                {file ? (
                  <p className="text-green-600 font-medium">{file.name}</p>
                ) : (
                  <p className="text-gray-500">Click to upload your CV</p>
                )}
              </label>
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="space-y-5">
              <h3 className="text-xl font-semibold">Additional Information</h3>
              {customFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-2">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      rows={4}
                      value={extraFields[field.key] || ""}
                      onChange={(e) =>
                        setExtraFields((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                      placeholder={field.placeholder || ""}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={extraFields[field.key] || ""}
                      onChange={(e) =>
                        setExtraFields((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || "text"}
                      value={extraFields[field.key] || ""}
                      onChange={(e) =>
                        setExtraFields((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                      placeholder={field.placeholder || ""}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Assessment Questions</h3>
              {questions.map((q) => (
                <div key={q.id}>
                  <p className="font-medium mb-2">{q.question_text}</p>
                  <textarea
                    rows={4}
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}
