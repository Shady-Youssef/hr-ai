import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .select("id, slug, title, subject, description, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return Response.json({ items: data || [] });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to load forms" },
      { status: 500 }
    );
  }
}
