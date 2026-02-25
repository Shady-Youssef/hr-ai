"use client";

import { useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  FunnelChart,
  Funnel,
  LabelList,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function AnalyticsClient({
  initialData,
  days,
}: any) {
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  const safeGrowth = useMemo(() => {
    if (!initialData?.growth) return [];

    return initialData.growth.map((item: any) => ({
      date: item.date || "",
      count: Number(item.count) || 0,
      cumulative: Number(item.cumulative) || 0,
      avgScore: Number(item.avgScore) || 0,
    }));
  }, [initialData]);

  const growthWithMovingAverage = useMemo(() => {
    return safeGrowth.map((item: any, index: number, array: any[]) => {
      const start = Math.max(0, index - 2);
      const slice = array.slice(start, index + 1);

      const movingAvg =
        slice.reduce((sum, curr) => sum + curr.avgScore, 0) /
        slice.length;

      return {
        ...item,
        movingAvg: movingAvg || 0,
      };
    });
  }, [safeGrowth]);

  const exportPDF = async () => {
    if (!dashboardRef.current) return;

    const canvas = await html2canvas(dashboardRef.current);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save("analytics-report.pdf");
  };

  return (
    <div className="p-6" ref={dashboardRef}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold">
          Analytics Dashboard
        </h1>

        <div className="flex gap-4">
          <select
            value={days}
            onChange={(e) =>
              router.push(`/admin/analytics?days=${e.target.value}`)
            }
            className="p-2 border rounded bg-gray-800"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>

          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* ================= CUMULATIVE ================= */}
      <Section title="Cumulative Growth">
        <p className="text-sm text-gray-400 mb-4">
          Shows the total number of candidates accumulated over time.
          This helps you understand hiring growth and application volume trends.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={safeGrowth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ================= AVG SCORE ================= */}
      <Section title="Average Score Over Time">
        <p className="text-sm text-gray-400 mb-4">
          Displays the daily average candidate evaluation score.
          The moving average line smooths fluctuations to highlight the overall quality trend.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={growthWithMovingAverage}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />

            <Line
              type="monotone"
              dataKey="avgScore"
              name="Daily Average"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="movingAvg"
              name="3-Day Moving Avg"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ================= SCORE DISTRIBUTION ================= */}
      <Section title="Score Distribution">
        <p className="text-sm text-gray-400 mb-4">
          Shows how candidate scores are distributed across performance ranges.
          This reveals overall talent quality and concentration levels.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={initialData.scoreDistribution || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="count"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              isAnimationActive
            />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* ================= FUNNEL ================= */}
      <Section title="Conversion Funnel">
        <p className="text-sm text-gray-400 mb-4">
          Visualizes candidate progression from total applications to final hires.
          Helps identify drop-offs and bottlenecks in the hiring pipeline.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <FunnelChart>
            <Tooltip />
            <Funnel
              dataKey="value"
              data={initialData.funnelData || []}
              isAnimationActive
            >
              <LabelList position="right" dataKey="name" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>

        <div className="mt-4 text-sm text-gray-400">
          Conversion Rate:{" "}
          <span className="text-green-400 font-semibold">
            {initialData.conversionRate}%
          </span>
          <span className="ml-2 text-gray-500">
            — Percentage of applicants successfully hired.
          </span>
        </div>
      </Section>

      {/* ================= TOP 5 ================= */}
      <Section title="Top 5 Candidates">
        <p className="text-sm text-gray-400 mb-4">
          Highlights the highest scoring candidates within the selected time range.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Score</th>
                <th className="p-3">View</th>
              </tr>
            </thead>
            <tbody>
              {(initialData.top5 || []).map((c: any) => (
                <tr
                  key={c.id}
                  className="border-t border-gray-700 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-sm text-gray-400">{c.email}</td>
                  <td className="p-3 font-bold text-blue-400">
                    {c.final_score}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="text-blue-500 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-16">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}