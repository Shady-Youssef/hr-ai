import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_ROLES = new Set(["candidate", "hr", "admin"]);

function isRateLimitError(error) {
  const message = (error?.message || "").toLowerCase();
  return message.includes("rate limit");
}

async function findAuthUserByEmail(email) {
  const perPage = 200;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = data?.users || [];
    const match = users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase()
    );

    if (match) return match;
    if (users.length < perPage) break;
  }

  return null;
}

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

    if (error) {
      const errorMessage = (error.message || "").toLowerCase();
      const isAlreadyRegistered =
        errorMessage.includes("already been registered") ||
        errorMessage.includes("already registered") ||
        errorMessage.includes("user already exists");

      if (!isAlreadyRegistered) throw error;

      const existingUser = await findAuthUserByEmail(normalizedEmail);

      if (!existingUser?.id) {
        throw error;
      }

      const resetRedirectTo = new URL("/reset-password", siteUrl).toString();
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: resetRedirectTo }
      );

      if (resetError) {
        if (isRateLimitError(resetError)) {
          const { data: linkData, error: linkError } =
            await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email: normalizedEmail,
              options: { redirectTo: resetRedirectTo },
            });

          if (linkError) throw linkError;

          return Response.json({
            success: true,
            mode: "existing_user_manual_link",
            message:
              "User already exists and email rate limit was hit. Use the generated access link manually.",
            actionLink: linkData?.properties?.action_link || null,
          });
        }

        throw resetError;
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: existingUser.id,
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
            id: existingUser.id,
            role: selectedRole,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (roleError) throw roleError;

      return Response.json({
        success: true,
        mode: "existing_user_reset",
        message:
          "User already exists. Sent password setup/reset email instead.",
      });
    }

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
