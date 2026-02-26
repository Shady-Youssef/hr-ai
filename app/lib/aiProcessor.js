import { createClient } from "@supabase/supabase-js";

export async function processNextJob() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const MAX_ATTEMPTS = 3;

  while (true) {

    const { data: job } = await supabase
      .from("ai_jobs")
      .select("*")
      .in("status", ["pending", "retry"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!job) break;

    try {

      await supabase
        .from("ai_jobs")
        .update({
          status: "processing",
          attempts: (job.attempts || 0) + 1,
        })
        .eq("id", job.id);

      const { data: candidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", job.candidate_id)
        .single();

      const MAX_CV_LENGTH = 15000;

      const safeCvText =
        candidate.cv_text?.length > MAX_CV_LENGTH
          ? candidate.cv_text.slice(0, MAX_CV_LENGTH)
          : candidate.cv_text;

      const prompt = `
You are a senior technical hiring evaluator.

Evaluate the candidate professionally and critically.

Return ONLY valid JSON in this exact format:

{
  "finalScore": number,
  "skillsScore": number,
  "experienceScore": number,
  "assessmentScore": number,
  "recommendation": "Strong Hire" | "Hire" | "Consider" | "Reject",
  "strengths": string[],
  "weaknesses": string[],
  "summary": string
}

SCORING RULES:

- skillsScore (0-100): Evaluate technical depth, clarity, and correctness in core technologies.
- experienceScore (0-100): Evaluate quality of projects, relevance, complexity, and ownership.
- assessmentScore (0-100): Evaluate depth, completeness, and correctness of answers.
  - Short shallow answers must score LOW even if technically correct.
  - Example: Saying "React is a frontend framework" is shallow and should score low.
  - The candidate must explain concepts, architecture, use cases, and demonstrate understanding.

FINAL SCORE CALCULATION:
- finalScore should be a weighted average:
  40% skillsScore
  30% experienceScore
  30% assessmentScore

CRITICAL:
- Be strict.
- Do not be generous.
- Penalize shallow answers heavily.
- Penalize incorrect terminology.
- Reward clarity and depth.

CV:
${safeCvText}

Assessment Answers:
${candidate.answers}
`;

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: "Return ONLY valid JSON. No markdown."
              },
              {
                role: "user",
                content: prompt
              }
            ],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(result));
      }

      const rawText =
        result.choices?.[0]?.message?.content || "";

      const cleaned = rawText.replace(/```json|```/g, "").trim();

      let parsed;

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("Invalid JSON from AI");
      }

      const finalScoreRaw =
        parsed?.finalScore ?? parsed?.final_score;

      const finalScore = Number(finalScoreRaw);

      const skillsScore = Number(parsed?.skillsScore ?? 0);
      const experienceScore = Number(parsed?.experienceScore ?? 0);
      const assessmentScore = Number(parsed?.assessmentScore ?? 0);

      const recommendation =
        parsed?.recommendation;

      if (
        isNaN(finalScore) ||
        !recommendation
      ) {
        throw new Error("AI response missing required fields");
      }

      await supabase
        .from("candidates")
        .update({
          ai_result: parsed,
          final_score: finalScore,
          skills_score: skillsScore,
          experience_score: experienceScore,
          assessment_score: assessmentScore,
          status:
            recommendation === "Reject"
              ? "Rejected"
              : "Reviewed",
        })
        .eq("id", candidate.id);

      await supabase
        .from("ai_jobs")
        .update({
          status: "completed",
          error: null,
        })
        .eq("id", job.id);

    } catch (error) {

      const attempts = (job.attempts || 0) + 1;

      await supabase
        .from("ai_jobs")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "retry",
          error: error.message,
        })
        .eq("id", job.id);

      console.error("PROCESSOR ERROR:", error);
    }
  }
}