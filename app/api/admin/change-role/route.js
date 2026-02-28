import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_ROLES = new Set(["candidate", "hr", "admin"]);

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { userId, role } = await req.json();
    const selectedRole = role?.trim()?.toLowerCase();

    if (!userId || !ALLOWED_ROLES.has(selectedRole)) {
      return Response.json(
        { error: "Invalid userId or role" },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
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
          id: userId,
          role: selectedRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (roleError) throw roleError;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
