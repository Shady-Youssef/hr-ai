import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_ROLES = new Set(["candidate", "hr", "admin"]);

function isStrongPassword(password) {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

function isRateLimitError(error) {
  return (error?.message || "").toLowerCase().includes("rate limit");
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
    const user = users.find((u) => (u.email || "").toLowerCase() === email);
    if (user) return user;
    if (users.length < perPage) break;
  }
  return null;
}

async function upsertUserData({ userId, role, first_name, last_name, phone }) {
  const nowIso = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        role,
        first_name: first_name || "",
        last_name: last_name || "",
        phone: phone || "",
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );
  if (profileError) throw profileError;

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        id: userId,
        role,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );
  if (roleError) throw roleError;
}

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const {
      email,
      role,
      first_name,
      last_name,
      phone,
      passwordMethod,
      password,
    } = await req.json();

    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedRole = String(role || "").toLowerCase();
    const chosenRole = ALLOWED_ROLES.has(normalizedRole)
      ? normalizedRole
      : "candidate";

    if (!normalizedEmail) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!["invite", "direct"].includes(passwordMethod)) {
      return Response.json(
        { error: "passwordMethod must be invite or direct" },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

    if (passwordMethod === "direct") {
      if (!isStrongPassword(password)) {
        return Response.json(
          {
            error:
              "Password must be at least 8 characters and include letters and numbers.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });
      if (error) throw error;

      const userId = data?.user?.id;
      if (!userId) throw new Error("Unable to create user account");

      await upsertUserData({
        userId,
        role: chosenRole,
        first_name,
        last_name,
        phone,
      });

      return Response.json({ success: true, mode: "created_direct" });
    }

    // Invite mode
    const registerRedirectTo = new URL("/register", siteUrl).toString();
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: registerRedirectTo }
    );

    if (!error) {
      await upsertUserData({
        userId: data?.user?.id,
        role: chosenRole,
        first_name,
        last_name,
        phone,
      });
      return Response.json({ success: true, mode: "invited" });
    }

    // Existing user fallback path
    const existingUser = await findAuthUserByEmail(normalizedEmail);
    if (!existingUser?.id) {
      throw error;
    }

    await upsertUserData({
      userId: existingUser.id,
      role: chosenRole,
      first_name,
      last_name,
      phone,
    });

    const resetRedirectTo = new URL("/reset-password", siteUrl).toString();
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: resetRedirectTo }
    );

    if (!resetError) {
      return Response.json({
        success: true,
        mode: "existing_user_reset",
        message: "User existed. Reset email sent.",
      });
    }

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
        message: "User existed. Email throttled. Use generated access link.",
        actionLink: linkData?.properties?.action_link || null,
      });
    }

    throw resetError;
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
