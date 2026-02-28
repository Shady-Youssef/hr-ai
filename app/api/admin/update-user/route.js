import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { userId, first_name, last_name, phone } = await req.json();

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: first_name || "",
          last_name: last_name || "",
          phone: phone || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
