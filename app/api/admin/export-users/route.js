import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const { data, error } = await supabaseAdmin.from("profiles").select("*");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const header = "First Name,Last Name,Phone,Role\n";

  const rows = (data || [])
    .map(
      (u) =>
        `${u.first_name || ""},${u.last_name || ""},${u.phone || ""},${
          u.role
        }`
    )
    .join("\n");

  const csv = header + rows;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=users.csv",
    },
  });
}
