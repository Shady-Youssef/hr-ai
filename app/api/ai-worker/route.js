export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_ATTEMPTS = 3;

export async function POST() {
  try {

    // 1️⃣ Get next pending job (oldest first)
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

    // 2️⃣ Mark as processing + increment attempts
    await supabase
      .from("ai_jobs")
      .update({
        status: "processing",
        attempts: job.attempts + 1
      })
      .eq("id", job.id);

    // 3️⃣ Get candidate
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", job.candidate_id)
      .single();

    if (candidateError) {
      throw new Error(candidateError.message);
    }

    // 4️⃣ Build Gemini prompt
    const prompt = `
You are an AI HR evaluation engine.

Return ONLY valid JSON in this exact format:

{
  "skillsScore": number,
  "experienceScore": number,
  "assessmentScore": number,
  "finalScore": number,
  "strengths": [string, string, string],
  "weaknesses": [string, string],
  "recommendation": "Strong Hire | Hire | Consider | Reject",
  "summary": string
}

Rules:
- finalScore = (skillsScore * 0.3) + (experienceScore * 0.4) + (assessmentScore * 0.3)
- No explanations outside JSON.
- No markdown.
- Only pure JSON.

Target Role: Frontend Developer

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

    // 5️⃣ Update candidate
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

    // 6️⃣ Mark job complete
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

    // Get job again to know attempts
    const { data: currentJob } = await supabase
      .from("ai_jobs")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!currentJob) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    if (currentJob.attempts >= MAX_ATTEMPTS) {
      // Mark failed permanently
      await supabase
        .from("ai_jobs")
        .update({
          status: "failed",
          error: error.message
        })
        .eq("id", currentJob.id);

      await supabase
        .from("candidates")
        .update({
          status: "AI Failed"
        })
        .eq("id", currentJob.candidate_id);

    } else {
      // Retry
      await supabase
        .from("ai_jobs")
        .update({
          status: "retry",
          error: error.message
        })
        .eq("id", currentJob.id);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}