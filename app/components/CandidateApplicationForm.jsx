"use client";

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

async function fetchFormBySlug(slug) {
  const response = await fetch(`/api/forms/${encodeURIComponent(slug)}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Form not found");
  }
  return payload?.item || null;
}

export default function CandidateApplicationForm({
  slug = null,
  allowFormSelection = false,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [formConfig, setFormConfig] = useState(null);
  const [formsCatalog, setFormsCatalog] = useState([]);
  const [selectedFormSlug, setSelectedFormSlug] = useState(slug || "");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState(null);
  const [fieldValues, setFieldValues] = useState({});

  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  const customFields = useMemo(
    () => (Array.isArray(formConfig?.fields) ? formConfig.fields : []),
    [formConfig]
  );

  const assessmentFields = useMemo(
    () => customFields.filter((field) => field.type === "assessment"),
    [customFields]
  );
  const detailFields = useMemo(
    () => customFields.filter((field) => field.type !== "assessment"),
    [customFields]
  );

  useEffect(() => {
    setSelectedFormSlug(slug || "");
  }, [slug]);

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
        if (slug) {
          const item = await fetchFormBySlug(slug);
          if (!item) throw new Error("Form not found");
          setFormConfig(item);
          setFormsCatalog([]);
          setFieldValues({});
          setLoading(false);
          return;
        }

        if (allowFormSelection) {
          const formsResponse = await fetch("/api/forms");
          const formsPayload = await formsResponse.json();
          if (!formsResponse.ok) {
            throw new Error(formsPayload?.error || "Failed to load form list");
          }

          const items = formsPayload?.items || [];
          setFormsCatalog(items);

          if (items.length === 0) {
            throw new Error("No active form available right now.");
          }

          const validCurrent = items.some((item) => item.slug === selectedFormSlug);
          const resolvedSlug = validCurrent ? selectedFormSlug : items[0].slug;

          if (resolvedSlug !== selectedFormSlug) {
            setSelectedFormSlug(resolvedSlug);
          }

          const item = await fetchFormBySlug(resolvedSlug);
          if (!item) throw new Error("Form not found");
          setFormConfig(item);
          setFieldValues({});
          setLoading(false);
          return;
        }

        const response = await fetch("/api/forms/default");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Form not found");
        }
        if (!payload?.item) {
          throw new Error("No active form available right now.");
        }

        setFormConfig(payload.item);
        setFormsCatalog([]);
        setFieldValues({});
      } catch (err) {
        setFormConfig(null);
        setError(getFormErrorMessage(err?.message || ""));
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [slug, allowFormSelection, selectedFormSlug]);

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
      if (field.required && !String(fieldValues[field.key] || "").trim()) {
        setError(`Please fill the required field: ${field.label}`);
        return;
      }
    }

    const assessmentPayload = {};
    const extraFieldsPayload = {};

    for (const field of customFields) {
      const value = String(fieldValues[field.key] || "").trim();
      if (!value) continue;

      if (field.type === "assessment") {
        const questionKey = String(field.label || field.key || "assessment").trim();
        assessmentPayload[questionKey] = value;
      } else {
        extraFieldsPayload[field.key] = value;
      }
    }

    setError("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("cv", file);
      formData.append("name", name.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("assessment", JSON.stringify(assessmentPayload));
      formData.append("extra_fields", JSON.stringify(extraFieldsPayload));
      formData.append("form_slug", formConfig?.slug || "");
      formData.append("form_title", formConfig?.title || "");
      formData.append("form_subject", formConfig?.subject || "");
      formData.append("form_description", formConfig?.description || "");

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

  const renderFieldInput = (field) => {
    if (field.type === "textarea" || field.type === "assessment") {
      return (
        <textarea
          rows={4}
          value={fieldValues[field.key] || ""}
          onChange={(e) =>
            setFieldValues((prev) => ({
              ...prev,
              [field.key]: e.target.value,
            }))
          }
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
          placeholder={field.placeholder || ""}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={fieldValues[field.key] || ""}
          onChange={(e) =>
            setFieldValues((prev) => ({
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
      );
    }

    return (
      <input
        type={field.type || "text"}
        value={fieldValues[field.key] || ""}
        onChange={(e) =>
          setFieldValues((prev) => ({
            ...prev,
            [field.key]: e.target.value,
          }))
        }
        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
        placeholder={field.placeholder || ""}
      />
    );
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 md:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
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

          {allowFormSelection && !slug && formsCatalog.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Job Role You Are Applying For *
              </label>
              <select
                value={selectedFormSlug}
                onChange={(e) => setSelectedFormSlug(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              >
                {formsCatalog.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.title}
                    {item.subject ? ` - ${item.subject}` : ""}
                  </option>
                ))}
              </select>
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

          {assessmentFields.length > 0 && (
            <div className="space-y-5">
              <h3 className="text-xl font-semibold">Assessment Questions</h3>
              {assessmentFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-2">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  {renderFieldInput(field)}
                </div>
              ))}
            </div>
          )}

          {detailFields.length > 0 && (
            <div className="space-y-5">
              <h3 className="text-xl font-semibold">Additional Details</h3>
              {detailFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-2">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  {renderFieldInput(field)}
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
