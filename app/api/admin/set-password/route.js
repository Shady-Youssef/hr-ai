import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

function isStrongPassword(password) {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { userId, password } = await req.json();

    if (!userId || !isStrongPassword(password)) {
      return Response.json(
        {
          error:
            "Invalid input. Password must be at least 8 characters and include letters and numbers.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
    });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to set password" },
      { status: 500 }
    );
  }
}
