import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 3;
const MAX_CV_LENGTH = 15000;
const STALE_PROCESSING_MINUTES = 15;
const GROQ_TIMEOUT_MS = 45000;

function getSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function safeObject(input) {
  if (!input) return {};
  if (typeof input === "object") return input;
  try {
    const parsed = JSON.parse(String(input));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function recoverStaleProcessingJobs(supabase) {
  const cutoff = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000
  ).toISOString();

  await supabase
    .from("ai_jobs")
    .update({
      status: "retry",
      error: "Recovered stale processing job",
    })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

async function claimOneJob(supabase, candidateId) {
  const baseQuery = supabase
    .from("ai_jobs")
    .select("*")
    .in("status", ["pending", "retry"])
    .order("created_at", { ascending: true })
    .limit(1);

  const { data: selectedJob, error: selectError } = candidateId
    ? await baseQuery.eq("candidate_id", candidateId).maybeSingle()
    : await baseQuery.maybeSingle();

  if (selectError) throw selectError;
  if (!selectedJob) return null;

  const nextAttempts = (selectedJob.attempts || 0) + 1;

  const { data: claimedJob, error: claimError } = await supabase
    .from("ai_jobs")
    .update({
      status: "processing",
      attempts: nextAttempts,
      error: null,
    })
    .eq("id", selectedJob.id)
    .in("status", ["pending", "retry"])
    .select("*")
    .maybeSingle();

  if (claimError) throw claimError;
  return claimedJob || null;
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Return ONLY valid JSON. No markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(result));
    }

    const rawText = result?.choices?.[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 400)}`);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Groq request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function processNextJob(options = {}) {
  const supabase = getSupabaseAdminClient();
  const maxJobs = Math.min(Math.max(Number(options.maxJobs || 1), 1), 10);
  const targetCandidateId = options.candidateId || null;

  await recoverStaleProcessingJobs(supabase);

  let processed = 0;
  let candidateIdToPrioritize = targetCandidateId;

  while (processed < maxJobs) {
    const job = await claimOneJob(supabase, candidateIdToPrioritize);
    candidateIdToPrioritize = null;
    if (!job) break;

    try {
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", job.candidate_id)
        .single();

      if (candidateError || !candidate) {
        throw new Error(candidateError?.message || "Candidate record not found.");
      }

      const parsedAnswers = safeObject(candidate.answers);
      const usesEnvelope =
        parsedAnswers &&
        typeof parsedAnswers === "object" &&
        ("assessment" in parsedAnswers ||
          "extra_fields" in parsedAnswers ||
          "form" in parsedAnswers);

      const assessmentAnswers = usesEnvelope
        ? safeObject(parsedAnswers.assessment)
        : safeObject(parsedAnswers);
      const extraFields = usesEnvelope
        ? safeObject(parsedAnswers.extra_fields)
        : {};
      const formMeta = usesEnvelope ? safeObject(parsedAnswers.form) : {};

      const safeCvText =
        candidate.cv_text?.length > MAX_CV_LENGTH
          ? candidate.cv_text.slice(0, MAX_CV_LENGTH)
          : candidate.cv_text || "";

      const prompt = `
You are a senior technical hiring evaluator.

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

Evaluate ALL submitted inputs, including custom fields and assessment responses.
Be strict. Penalize shallow answers.

CV:
${safeCvText}

Application Form Context:
${JSON.stringify(formMeta, null, 2)}

Custom Form Inputs:
${JSON.stringify(extraFields, null, 2)}

Assessment Answers:
${JSON.stringify(assessmentAnswers, null, 2)}
`;

      const parsed = await callGroq(prompt);
      const finalScore = Number(parsed?.finalScore);
      const skillsScore = Number(parsed?.skillsScore ?? 0);
      const experienceScore = Number(parsed?.experienceScore ?? 0);
      const assessmentScore = Number(parsed?.assessmentScore ?? 0);
      const recommendation = parsed?.recommendation;

      if (Number.isNaN(finalScore) || !recommendation) {
        throw new Error("AI response missing required fields.");
      }

      await supabase
        .from("candidates")
        .update({
          ai_result: parsed,
          final_score: finalScore,
          skills_score: Number.isNaN(skillsScore) ? 0 : skillsScore,
          experience_score: Number.isNaN(experienceScore) ? 0 : experienceScore,
          assessment_score: Number.isNaN(assessmentScore) ? 0 : assessmentScore,
          status: recommendation === "Reject" ? "Rejected" : "Reviewed",
        })
        .eq("id", candidate.id);

      await supabase
        .from("ai_jobs")
        .update({
          status: "completed",
          error: null,
        })
        .eq("id", job.id);

      processed += 1;
    } catch (error) {
      const attempts = job.attempts || 0;
      const failed = attempts >= MAX_ATTEMPTS;
      const errorMessage = error?.message || "Unknown processor error";

      await supabase
        .from("ai_jobs")
        .update({
          status: failed ? "failed" : "retry",
          error: errorMessage,
        })
        .eq("id", job.id);

      await supabase
        .from("candidates")
        .update({
          status: failed ? "Failed" : "Processing",
        })
        .eq("id", job.candidate_id);

      console.error("PROCESSOR ERROR:", errorMessage);
      processed += 1;
    }
  }

  return { processed };
}
