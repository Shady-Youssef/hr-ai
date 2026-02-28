import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req) {
  const { response, user: adminUser } = await requireAdmin();
  if (response) return response;

  try {
    const { userId } = await req.json();

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId === adminUser.id) {
      return Response.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (authError) throw authError;

    const cleanupErrors = [];

    const { error: profilesError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profilesError) cleanupErrors.push(`profiles: ${profilesError.message}`);

    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", userId);
    if (rolesError) cleanupErrors.push(`user_roles: ${rolesError.message}`);

    return Response.json({
      success: true,
      warning: cleanupErrors.length ? cleanupErrors.join(" | ") : null,
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
