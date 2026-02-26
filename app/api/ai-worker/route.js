export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {

  const internalCall = req.headers.get("x-internal-call");

  if (!internalCall) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {

    const { data: job } = await supabase
      .from("ai_jobs")
      .select("*")
      .in("status", ["pending", "retry"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!job) {
      return Response.json({ message: "No pending jobs" });
    }

    await supabase
      .from("ai_jobs")
      .update({
        status: "processing",
        attempts: job.attempts + 1
      })
      .eq("id", job.id);

    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", job.candidate_id)
      .single();

    const prompt = `
You are an AI HR evaluation engine.

Return ONLY valid JSON.

CV:
${candidate.cv_text}

Assessment:
${candidate.answers}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(result));
    }

    const rawText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    await supabase
      .from("candidates")
      .update({
        ai_result: parsed,
        final_score: parsed.finalScore,
        status:
          parsed.recommendation === "Reject"
            ? "Rejected"
            : "Reviewed",
      })
      .eq("id", candidate.id);

    await supabase
      .from("ai_jobs")
      .update({
        status: "completed",
        error: null
      })
      .eq("id", job.id);

    return Response.json({ message: "Job processed successfully" });

  } catch (error) {

    console.error("WORKER ERROR:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}