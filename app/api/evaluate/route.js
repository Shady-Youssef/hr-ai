export const runtime = "nodejs";

import pdf from "pdf-parse-fixed";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("cv");
    const assessment = formData.get("assessment");
    const email = formData.get("email");
    const name = formData.get("name");

    if (!file) {
      return Response.json({ result: "No file uploaded" });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const data = await pdf(buffer);
    const cvText = data.text;

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
${cvText}

Assessment:
${assessment}
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

    // 🔥 هنا بنخزن البيانات في Supabase
    await supabase.from("candidates").insert([
      {
        name: name,
        email: email,
        cv_text: cvText,
        answers: assessment,
        ai_result: parsed,
        final_score: parsed.finalScore,
      },
    ]);

    return Response.json({
      result: parsed,
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return new Response(
      JSON.stringify({ result: "Server error: " + error.message }),
      { status: 500 }
    );
  }
}