"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type GrowthItem = {
  date: string;
  count: number;
  cumulative: number;
  avgScore: number;
};

type FunnelItem = {
  name: string;
  value: number;
};

type ScoreDistItem = {
  range: string;
  count: number;
};

type TopCandidate = {
  id: string;
  name: string | null;
  email: string | null;
  final_score: number | null;
};

type AnalyticsData = {
  growth: GrowthItem[];
  funnelData: FunnelItem[];
  scoreDistribution: ScoreDistItem[];
  conversionRate: number;
  top5: TopCandidate[];
};

type Props = {
  initialData: AnalyticsData;
  days: number;
};

export default function AnalyticsClient({ initialData, days }: Props) {
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  const safeGrowth = useMemo(
    () =>
      (initialData?.growth || []).map((item) => ({
        date: item.date || "",
        count: Number(item.count) || 0,
        cumulative: Number(item.cumulative) || 0,
        avgScore: Number(item.avgScore) || 0,
      })),
    [initialData]
  );

  const growthWithMovingAverage = useMemo(
    () =>
      safeGrowth.map((item, index, array) => {
        const start = Math.max(0, index - 2);
        const slice = array.slice(start, index + 1);
        const movingAvg =
          slice.reduce((sum, curr) => sum + curr.avgScore, 0) / slice.length;

        return {
          ...item,
          movingAvg: Number(movingAvg.toFixed(2)) || 0,
        };
      }),
    [safeGrowth]
  );

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

        <div className="flex gap-4">
          <select
            value={days}
            onChange={(e) => router.push(`/admin/analytics?days=${e.target.value}`)}
            className="p-2 border rounded bg-gray-800"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>

          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          >
            Export PDF
          </button>
        </div>
      </div>

      <Section title="Cumulative Growth">
        <p className="text-sm text-gray-400 mb-4">
          Total candidates accumulated over time.
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

      <Section title="Average Score Over Time">
        <p className="text-sm text-gray-400 mb-4">
          Daily average score with 3-day moving average.
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

      <Section title="Score Distribution">
        <p className="text-sm text-gray-400 mb-4">
          Score distribution across candidate ranges.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={initialData.scoreDistribution || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Conversion Funnel">
        <p className="text-sm text-gray-400 mb-6">
          Candidate progression and drop-offs in the hiring pipeline.
        </p>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-6">
          {(initialData.funnelData || []).map((stage, index, arr) => {
            const nextStage = arr[index + 1];
            const dropPercentage =
              nextStage && stage.value > 0
                ? (((stage.value - nextStage.value) / stage.value) * 100).toFixed(1)
                : null;

            return (
              <div key={stage.name}>
                <div className="flex justify-between items-center bg-gradient-to-r from-gray-800 to-gray-700 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-400">{stage.name}</p>
                    <p className="text-2xl font-bold">{stage.value}</p>
                  </div>
                  <div className="text-right">
                    {index === 0 && (
                      <span className="text-xs text-gray-500">Total Applicants</span>
                    )}
                    {index === arr.length - 1 && (
                      <span className="text-xs text-green-400 font-semibold">
                        Final Hires
                      </span>
                    )}
                  </div>
                </div>

                {dropPercentage && (
                  <div className="flex justify-center items-center text-xs text-red-400 mt-2">
                    ↓ {dropPercentage}% drop
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-sm">
          <span className="text-gray-400">Overall Conversion Rate:</span>{" "}
          <span className="text-green-400 font-bold text-lg">
            {initialData.conversionRate}%
          </span>
        </div>
      </Section>

      <Section title="Top 5 Candidates">
        <p className="text-sm text-gray-400 mb-4">
          Highest scoring candidates in the selected period.
        </p>
        <div className="hidden md:block overflow-x-auto">
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
              {(initialData.top5 || []).map((candidate) => (
                <tr
                  key={candidate.id}
                  className="border-t border-gray-700 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3 font-medium">{candidate.name || "-"}</td>
                  <td className="p-3 text-sm text-gray-400">{candidate.email || "-"}</td>
                  <td className="p-3 font-bold text-blue-400">
                    {candidate.final_score ?? "-"}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/candidates/${candidate.id}`}
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

        <div className="md:hidden space-y-3">
          {(initialData.top5 || []).length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-[#0b1220] px-4 py-6 text-center text-sm text-gray-400">
              No candidate data found.
            </div>
          ) : (
            (initialData.top5 || []).map((candidate) => (
              <article
                key={`mobile-${candidate.id}`}
                className="rounded-xl border border-gray-800 bg-[#0b1220] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{candidate.name || "-"}</p>
                    <p className="text-sm text-gray-400 break-all mt-1">
                      {candidate.email || "-"}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-blue-400">
                    {candidate.final_score ?? "-"}
                  </p>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/admin/candidates/${candidate.id}`}
                    className="text-blue-500 hover:underline text-sm font-medium"
                  >
                    View &rarr;
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}
