export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("name,email,final_score,status,created_at")
      .order("final_score", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const header = "Name,Email,Score,Status,Created At\n";

    const rows = data
      .map(
        (c) =>
          `"${c.name}","${c.email}",${c.final_score},"${c.status}","${c.created_at}"`
      )
      .join("\n");

    const csv = header + rows;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=candidates.csv",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}