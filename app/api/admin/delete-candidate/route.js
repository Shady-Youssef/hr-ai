import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { candidateId } = await req.json();

    if (!candidateId) {
      return Response.json({ error: "candidateId is required" }, { status: 400 });
    }

    // Delete candidate
    const { error: deleteError } = await supabaseAdmin
      .from("candidates")
      .delete()
      .eq("id", candidateId);

    if (deleteError) throw deleteError;

    return Response.json({
      success: true,
      message: "Candidate deleted successfully.",
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to delete candidate" },
      { status: 500 }
    );
  }
}
