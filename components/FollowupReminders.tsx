
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  CalendarCheck,
  AlertCircle,
  CalendarDays,
  Phone,
  MessageSquare,
} from "lucide-react";

type Lead = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  village: string;
  district: string;
  state: string;
  product: string;
  subcategory: string;
  enquiryDate: string;
  quotationGiven: string;
  quotationAmount: number;
  dealStatus: string;
  lastFollowup: string;
  daysSinceActivity: number | null;
  category: string;
};

type Followup = {
  id: string;
  enquiryId: string;
  followupDate: string;
  remarks: string;
  nextFollowupDate: string;
  createdAt: string;
};

type Reminder = {
  lead: Lead;
  followup: Followup;
};

type Props = {
  onOpenFollowup: (lead: Lead) => void;
};

function localDateString(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function FollowupReminders({
  onOpenFollowup,
}: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
    const [today, setToday] = useState("");
  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [leadResponse, followupResponse] = await Promise.all([
        fetch("/api/leads", { cache: "no-store" }),
        fetch("/api/followups", { cache: "no-store" }),
      ]);

      const [leadResult, followupResult] = await Promise.all([
        leadResponse.json(),
        followupResponse.json(),
      ]);

      if (
        !leadResponse.ok ||
        !leadResult.success ||
        !followupResponse.ok ||
        !followupResult.success
      ) {
        throw new Error("Unable to load follow-up reminders.");
      }

      const leads: Lead[] = leadResult.leads || [];
      const followups: Followup[] = followupResult.followups || [];

      const leadMap = new Map(
        leads.map((lead) => [lead.id, lead])
      );

      // Keep the newest follow-up record for each customer.
      const latestByCustomer = new Map<string, Followup>();

      for (const item of followups) {
        if (!item.enquiryId || !item.nextFollowupDate) continue;

        const previous = latestByCustomer.get(item.enquiryId);

        if (
          !previous ||
          item.followupDate > previous.followupDate ||
          (
            item.followupDate === previous.followupDate &&
            item.createdAt > previous.createdAt
          )
        ) {
          latestByCustomer.set(item.enquiryId, item);
        }
      }

      const today = localDateString(new Date());

      const endDate = new Date(`${today}T00:00:00`);
      endDate.setDate(endDate.getDate() + 7);
      const lastDate = localDateString(endDate);

      const result: Reminder[] = [];

      for (const [enquiryId, followup] of latestByCustomer) {
        const lead = leadMap.get(enquiryId);
        const nextDate = followup.nextFollowupDate.slice(0, 10);

        if (
          lead &&
          nextDate <= lastDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(nextDate)
        ) {
          result.push({ lead, followup });
        }
      }

      result.sort((a, b) =>
        a.followup.nextFollowupDate.localeCompare(
          b.followup.nextFollowupDate
        )
      );

      setReminders(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reminders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    setToday(localDateString(new Date()));
    const interval = window.setInterval(fetchReminders, 30000);

    return () => window.clearInterval(interval);
  }, [fetchReminders]);

//   const today = localDateString(new Date());

  const overdue = reminders.filter(
    (item) => item.followup.nextFollowupDate < today
  );

  const dueToday = reminders.filter(
    (item) => item.followup.nextFollowupDate === today
  );

  const upcoming = reminders.filter(
    (item) => item.followup.nextFollowupDate > today
  );

  function ReminderCard({
    item,
    status,
  }: {
    item: Reminder;
    status: "Overdue" | "Today" | "Upcoming";
  }) {
    const styles = {
      Overdue: "border-red-200 bg-red-50 text-red-700",
      Today: "border-emerald-200 bg-emerald-50 text-emerald-700",
      Upcoming: "border-blue-200 bg-blue-50 text-blue-700",
    };

    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-800">
              {item.lead.name}
            </h4>

            <p className="mt-1 text-xs text-slate-500">
              {item.lead.mobile}
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {item.lead.product}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              <MessageSquare size={13} className="mr-1 inline" />
              {item.followup.remarks}
            </p>

            <p className="mt-3 text-xs font-medium">
              <CalendarDays size={13} className="mr-1 inline" />
              Contact date: {formatDate(item.followup.nextFollowupDate)}
            </p>
          </div>

          <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}
            >
              {status}
            </span>

            <button
              onClick={() => onOpenFollowup(item.lead)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Phone size={14} />
              Contact
            </button>
          </div>
        </div>
      </article>
    );
  }

  function ReminderSection({
    title,
    items,
    status,
  }: {
    title: string;
    items: Reminder[];
    status: "Overdue" | "Today" | "Upcoming";
  }) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-slate-400">
            No {status.toLowerCase()} follow-ups.
          </p>
        ) : (
          items.map((item) => (
            <ReminderCard
              key={item.lead.id}
              item={item}
              status={status}
            />
          ))
        )}
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarCheck size={21} className="text-blue-600" />
            Follow-up Reminders
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Overdue, today and next 7 days
          </p>
        </div>

        <button
          onClick={fetchReminders}
          disabled={loading}
          className="rounded-xl border p-3 hover:bg-slate-50 disabled:opacity-50"
          title="Refresh reminders"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={15} className="mr-2 inline" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Loading reminders...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-red-600">Overdue</p>
              <p className="mt-2 text-2xl font-bold text-red-700">
                {overdue.length}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-600">Due Today</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {dueToday.length}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-blue-600">Upcoming</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {upcoming.length}
              </p>
            </div>
          </div>

          <ReminderSection
            title="Overdue Follow-ups"
            items={overdue}
            status="Overdue"
          />

          <ReminderSection
            title="Today's Follow-ups"
            items={dueToday}
            status="Today"
          />

          <ReminderSection
            title="Upcoming — Next 7 Days"
            items={upcoming}
            status="Upcoming"
          />
        </>
      )}
    </section>
  );
}
