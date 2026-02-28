import { requireHrOrAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WORKER_TRIGGER_TIMEOUT_MS = 2000;

export async function POST(req) {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const { candidateId } = await req.json();

    if (!candidateId) {
      return Response.json(
        { error: "candidateId is required" },
        { status: 400 }
      );
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const { error: candidateUpdateError } = await supabaseAdmin
      .from("candidates")
      .update({
        status: "Processing",
        updated_at: nowIso,
      })
      .eq("id", candidateId);

    if (candidateUpdateError) throw candidateUpdateError;

    const { error: jobInsertError } = await supabaseAdmin.from("ai_jobs").insert([
      {
        candidate_id: candidateId,
        status: "pending",
        attempts: 0,
        error: null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    if (jobInsertError) throw jobInsertError;

    const workerUrl = new URL("/api/ai-worker", req.url).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      WORKER_TRIGGER_TIMEOUT_MS
    );

    try {
      await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, maxJobs: 1 }),
        signal: controller.signal,
      });
    } catch (workerError) {
      if (workerError?.name !== "AbortError") {
        console.error("RERUN_WORKER_TRIGGER_ERROR:", workerError);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    return Response.json({
      success: true,
      message: "AI re-run queued for this candidate.",
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to re-run AI" },
      { status: 500 }
    );
  }
}
