import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_forms")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Response.json({ item: data || null });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to load default form" },
      { status: 500 }
    );
  }
}
