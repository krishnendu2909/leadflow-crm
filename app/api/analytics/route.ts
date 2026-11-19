
import { NextResponse } from "next/server";
import { readSheet } from "@/lib/google-sheets";
import {
  getClassification,
  getIndiaToday,
  normalizeDate,
} from "@/lib/lead-utils";

function getLastSixMonths() {
  const today = getIndiaToday();
  const [year, month] = today.split("-").map(Number);

  const months: { key: string; label: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));

    months.push({
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    });
  }

  return months;
}

// Converts numeric and INR-formatted values into numbers.
function parseCurrency(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const raw = String(value).trim();

  // Handles values such as (₹50,000).
  const isNegative = raw.startsWith("(") && raw.endsWith(")");

  const cleaned = raw.replace(/[^\d.-]/g, "");
  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) return 0;

  return Math.max(0, isNegative ? -amount : amount);
}

export async function GET() {
  try {
    const [rows, followupRows] = await Promise.all([
      readSheet("Leads!A1:Q"),
      readSheet("Followups!A1:F"),
    ]);

    const leads = rows.slice(1).filter((row) => row[0]);
    const followups = followupRows.slice(1);

    // Find the latest follow-up for each enquiry.
    const latestFollowups = new Map<string, string>();

    for (const followup of followups) {
      const id = followup[1];
      const date = normalizeDate(followup[2]);

      if (!id || !date) continue;

      const existing = latestFollowups.get(id);

      if (!existing || date > existing) {
        latestFollowups.set(id, date);
      }
    }

    // Calculate lead categories using the same logic as Leads API.
    const classifications = leads.map((lead) => {
      const lastFollowup = latestFollowups.get(lead[0]) || "";

      return getClassification(lead[10] || "", lastFollowup);
    });

    const totalEnquiries = leads.length;

    const hotLeads = classifications.filter(
      (item) => item.category === "Hot"
    ).length;

    const warmLeads = classifications.filter(
      (item) => item.category === "Warm"
    ).length;

    const coldLeads = classifications.filter(
      (item) => item.category === "Cold"
    ).length;

    const unknownLeads = classifications.filter(
      (item) => item.category === "Unknown"
    ).length;

    const openDeals = leads.filter(
      (row) => (row[13] || "Open").trim() === "Open"
    ).length;

    const closedDeals = leads.filter(
      (row) => (row[13] || "").trim() === "Closed"
    ).length;

    // Quotation status is column L (index 11).
    // Quotation amount is column M (index 12).
    const quotationLeads = leads.filter(
      (row) => String(row[11] || "").trim().toLowerCase() === "yes"
    );

    const quotationCount = quotationLeads.length;

    const quotationTotal = quotationLeads.reduce(
      (sum, row) => sum + parseCurrency(row[12]),
      0
    );

    // Monthly enquiry trend.
    const months = getLastSixMonths();

    const monthlyEnquiries = months.map((month) => ({
      month: month.label,
      enquiries: 0,
    }));

    const monthIndex = new Map(
      months.map((month, index) => [month.key, index])
    );

    for (const lead of leads) {
      const date = normalizeDate(lead[10]);
      const key = date ? date.slice(0, 7) : "";
      const index = monthIndex.get(key);

      if (index !== undefined) {
        monthlyEnquiries[index].enquiries += 1;
      }
    }

    // Product-wise enquiries.
    const productCounts = new Map<string, number>();

    for (const lead of leads) {
      const product = (lead[8] || "Unspecified").trim();

      productCounts.set(
        product,
        (productCounts.get(product) || 0) + 1
      );
    }

    const productAnalytics = Array.from(
      productCounts,
      ([product, enquiries]) => ({ product, enquiries })
    ).sort((a, b) => b.enquiries - a.enquiries);

    const dealAnalytics = [
      { status: "Open", count: openDeals },
      { status: "Closed", count: closedDeals },
    ];

    const conversionRate =
      totalEnquiries > 0
        ? Number(((closedDeals / totalEnquiries) * 100).toFixed(1))
        : 0;

    return NextResponse.json({
      success: true,

      summary: {
        totalEnquiries,
        openDeals,
        closedDeals,
        conversionRate,
        quotationCount,
        quotationTotal,
        hotLeads,
        warmLeads,
        coldLeads,
        unknownLeads,
      },

      monthlyEnquiries,
      productAnalytics,
      dealAnalytics,
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load CRM analytics.",
      },
      { status: 500 }
    );
  }
}
