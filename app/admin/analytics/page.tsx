import { getAnalyticsData } from "@/app/lib/serverAnalytics";
import AnalyticsClient from "./AnalyticsClient";

export const revalidate = 60; // Edge caching (Next.js ISR)

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const days = Number(searchParams.days || 30);

  const data = await getAnalyticsData(days);

  return <AnalyticsClient initialData={data} days={days} />;
}