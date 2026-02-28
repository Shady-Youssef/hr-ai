export const runtime = "nodejs";

import pdf from "pdf-parse-fixed";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseJsonObject(input) {
  if (!input) return {};
  if (typeof input === "object") return input;

  try {
    const parsed = JSON.parse(String(input));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function extractCvText(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = (file.name || "").toLowerCase();
  const fileType = (file.type || "").toLowerCase();
  const looksLikeCsv =
    fileName.endsWith(".csv") ||
    fileType.includes("text/csv") ||
    fileType.includes("application/vnd.ms-excel");

  if (looksLikeCsv) {
    return buffer.toString("utf8");
  }

  const parsedPdf = await pdf(buffer);
  return parsedPdf?.text || "";
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("cv");
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") || "").trim();

    const assessment = parseJsonObject(formData.get("assessment"));
    const extraFields = parseJsonObject(formData.get("extra_fields"));
    const formSlug = String(formData.get("form_slug") || "").trim();
    const formTitle = String(formData.get("form_title") || "").trim();
    const formSubject = String(formData.get("form_subject") || "").trim();

    if (!file) {
      return Response.json({ result: "No file uploaded" }, { status: 400 });
    }

    const cvText = await extractCvText(file);

    const answersPayload = {
      form: {
        slug: formSlug || null,
        title: formTitle || null,
        subject: formSubject || null,
      },
      assessment,
      extra_fields: extraFields,
    };

    const { data: candidate, error: insertError } = await supabase
      .from("candidates")
      .insert([
        {
          name,
          email,
          cv_text: cvText,
          answers: JSON.stringify(answersPayload),
          status: "Processing",
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    await supabase.from("ai_jobs").insert([
      {
        candidate_id: candidate.id,
        status: "pending",
      },
    ]);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    fetch(`${siteUrl}/api/ai-worker`, {
      method: "POST",
    }).catch(() => {});

    return Response.json({
      message: "Application submitted successfully. AI evaluation started.",
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return new Response(
      JSON.stringify({ result: "Server error: " + error.message }),
      { status: 500 }
    );
  }
}
