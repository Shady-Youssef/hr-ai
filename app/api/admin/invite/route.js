import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { email, role } = await req.json();
    const redirectTo = new URL(
      "/login",
      process.env.NEXT_PUBLIC_SITE_URL
    ).toString();

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
      }
    );

    if (error) throw error;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      role: role || "hr",
    });

    if (profileError) throw profileError;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
