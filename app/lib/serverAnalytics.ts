import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clampDays(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 30;
  return Math.min(365, Math.max(1, Math.floor(parsed)));
}

function formatDay(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function scoreRange(score) {
  if (score == null || Number.isNaN(Number(score))) return "N/A";
  const value = Number(score);
  if (value < 50) return "0-49";
  if (value < 60) return "50-59";
  if (value < 70) return "60-69";
  if (value < 80) return "70-79";
  if (value < 90) return "80-89";
  return "90-100";
}

export async function getAnalyticsData(daysInput) {
  const days = clampDays(daysInput);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("candidates")
    .select("id, name, email, final_score, status, created_at")
    .gte("created_at", fromDate)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Analytics Query Error:", error);
    return {
      growth: [],
      funnelData: [],
      scoreDistribution: [],
      conversionRate: 0,
      top5: [],
    };
  }

  const candidates = data || [];
  const perDayMap = new Map();
  let cumulative = 0;

  for (const candidate of candidates) {
    const day = formatDay(candidate.created_at);
    const current = perDayMap.get(day) || {
      date: day,
      count: 0,
      scoreSum: 0,
      scoreCount: 0,
    };

    current.count += 1;
    const score = Number(candidate.final_score);
    if (!Number.isNaN(score)) {
      current.scoreSum += score;
      current.scoreCount += 1;
    }
    perDayMap.set(day, current);
  }

  const growth = Array.from(perDayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      cumulative += item.count;
      return {
        date: item.date,
        count: item.count,
        cumulative,
        avgScore:
          item.scoreCount > 0
            ? Number((item.scoreSum / item.scoreCount).toFixed(2))
            : 0,
      };
    });

  const total = candidates.length;
  const reviewed = candidates.filter((c) =>
    ["Reviewed", "Shortlisted", "Rejected", "Failed", "Hired"].includes(c.status)
  ).length;
  const shortlisted = candidates.filter((c) => c.status === "Shortlisted").length;
  const hired = candidates.filter((c) => c.status === "Hired").length;

  const funnelData = [
    { name: "Applied", value: total },
    { name: "Reviewed", value: reviewed },
    { name: "Shortlisted", value: shortlisted },
    { name: "Hired", value: hired },
  ];

  const conversionRate =
    total > 0 ? Number(((hired / total) * 100).toFixed(1)) : 0;

  const distributionMap = new Map([
    ["0-49", 0],
    ["50-59", 0],
    ["60-69", 0],
    ["70-79", 0],
    ["80-89", 0],
    ["90-100", 0],
    ["N/A", 0],
  ]);

  for (const candidate of candidates) {
    const bucket = scoreRange(candidate.final_score);
    distributionMap.set(bucket, (distributionMap.get(bucket) || 0) + 1);
  }

  const scoreDistribution = Array.from(distributionMap.entries()).map(
    ([range, count]) => ({
      range,
      count,
    })
  );

  const top5 = [...candidates]
    .filter((candidate) => !Number.isNaN(Number(candidate.final_score)))
    .sort((a, b) => Number(b.final_score) - Number(a.final_score))
    .slice(0, 5);

  return {
    growth,
    funnelData,
    scoreDistribution,
    conversionRate,
    top5,
  };
}
