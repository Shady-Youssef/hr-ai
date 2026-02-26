export const runtime = "nodejs";

import { processNextJob } from "../../lib/aiProcessor";

export async function POST() {
  try {
    await processNextJob();
    return Response.json({ message: "Worker executed" });
  } catch (error) {
    console.error("WORKER ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}