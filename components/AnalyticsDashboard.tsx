
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  RefreshCw,
  Users,
  TrendingUp,
  IndianRupee,
  FileCheck,
} from "lucide-react";

type Analytics = {
  summary: {
    totalEnquiries: number;
    openDeals: number;
    closedDeals: number;
    conversionRate: number;
    quotationCount: number;
    quotationTotal: number;
  };
  monthlyEnquiries: {
    month: string;
    enquiries: number;
  }[];
  productAnalytics: {
    product: string;
    enquiries: number;
  }[];
  dealAnalytics: {
    status: string;
    count: number;
  }[];
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const chartColors = ["#2563eb", "#16a34a"];

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/analytics", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load analytics.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    const interval = window.setInterval(fetchAnalytics, 30000);

    return () => window.clearInterval(interval);
  }, [fetchAnalytics]);

  const summary = data?.summary;

  const cards = [
    {
      title: "Total Enquiries",
      value: summary?.totalEnquiries ?? 0,
      icon: Users,
      style: "bg-blue-50 text-blue-600",
    },
    {
      title: "Closed Deals",
      value: summary?.closedDeals ?? 0,
      icon: TrendingUp,
      style: "bg-green-50 text-green-600",
    },
    {
      title: "Conversion Rate",
      value: `${summary?.conversionRate ?? 0}%`,
      icon: FileCheck,
      style: "bg-purple-50 text-purple-600",
    },
    {
      title: "Quotation Value",
      value: currency(summary?.quotationTotal ?? 0),
      icon: IndianRupee,
      style: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Business Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Insights from your CRM enquiries and quotations.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50 disabled:opacity-50"
          title="Refresh analytics"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  {card.title}
                </p>
                <div className={`rounded-lg p-2 ${card.style}`}>
                  <Icon size={19} />
                </div>
              </div>

              <p className="mt-4 break-words text-2xl font-bold text-slate-900">
                {loading && !data ? "..." : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Loading business analytics...
        </p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-4 font-bold text-slate-800">
                Monthly Enquiry Trend
              </h3>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyEnquiries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="enquiries"
                      name="Enquiries"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-4 font-bold text-slate-800">
                Product-wise Enquiries
              </h3>

              {data.productAnalytics.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-400">
                  No product enquiry data available.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.productAnalytics.slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 12, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="product"
                        width={105}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="enquiries"
                        name="Enquiries"
                        fill="#2563eb"
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-4 font-bold text-slate-800">
                Deal Status Distribution
              </h3>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.dealAnalytics}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data.dealAnalytics.map((entry, index) => (
                        <Cell
                          key={entry.status}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="mb-5 font-bold text-slate-800">
                Quotation Overview
              </h3>

              <div className="space-y-5">
                <div>
                  <p className="text-sm text-slate-500">
                    Total quotations given
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {summary?.quotationCount ?? 0}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-slate-500">
                    Total quotation value
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {currency(summary?.quotationTotal ?? 0)}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-slate-500">
                    Open opportunities
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    {summary?.openDeals ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
