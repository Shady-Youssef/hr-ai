import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHrOrAdmin } from "@/lib/requireAdmin";

function parseAnswers(answers) {
  if (!answers) return {};
  if (typeof answers === "object") return answers;

  try {
    const parsed = JSON.parse(String(answers));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeFileName(name, fallback = "candidate-cv.pdf") {
  const value = String(name || fallback).trim();
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || fallback;
}

export async function GET(_req, context) {
  const { response } = await requireHrOrAdmin();
  if (response) return response;

  try {
    const resolvedParams = await Promise.resolve(context?.params || {});
    const candidateId = resolvedParams?.id;

    if (!candidateId) {
      return Response.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, answers")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    const answers = parseAnswers(candidate.answers);
    const cvMeta = answers?.cv || {};
    const bucket = cvMeta?.bucket || "candidate-cvs";
    const filePath = cvMeta?.path || cvMeta?.file_path;

    if (!filePath) {
      return Response.json(
        { error: "No uploaded CV file is available for this candidate." },
        { status: 404 }
      );
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) throw downloadError;

    const fileName = safeFileName(
      cvMeta?.name || `${candidate.name || candidate.email || "candidate"}-cv.pdf`
    );
    const contentType = cvMeta?.mime_type || fileBlob.type || "application/octet-stream";
    const fileBuffer = await fileBlob.arrayBuffer();

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to download CV" },
      { status: 500 }
    );
  }
}
