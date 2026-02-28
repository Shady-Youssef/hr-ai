import { getAnalyticsData } from "@/app/lib/serverAnalytics";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const parsed = parseInt(resolvedSearchParams?.days || "", 10);
  const days = isNaN(parsed) ? 30 : parsed;

  const data = await getAnalyticsData(days);

  return (
    <AnalyticsClient
      initialData={data}
      days={days}
    />
  );
}
