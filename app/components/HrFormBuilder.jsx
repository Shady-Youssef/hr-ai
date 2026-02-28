"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const FIELD_TYPES = ["text", "textarea", "assessment", "email", "number", "select"];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function emptyEditor() {
  return {
    id: null,
    title: "New Application Form",
    slug: "",
    subject: "",
    description: "",
    is_active: true,
    fields: [],
  };
}

function isGenericFieldKey(value) {
  return /^field[-_]?\d*$/.test(String(value || "").toLowerCase());
}

function getStableFieldKey(field, index) {
  const provided = slugify(field?.key || "");
  if (!provided || isGenericFieldKey(provided)) {
    const fromLabel = slugify(field?.label || "");
    return fromLabel || `field-${index + 1}`;
  }
  return provided;
}

export default function HrFormBuilder() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [editor, setEditor] = useState(emptyEditor());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState({ open: false, value: "" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiGuideOpen, setAiGuideOpen] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  const currentLink = useMemo(() => {
    if (!editor.slug) return "";
    return `${baseUrl}/apply/${editor.slug}`;
  }, [baseUrl, editor.slug]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/forms");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load forms");
      const items = data?.items || [];
      setForms(items);

      setEditor((prev) => {
        if (prev.id || items.length === 0) return prev;
        return {
          ...items[0],
          fields: Array.isArray(items[0].fields) ? items[0].fields : [],
        };
      });
    } catch (err) {
      showToast("error", err.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const selectForm = (item) => {
    setEditor({
      ...item,
      fields: Array.isArray(item.fields) ? item.fields : [],
    });
  };

  const createNewDraft = () => {
    setEditor(emptyEditor());
  };

  const saveForm = async () => {
    const slug = slugify(editor.slug || editor.title);
    if (!slug) {
      showToast("error", "Title or slug is required.");
      return;
    }

    setSaving(true);
    try {
      const normalizedFields = (editor.fields || []).map((field, index) => ({
        ...field,
        key: getStableFieldKey(field, index),
      }));

      const payload = {
        title: editor.title,
        slug,
        subject: editor.subject,
        description: editor.description,
        is_active: editor.is_active,
        fields: normalizedFields,
      };

      const endpoint = editor.id ? `/api/hr/forms/${editor.id}` : "/api/hr/forms";
      const method = editor.id ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save form");

      setEditor({
        ...data.item,
        fields: Array.isArray(data.item.fields) ? data.item.fields : [],
      });

      showToast("success", editor.id ? "Form updated." : "Form created.");
      fetchForms();
    } catch (err) {
      const message = String(err?.message || "Failed to save form");
      if (message.toLowerCase().includes("duplicate key value")) {
        showToast("error", "Slug already exists. Please choose another slug.");
      } else {
        showToast("error", message);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteForm = async () => {
    if (!editor.id) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/hr/forms/${editor.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete form");

      showToast("success", "Form deleted.");
      setEditor(emptyEditor());
      fetchForms();
    } catch (err) {
      showToast("error", err.message || "Failed to delete form");
    } finally {
      setDeleting(false);
    }
  };

  const addField = () => {
    const nextIndex = editor.fields.length + 1;
    setEditor((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          key: "",
          label: `Question ${nextIndex}`,
          type: "text",
          required: false,
          placeholder: "",
          options: [],
        },
      ],
    }));
  };

  const updateField = (index, patch) => {
    setEditor((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = { ...nextFields[index], ...patch };
      return { ...prev, fields: nextFields };
    });
  };

  const removeField = (index) => {
    setEditor((prev) => {
      const nextFields = [...prev.fields];
      nextFields.splice(index, 1);
      return { ...prev, fields: nextFields };
    });
  };

  const moveField = (index, direction) => {
    setEditor((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.fields.length) return prev;
      const nextFields = [...prev.fields];
      const [current] = nextFields.splice(index, 1);
      nextFields.splice(nextIndex, 0, current);
      return { ...prev, fields: nextFields };
    });
  };

  const copyLink = async () => {
    if (!currentLink) return;
    try {
      await navigator.clipboard.writeText(currentLink);
      showToast("success", "Form link copied.");
    } catch {
      setLinkDialog({ open: true, value: currentLink });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Forms</h2>
            <button
              onClick={createNewDraft}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              New Form
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading forms...</p>
          ) : forms.length === 0 ? (
            <p className="text-sm text-gray-400">No forms created yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {forms.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectForm(item)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    editor.id === item.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1">/{item.slug}</p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">
              {editor.id ? "Edit Form" : "Create Form"}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewOpen(true)}
                className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"
              >
                Preview
              </button>
              {editor.id && (
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              )}
              <button
                onClick={saveForm}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Form"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Form Title</label>
              <input
                value={editor.title || ""}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, title: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug (URL)</label>
              <input
                value={editor.slug || ""}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, slug: slugify(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
                placeholder="frontend-developer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Job Role (Used by AI)</label>
                <button
                  type="button"
                  onClick={() => setAiGuideOpen(true)}
                  className="text-xs rounded-md border border-blue-500/40 px-2 py-1 text-blue-400 hover:bg-blue-500/10"
                >
                  AI Guide
                </button>
              </div>
              <input
                value={editor.subject || ""}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
                placeholder="Frontend Developer"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={editor.is_active !== false}
                  onChange={(e) =>
                    setEditor((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Form is active
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Role Notes for AI (Optional)</label>
            <textarea
              value={editor.description || ""}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              placeholder="Describe key responsibilities, required stack, and must-have skills for this role."
            />
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Custom Fields</h3>
              <button
                onClick={addField}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                Add Field
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Base fields (Full Name, Email, CV) stay available. Add optional custom
              fields per form. Field IDs are generated automatically from labels.
            </p>

            {editor.fields.length === 0 ? (
              <p className="text-sm text-gray-400">No custom fields yet.</p>
            ) : (
              <div className="space-y-3">
                {editor.fields.map((field, index) => (
                  <div
                    key={index}
                    className="space-y-3 border border-gray-200 dark:border-gray-800 rounded-lg p-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <input
                        value={field.label || ""}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                        className="md:col-span-4 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                        placeholder="Label"
                      />
                      <select
                        value={field.type || "text"}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value })
                        }
                        className="md:col-span-4 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type === "assessment" ? "assessment" : type}
                          </option>
                        ))}
                      </select>
                      <label className="md:col-span-4 inline-flex items-center gap-2 rounded-md border border-gray-700 bg-[#0b1220] px-2 py-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) =>
                            updateField(index, { required: e.target.checked })
                          }
                        />
                        Required
                      </label>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Internal field ID:{" "}
                      <span className="font-mono">{getStableFieldKey(field, index)}</span>
                    </p>
                    {field.type === "assessment" && (
                      <p className="text-[11px] text-emerald-300">
                        This answer is treated as an assessment input for AI scoring.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <input
                        value={field.placeholder || ""}
                        onChange={(e) =>
                          updateField(index, { placeholder: e.target.value })
                        }
                        className="md:col-span-8 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                        placeholder="Placeholder"
                      />
                      <div className="md:col-span-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => moveField(index, -1)}
                          disabled={index === 0}
                          className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveField(index, 1)}
                          disabled={index === editor.fields.length - 1}
                          className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40"
                        >
                          Down
                        </button>
                        <button
                          onClick={() => removeField(index)}
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {field.type === "select" && (
                      <textarea
                        value={(field.options || []).join(", ")}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={2}
                        className="md:col-span-12 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                        placeholder="Comma-separated options"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-sm font-semibold mb-2">Form Link</h3>
            <div className="flex flex-col md:flex-row gap-2">
              <input
                value={currentLink}
                readOnly
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder="Save form to generate link"
              />
              <button
                onClick={copyLink}
                disabled={!currentLink}
                className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                Copy Link
              </button>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">Delete Form</h3>
            <p className="text-sm text-gray-300">
              Delete this form permanently? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-lg border border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDeleteOpen(false);
                  await deleteForm();
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {linkDialog.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">Copy Form Link</h3>
            <p className="text-sm text-gray-300">
              Clipboard access is blocked in this browser context. Copy the link
              below manually.
            </p>
            <input
              readOnly
              value={linkDialog.value}
              className="w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setLinkDialog({ open: false, value: "" })}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold">
                  {editor.title || "Untitled Form"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {editor.subject || "No subject"}
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            {editor.description && (
              <p className="text-sm text-gray-300">{editor.description}</p>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name *</label>
                <input
                  disabled
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                  placeholder="Candidate full name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  disabled
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                  placeholder="candidate@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">CV Upload *</label>
                <div className="mt-1 rounded-lg border-2 border-dashed border-gray-700 bg-[#0b1220] px-3 py-8 text-center text-sm text-gray-400">
                  PDF or CSV upload area
                </div>
              </div>

              {editor.fields.map((field, index) => (
                <div key={`${field.key}-preview-${index}`}>
                  <label className="text-sm font-medium">
                    {field.label || `Field ${index + 1}`}
                    {field.required ? " *" : ""}
                  </label>
                  {field.type === "textarea" || field.type === "assessment" ? (
                    <textarea
                      disabled
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                      placeholder={field.placeholder || ""}
                    />
                  ) : field.type === "select" ? (
                    <select
                      disabled
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                    >
                      <option>Select...</option>
                      {(field.options || []).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled
                      type={field.type || "text"}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b1220] px-3 py-2"
                      placeholder={field.placeholder || ""}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {aiGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-4">
            <h3 className="text-xl font-semibold">AI Role Guide</h3>
            <p className="text-sm text-gray-300">
              Use <strong>Job Role</strong> and <strong>Role Notes for AI</strong>{" "}
              to tell the model what this form is hiring for. The evaluator will use
              this context to penalize CVs that do not match the target role.
            </p>
            <div className="rounded-lg border border-gray-700 bg-[#0b1220] p-3 text-sm text-gray-300 space-y-2">
              <p>
                <strong>Example Job Role:</strong> Frontend Developer (React/Next.js)
              </p>
              <p>
                <strong>Example Role Notes:</strong> Must-have: React, TypeScript,
                state management, API integration, testing.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setAiGuideOpen(false)}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
