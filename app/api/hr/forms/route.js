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

export async function GET() {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return Response.json({ items: data || [] });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to fetch forms" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const body = await req.json();
    const nowIso = new Date().toISOString();
    const slug = slugify(body.slug || body.title);

    if (!slug) {
      return Response.json(
        { error: "Title or slug is required" },
        { status: 400 }
      );
    }

    const payload = {
      slug,
      title: String(body.title || "New Application Form"),
      subject: String(body.subject || ""),
      description: String(body.description || ""),
      fields: normalizeFields(body.fields),
      is_active: body.is_active !== false,
      updated_at: nowIso,
    };

    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ success: true, item: data });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to create form" },
      { status: 500 }
    );
  }
}
