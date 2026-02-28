import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_ROLES = new Set(["candidate", "hr", "admin"]);

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { email, role } = await req.json();
    const normalizedEmail = email?.trim()?.toLowerCase();

    if (!normalizedEmail) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const requestedRole = String(role || "").toLowerCase();
    const selectedRole = ALLOWED_ROLES.has(requestedRole)
      ? requestedRole
      : "candidate";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const redirectTo = new URL(
      "/register",
      siteUrl
    ).toString();

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    if (error) throw error;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          role: selectedRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          id: data.user.id,
          role: selectedRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (roleError) throw roleError;

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
