import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { email } = await req.json();
    const normalizedEmail = email?.trim()?.toLowerCase();

    if (!normalizedEmail) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const redirectTo = new URL(
      "/reset-password",
      siteUrl
    ).toString();

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
