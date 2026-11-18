
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Plus,
  RefreshCw,
  CalendarDays,
  History,
  MessageSquare,
} from "lucide-react";

type Followup = {
  id: string;
  enquiryId: string;
  followupDate: string;
  remarks: string;
  nextFollowupDate: string;
  createdAt: string;
};

type Props = {
  enquiryId: string;
  customerName: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(now.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function FollowupManager({
  enquiryId,
  customerName,
  onClose,
  onSaved,
}: Props) {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [followupDate, setFollowupDate] = useState(getToday());
  const [remarks, setRemarks] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/followups?enquiryId=${encodeURIComponent(enquiryId)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load follow-up history.");
      }

      setFollowups(result.followups || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load follow-up history."
      );
    } finally {
      setLoading(false);
    }
  }, [enquiryId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/followups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enquiryId,
          followupDate,
          remarks,
          nextFollowupDate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save follow-up.");
      }

      setSuccess("Follow-up saved successfully.");
      setRemarks("");
      setFollowupDate(getToday());
      setNextFollowupDate("");

      await fetchHistory();
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Follow-up Management
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Customer: {customerName}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Enquiry ID: {enquiryId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close follow-up manager"
          >
            <X size={21} />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
              <Plus size={18} className="text-blue-600" />
              Record New Follow-up
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2">
                  <CalendarDays size={15} />
                  Contact Date *
                </span>
                <input
                  type="date"
                  required
                  max={getToday()}
                  className={inputClass}
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                />
              </label>

              <label className="block text-sm font-medium">
                Remarks *
                <textarea
                  required
                  minLength={2}
                  rows={5}
                  className={inputClass}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Describe the call, meeting or customer response..."
                />
              </label>

              <label className="block text-sm font-medium">
                Next Follow-up Date
                <input
                  type="date"
                  min={followupDate}
                  className={inputClass}
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Save Follow-up
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="border-t pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-slate-800">
                <History size={18} className="text-blue-600" />
                Follow-up History
              </h3>

              <button
                onClick={fetchHistory}
                disabled={loading}
                className="rounded-lg border p-2 text-slate-500 hover:bg-slate-50"
                title="Refresh history"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Loading history...
              </p>
            ) : followups.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <MessageSquare
                  size={30}
                  className="mx-auto mb-2 text-slate-300"
                />
                <p className="text-sm font-medium text-slate-600">
                  No follow-ups yet
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your saved interactions will appear here.
                </p>
              </div>
            ) : (
              <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {followups.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDate(item.followupDate)}
                      </p>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                        Follow-up
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                      {item.remarks}
                    </p>

                    {item.nextFollowupDate && (
                      <p className="mt-3 border-t pt-2 text-xs text-slate-500">
                        Next contact:{" "}
                        <strong className="text-slate-700">
                          {formatDate(item.nextFollowupDate)}
                        </strong>
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t p-5">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
