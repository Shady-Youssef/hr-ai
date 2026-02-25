import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getAnalyticsData(days: number) {
  const { data, error } = await supabase.rpc(
    "analytics_summary",
    { days }
  );

  if (error) {
    console.error("RPC Error:", error);
    return {
      growth: [],
      funnelData: [],
      conversionRate: 0,
      top5: [],
    };
  }

  // 🔥 Proper normalization
  const normalizedGrowth =
    (data?.growth || []).map((item: any) => ({
      date: item.date,
      count: Number(item.count),
      cumulative: Number(item.cumulative),
      avgScore: Number(item.avgScore ?? item.avg_score ?? 0),
    }));

  return {
  growth: normalizedGrowth,
  funnelData: data?.funnel || [],
  scoreDistribution: data?.scoreDistribution || [],
  conversionRate: data?.conversionRate || 0,
  top5: data?.top5 || [],
};
}