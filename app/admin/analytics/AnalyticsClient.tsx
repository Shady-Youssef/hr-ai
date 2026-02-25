"use client";

import Link from "next/link";
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
} from "recharts";
import { useRouter } from "next/navigation";

export default function AnalyticsClient({
  initialData,
  days,
}: any) {
  const router = useRouter();

  return (
    <div className="p-6">

      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">
          Analytics Dashboard
        </h1>

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
      </div>

      {/* Cumulative */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={initialData.growth}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#3b82f6"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Funnel */}
      <div className="mt-16">
        <ResponsiveContainer width="100%" height={300}>
          <FunnelChart>
            <Tooltip />
            <Funnel
              dataKey="value"
              data={initialData.funnelData}
            >
              <LabelList position="right" dataKey="name" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>

        <div className="mt-4 text-sm">
          Conversion Rate:{" "}
          <span className="text-green-400 font-semibold">
            {initialData.conversionRate}%
          </span>
        </div>
      </div>

      {/* Top 5 */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold mb-4">
          Top 5 Candidates
        </h2>

        <table className="min-w-[700px] w-full text-left">
          <thead>
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Score</th>
              <th className="p-3">View</th>
            </tr>
          </thead>
          <tbody>
            {initialData.top5.map((c: any) => (
              <tr key={c.id}>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{c.final_score}</td>
                <td className="p-3">
                  <Link
                    href={`/admin/candidates/${c.id}`}
                    className="text-blue-500 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}