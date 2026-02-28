import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data } = await supabaseAdmin.from("profiles").select("*");

  const header = "First Name,Last Name,Phone,Role\n";

  const rows = data
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
