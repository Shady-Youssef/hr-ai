import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getAnalyticsData(days: number) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data } = await supabase
    .from("candidates")
    .select("id,name,email,status,final_score,ai_result,created_at")
    .gte("created_at", fromDate.toISOString())
    .order("created_at", { ascending: true });

  const candidates = data || [];

  let cumulative = 0;
  const grouped: any = {};

  candidates.forEach((c) => {
    const date = new Date(c.created_at)
      .toISOString()
      .split("T")[0];

    if (!grouped[date]) {
      grouped[date] = {
        date,
        count: 0,
        totalScore: 0,
      };
    }

    grouped[date].count++;
    grouped[date].totalScore += Number(c.final_score || 0);
  });

  const growth = Object.values(grouped).map((d: any) => {
    cumulative += d.count;
    return {
      date: d.date.slice(5),
      count: d.count,
      cumulative,
      avgScore:
        d.count > 0
          ? (d.totalScore / d.count).toFixed(1)
          : 0,
    };
  });

  const hired = candidates.filter((c) => c.status === "Hired").length;
  const pending = candidates.filter((c) => c.status === "Pending").length;

  const conversionRate =
    candidates.length > 0
      ? ((hired / candidates.length) * 100).toFixed(1)
      : 0;

  const top5 = [...candidates]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 5);

  return {
    growth,
    funnelData: [
      { name: "Total", value: candidates.length },
      { name: "Pending", value: pending },
      { name: "Hired", value: hired },
    ],
    conversionRate,
    top5,
  };
}