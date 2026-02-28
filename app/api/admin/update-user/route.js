import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { userId, first_name, last_name, phone } = await req.json();

    await supabaseAdmin
      .from("profiles")
      .update({
        first_name,
        last_name,
        phone,
        updated_at: new Date(),
      })
      .eq("id", userId);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
