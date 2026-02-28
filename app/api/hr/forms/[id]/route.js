import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHrOrAdmin } from "@/lib/requireAdmin";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((field, index) => {
    const key = slugify(field.key || field.label || `field-${index + 1}`);
    return {
      key: key || `field-${index + 1}`,
      label: String(field.label || `Field ${index + 1}`),
      type: ["text", "textarea", "email", "number", "select"].includes(field.type)
        ? field.type
        : "text",
      required: Boolean(field.required),
      placeholder: String(field.placeholder || ""),
      options: Array.isArray(field.options)
        ? field.options.map((o) => String(o)).filter(Boolean)
        : [],
    };
  });
}

export async function PATCH(req, { params }) {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const nowIso = new Date().toISOString();

    const updatePayload = {
      title: String(body.title || "Untitled Form"),
      subject: String(body.subject || ""),
      description: String(body.description || ""),
      slug: slugify(body.slug || body.title),
      fields: normalizeFields(body.fields),
      is_active: body.is_active !== false,
      updated_at: nowIso,
    };

    if (!updatePayload.slug) {
      return Response.json({ error: "Slug is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ success: true, item: data });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to update form" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.from("job_forms").delete().eq("id", id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to delete form" },
      { status: 500 }
    );
  }
}
