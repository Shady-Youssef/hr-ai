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
    console.error("INVITE_ERROR", {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      status: err?.status,
    });

    return Response.json(
      {
        error: err?.message || "Invite failed",
        code: err?.code || null,
        details: err?.details || null,
        hint: err?.hint || null,
      },
      { status: 500 }
    );
  }
}
