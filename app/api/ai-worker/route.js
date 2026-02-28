export const runtime = "nodejs";

import { processNextJob } from "../../lib/aiProcessor";

export async function POST(req) {
  try {
    let payload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const maxJobs = Math.min(Math.max(Number(payload?.maxJobs || 1), 1), 10);
    const candidateId = payload?.candidateId || null;
    const result = await processNextJob({ maxJobs, candidateId });

    return Response.json({ message: "Worker executed", ...result });
  } catch (error) {
    console.error("WORKER ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
