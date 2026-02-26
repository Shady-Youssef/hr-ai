export const runtime = "nodejs";

import pdf from "pdf-parse-fixed";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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

    // 1️⃣ Insert candidate
    const { data: candidate, error: insertError } =
      await supabase
        .from("candidates")
        .insert([
          {
            name,
            email,
            cv_text: cvText,
            answers: assessment,
            status: "Processing",
          },
        ])
        .select()
        .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    // 2️⃣ Insert AI job
    await supabase.from("ai_jobs").insert([
      {
        candidate_id: candidate.id,
        status: "pending",
      },
    ]);

    // 3️⃣ 🔥 Trigger worker WITHOUT await (background)
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ai-worker`, {
      method: "POST",
    }).catch(() => {});

    return Response.json({
      message:
        "Application submitted successfully. AI evaluation started.",
    });

  } catch (error) {
    console.error("API ERROR:", error);
    return new Response(
      JSON.stringify({ result: "Server error: " + error.message }),
      { status: 500 }
    );
  }
}