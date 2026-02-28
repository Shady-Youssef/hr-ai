import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req, { params }) {
  try {
    const { slug } = await params;
    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Form not found" }, { status: 404 });
    }

    return Response.json({ item: data });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to load form" },
      { status: 500 }
    );
  }
}
