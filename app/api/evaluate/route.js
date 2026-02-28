export const runtime = "nodejs";

import pdf from "pdf-parse-fixed";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const WORKER_TRIGGER_TIMEOUT_MS = 2000;
const CV_BUCKET = "candidate-cvs";

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

async function ensureCvBucket() {
  const { data: existingBucket } = await supabase.storage.getBucket(CV_BUCKET);
  if (existingBucket) return;

  const { error: createBucketError } = await supabase.storage.createBucket(
    CV_BUCKET,
    {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    }
  );

  if (createBucketError && !/already exists/i.test(createBucketError.message)) {
    throw createBucketError;
  }
}

async function extractCvText(buffer, file) {
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

async function uploadCvFile(buffer, file, candidateId) {
  await ensureCvBucket();

  const originalName = String(file.name || "cv.pdf");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${candidateId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CV_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  return {
    bucket: CV_BUCKET,
    path,
    name: originalName,
    mime_type: file.type || "application/octet-stream",
    size: file.size || null,
    uploaded_at: new Date().toISOString(),
  };
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
    const formDescription = String(formData.get("form_description") || "").trim();

    if (!file) {
      return Response.json({ result: "No file uploaded" }, { status: 400 });
    }

    const fileBytes = await file.arrayBuffer();
    const cvBuffer = Buffer.from(fileBytes);
    const cvText = await extractCvText(cvBuffer, file);

    const answersPayload = {
      form: {
        slug: formSlug || null,
        title: formTitle || null,
        subject: formSubject || null,
        description: formDescription || null,
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
          answers: answersPayload,
          status: "Processing",
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    try {
      const cvFileMeta = await uploadCvFile(cvBuffer, file, candidate.id);
      await supabase
        .from("candidates")
        .update({
          answers: {
            ...answersPayload,
            cv: cvFileMeta,
          },
        })
        .eq("id", candidate.id);
    } catch (cvUploadError) {
      console.error("CV_UPLOAD_ERROR:", cvUploadError);
    }

    await supabase.from("ai_jobs").insert([
      {
        candidate_id: candidate.id,
        status: "pending",
      },
    ]);

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
        body: JSON.stringify({
          candidateId: candidate.id,
          maxJobs: 1,
        }),
        signal: controller.signal,
      });
    } catch (workerError) {
      if (workerError?.name !== "AbortError") {
        console.error("WORKER_TRIGGER_ERROR:", workerError);
      }
    } finally {
      clearTimeout(timeoutId);
    }

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
