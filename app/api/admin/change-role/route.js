import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { userId, role } = await req.json();

    await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
