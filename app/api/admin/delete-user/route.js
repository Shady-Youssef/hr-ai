import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

function extractAvatarPath(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== "string") return null;

  const marker = "/storage/v1/object/public/avatars/";
  const markerIndex = avatarUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  const path = avatarUrl.slice(markerIndex + marker.length).split("?")[0];
  return path || null;
}

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

    const cleanupErrors = [];

    const { data: profileData, error: profileReadError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profileReadError) {
      cleanupErrors.push(`profiles_read: ${profileReadError.message}`);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (authError) throw authError;

    const avatarPaths = new Set([`${userId}/avatar.png`]);
    const avatarPathFromProfile = extractAvatarPath(profileData?.avatar_url);
    if (avatarPathFromProfile) {
      avatarPaths.add(avatarPathFromProfile);
    }

    const { error: avatarError } = await supabaseAdmin.storage
      .from("avatars")
      .remove(Array.from(avatarPaths));
    if (avatarError) cleanupErrors.push(`avatars: ${avatarError.message}`);

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
