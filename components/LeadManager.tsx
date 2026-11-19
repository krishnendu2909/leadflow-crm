
"use client";

import { useCallback, useEffect, useState } from "react";
import FollowupManager from "@/components/FollowupManager";
import FollowupReminders from "@/components/FollowupReminders";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import QuotationManager from "@/components/QuotationManager";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Users,
  Flame,
  Clock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  IndianRupee,
  CalendarDays,
  FileSpreadsheet,
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

type FormData = {
  enquiryId: string;
  name: string;
  mobile: string;
  address: string;
  village: string;
  district: string;
  state: string;
  product: string;
  subcategory: string;
  enquiryDate: string;
  quotationGiven: "Yes" | "No";
  quotationAmount: number;
  dealStatus: "Open" | "Closed" | "Dropped";
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const emptyForm: FormData = {
  enquiryId: "",
  name: "",
  mobile: "",
  address: "",
  village: "",
  district: "",
  state: "",
  product: "",
  subcategory: "",
  enquiryDate: "",
  quotationGiven: "No",
  quotationAmount: 0,
  dealStatus: "Open",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function LeadManager() {
  const [activeSection, setActiveSection] = useState<"Overview" | "Enquiries" | "Quotations">("Overview");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [reminderLead, setReminderLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [districtFilter, setDistrictFilter] = useState("All");
const [productFilter, setProductFilter] = useState("All");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/leads", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to fetch enquiries.");
      }

      setLeads(result.leads || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load enquiries."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function changeField<K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function getNextEnquiryId() {
    const highest = leads.reduce((max, lead) => {
      const match = /^KPD(\d+)$/i.exec(String(lead.id || "").trim());
      return match ? Math.max(max, Number(match[1])) : max;
    }, 100);
    return `KPD${highest + 1}`;
  }

  function openAddModal() {
    setEditingId(null);
    setForm({ ...emptyForm, enquiryId: getNextEnquiryId(), enquiryDate: "" });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(lead: Lead) {
    setEditingId(lead.id);

    setForm({
      enquiryId: lead.id,
      name: lead.name,
      mobile: lead.mobile,
      address: lead.address,
      village: lead.village,
      district: lead.district,
      state: lead.state,
      product: lead.product,
      subcategory: lead.subcategory,
      enquiryDate: lead.enquiryDate,
      quotationGiven: lead.quotationGiven === "Yes" ? "Yes" : "No",
      quotationAmount: lead.quotationAmount || 0,
      dealStatus: lead.dealStatus === "Closed" ? "Closed" : lead.dealStatus === "Dropped" ? "Dropped" : "Open",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        // Keep the entered quotation amount even if the user changes
        // Quotation Given? to No; do not silently discard the value.
        quotationAmount: Number(form.quotationAmount) || 0,
        id: editingId,
      };

      const response = await fetch("/api/leads", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save enquiry.");
      }

      setSuccess(
        editingId
          ? "Enquiry updated successfully!"
          : `Enquiry created successfully! ID: ${result.id}`
      );

      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      await fetchLeads();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(lead: Lead) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${lead.name}?\n\nEnquiry ID: ${lead.id}\n\nAssociated follow-up records will also be deleted. This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/leads?id=${encodeURIComponent(lead.id)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete enquiry.");
      }

      setSuccess("Enquiry deleted successfully.");
      await fetchLeads();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete enquiry."
      );
    }
  }
async function exportToExcel() {
  try {
    const XLSX = await import("xlsx");

    const exportData = filteredLeads.map((lead) => ({
      "Enquiry ID": lead.id,
      "Customer Name": lead.name,
      "Mobile Number": lead.mobile,
      Address: lead.address,
      Village: lead.village,
      District: lead.district,
      State: lead.state,
      Product: lead.product,
      Subcategory: lead.subcategory,
      "Enquiry Date": lead.enquiryDate,
      "Quotation Given": lead.quotationGiven,
      "Quotation Amount": lead.quotationAmount,
      "Deal Status": lead.dealStatus,
      "Last Follow-up": lead.lastFollowup,
      "Days Since Activity": lead.daysSinceActivity,
      "Lead Category": lead.category,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Enquiries"
    );

    XLSX.writeFile(
      workbook,
      `CRM_Enquiries_${today()}.xlsx`
    );
  } catch (err) {
    console.error("Excel export failed:", err);
    setError("Unable to export Excel file.");
  }
}
  const filteredLeads = leads.filter((lead) => {
  const searchable = [
    lead.id,
    lead.name,
    lead.mobile,
    lead.product,
    lead.district,
    lead.village,
  ]
    .join(" ")
    .toLowerCase();

  const matchesSearch = searchable.includes(search.toLowerCase());

  const matchesCategory =
    filter === "All" ||
    lead.category === filter ||
    lead.dealStatus === filter;

  const matchesDistrict =
    districtFilter === "All" ||
    lead.district === districtFilter;

  const matchesProduct =
    productFilter === "All" ||
    lead.product === productFilter;

  const matchesFrom =
    !dateFrom || lead.enquiryDate >= dateFrom;

  const matchesTo =
    !dateTo || lead.enquiryDate <= dateTo;

  return (
    matchesSearch &&
    matchesCategory &&
    matchesDistrict &&
    matchesProduct &&
    matchesFrom &&
    matchesTo
  );
});

  const stats = [
    {
      title: "Total Enquiries",
      value: leads.length,
      icon: Users,
      style: "bg-blue-50 text-blue-600",
    },
    {
      title: "Hot Leads",
      value: leads.filter((l) => l.category === "Hot").length,
      icon: Flame,
      style: "bg-red-50 text-red-600",
    },
    {
      title: "Warm Leads",
      value: leads.filter((l) => l.category === "Warm").length,
      icon: Clock,
      style: "bg-amber-50 text-amber-600",
    },
    {
      title: "Cold Leads",
      value: leads.filter((l) => l.category === "Cold").length,
      icon: CheckCircle2,
      style: "bg-slate-100 text-slate-600",
    },
  ];

  const openDeals = leads.filter(
    (lead) => lead.dealStatus === "Open"
  ).length;

  const closedDeals = leads.filter(
    (lead) => lead.dealStatus === "Closed"
  ).length;

  function formatDate(value: string) {
    if (!value) return "—";

    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00`
        : value
    );

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }

  function categoryStyle(category: string) {
    switch (category) {
      case "Hot":
        return "bg-red-50 text-red-600";
      case "Warm":
        return "bg-amber-50 text-amber-700";
      case "Cold":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-800">
      <aside className="leadflow-sidebar hidden lg:flex">
        <div className="leadflow-brand">
          <span className="leadflow-mark">L</span>
          <span>
            <strong>LeadFlow</strong>
            <small>CRM WORKSPACE</small>
          </span>
        </div>

        <p className="leadflow-nav-label">WORKSPACE</p>

        <button
          type="button"
          className={`leadflow-nav-item ${activeSection === "Overview" ? "active" : ""}`}
          onClick={() => setActiveSection("Overview")}
        >
          ▦ <span>Overview</span>
        </button>

        <button
          type="button"
          className={`leadflow-nav-item ${activeSection === "Enquiries" ? "active" : ""}`}
          onClick={() => setActiveSection("Enquiries")}
        >
          ▤ <span>Enquiries</span>
        </button>

        <button
          type="button"
          className={`leadflow-nav-item ${activeSection === "Enquiries" ? "active" : ""}`}
          onClick={() => setActiveSection("Enquiries")}
        >
          ♙ <span>Leads</span>
        </button>

        <button
          type="button"
          className={`leadflow-nav-item ${activeSection === "Enquiries" ? "active" : ""}`}
          onClick={() => setActiveSection("Enquiries")}
        >
          ▣ <span>Customers</span>
        </button>

        <button
          type="button"
          className={`leadflow-nav-item ${activeSection === "Quotations" ? "active" : ""}`}
          onClick={() => setActiveSection("Quotations")}
        >
          ▧ <span>Quotations</span>
        </button>

        <button
          type="button"
          className="leadflow-nav-item"
          onClick={() => {
            setActiveSection("Enquiries");
            window.setTimeout(() => {
              document.getElementById("followup-reminders")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 0);
          }}
        >
          ◷ <span>Follow-ups</span>
        </button>

        <p className="leadflow-nav-label insights-label">INSIGHTS</p>
        <button
          type="button"
          className="leadflow-nav-item"
          onClick={() => {
            setActiveSection("Enquiries");
            window.setTimeout(() => {
              document.getElementById("business-analytics")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 0);
          }}
        >
          ◫ <span>Analytics</span>
        </button>

        <div className="leadflow-sidebar-foot">
          <span className="leadflow-avatar">LF</span>
          <span>
            <strong>LeadFlow CRM</strong>
            <small>Workspace</small>
          </span>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-white px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white">
            <FileSpreadsheet size={22} />
          </div>

          <div>
            <h1 className="text-lg font-bold text-slate-900">
              LeadFlow CRM
            </h1>
            <p className="text-xs text-slate-500">
              Enquiry Management
            </p>
          </div>
        </div>

        <button
          onClick={fetchLeads}
          disabled={loading}
          className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50 disabled:opacity-50"
          title="Refresh enquiries"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </header>

      <nav className="border-b bg-white px-5 md:px-8">
        <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto">
          {(["Overview", "Enquiries", "Quotations"] as const).map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeSection === section
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {section === "Quotations" ? "▧ " : section === "Enquiries" ? "▤ " : "▦ "}
              {section}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
        {activeSection === "Quotations" ? <QuotationManager /> : <>
        {/* Page heading */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Enquiry Management
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage customer information, enquiries and sales opportunities.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
          >
            <Plus size={18} />
            Add New Enquiry
          </button>
        </section>

        {/* Notifications */}
        {success && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <span>{success}</span>
            <button onClick={() => setSuccess("")}>
              <X size={17} />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}

        {/* Statistics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {stat.title}
                  </p>

                  <div className={`rounded-xl p-3 ${stat.style}`}>
                    <Icon size={21} />
                  </div>
                </div>

                <p className="mt-5 text-3xl font-bold text-slate-900">
                  {loading ? "..." : stat.value}
                </p>
              </div>
            );
          })}
        </section>

        {/* Deal summary */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Open Deals</p>
            <p className="mt-2 text-3xl font-bold">{openDeals}</p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Closed Deals</p>
            <p className="mt-2 text-3xl font-bold">{closedDeals}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Dropped Deals</p>
            <p className="mt-2 text-3xl font-bold">{leads.filter((lead) => lead.dealStatus === "Dropped").length}</p>
          </div>
        </section>
          <div id="followup-reminders" className="scroll-mt-24">
            <FollowupReminders
              onOpenFollowup={(lead) => setReminderLead(lead)}
            />
          </div>
          {/* Business Analytics */}
          <div id="business-analytics" className="scroll-mt-24">
            <AnalyticsDashboard />
          </div>
      <div className="grid grid-cols-1 gap-3 border-t p-5 sm:grid-cols-2 lg:grid-cols-5">

  <select
    value={districtFilter}
    onChange={(e) => setDistrictFilter(e.target.value)}
    className="rounded-xl border bg-white px-3 py-2.5 text-sm"
  >
    <option value="All">All Districts</option>
    {[...new Set(leads.map((lead) => lead.district).filter(Boolean))]
      .sort()
      .map((district) => (
        <option key={district} value={district}>
          {district}
        </option>
      ))}
  </select>

  <select
    value={productFilter}
    onChange={(e) => setProductFilter(e.target.value)}
    className="rounded-xl border bg-white px-3 py-2.5 text-sm"
  >
    <option value="All">All Products</option>
    {[...new Set(leads.map((lead) => lead.product).filter(Boolean))]
      .sort()
      .map((product) => (
        <option key={product} value={product}>
          {product}
        </option>
      ))}
  </select>

  <label className="text-xs text-slate-500">
    From Date
    <input
      type="date"
      value={dateFrom}
      max={dateTo || undefined}
      onChange={(e) => setDateFrom(e.target.value)}
      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-slate-700"
    />
  </label>

  <label className="text-xs text-slate-500">
    To Date
    <input
      type="date"
      value={dateTo}
      min={dateFrom || undefined}
      onChange={(e) => setDateTo(e.target.value)}
      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-slate-700"
    />
  </label>

  <button
    onClick={() => {
      setSearch("");
      setFilter("All");
      setDistrictFilter("All");
      setProductFilter("All");
      setDateFrom("");
      setDateTo("");
    }}
    className="rounded-xl border px-3 py-2.5 text-sm font-medium hover:bg-slate-50"
  >
    Clear Filters
  </button>

</div>
        {/* Enquiry table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col justify-between gap-4 border-b p-5 md:flex-row md:items-center">
            <div>
              <h3 className="font-bold text-slate-900">
                All Enquiries
                <button
  onClick={exportToExcel}
  disabled={filteredLeads.length === 0}
  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
>
  <FileSpreadsheet size={17} />
  Export Excel ({filteredLeads.length})
</button>
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {filteredLeads.length} of {leads.length} records
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <div className="flex items-center gap-2 rounded-xl border px-3">
                <Search size={17} className="text-slate-400" />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full py-2.5 text-sm outline-none sm:w-48"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border bg-white px-4 py-2.5 text-sm"
              >
                {[
                  "All",
                  "Hot",
                  "Warm",
                  "Cold",
                  "Open",
                  "Closed",
                  "Dropped",
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Enquiry ID</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Enquiry Date</th>
                  <th className="px-5 py-4">Lead Type</th>
                  <th className="px-5 py-4">Deal Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      Loading enquiries...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <ClipboardList
                        size={35}
                        className="mx-auto mb-3 text-slate-300"
                      />
                      <p className="font-semibold text-slate-600">
                        No enquiries found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Add your first enquiry to get started.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="transition hover:bg-slate-50">

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {lead.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {lead.mobile}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-medium text-blue-600">
                        {lead.id}
                      </td>

                      <td className="px-5 py-4">
                        <p>{lead.product}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {lead.subcategory}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {lead.village || lead.district || "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(lead.enquiryDate)}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryStyle(lead.category)}`}>
                          {lead.category}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          lead.dealStatus === "Closed"
                            ? "bg-green-50 text-green-700"
                            : lead.dealStatus === "Dropped"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                        }`}>
                          {lead.dealStatus}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
  onClick={() => setFollowupLead(lead)}
  title="Manage follow-ups"
  className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"
>
  <CalendarDays size={16} />
</button>
                          <button
                            onClick={() => openEditModal(lead)}
                            title="Edit enquiry"
                            className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => handleDelete(lead)}
                            title="Delete enquiry"
                            className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        </>}
      </div>
      
      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">

          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Enquiry" : "Add New Enquiry"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {editingId
                    ? `Enquiry ID: ${editingId}`
                    : "Register a new customer enquiry."}
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 hover:bg-slate-100"
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-5">

              {/* Customer information */}
              <section>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Users size={17} className="text-blue-600" />
                  Customer Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <label className="text-sm font-medium">
                    Customer Name *
                    <input
                      required
                      minLength={2}
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => changeField("name", e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Mobile Number *
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      className={inputClass}
                      value={form.mobile}
                      onChange={(e) =>
                        changeField(
                          "mobile",
                          e.target.value.replace(/\D/g, "").slice(0, 10)
                        )
                      }
                      placeholder="10-digit mobile number"
                    />
                  </label>

                  <label className="text-sm font-medium sm:col-span-2">
                    Full Address
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={(e) => changeField("address", e.target.value)}
                      placeholder="House number, street, etc."
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Village / Town
                    <input
                      className={inputClass}
                      value={form.village}
                      onChange={(e) => changeField("village", e.target.value)}
                      placeholder="Village or town"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    District
                    <input
                      className={inputClass}
                      value={form.district}
                      onChange={(e) => changeField("district", e.target.value)}
                      placeholder="District"
                    />
                  </label>

                  <label className="text-sm font-medium sm:col-span-2">
                    State
                    <input
                      className={inputClass}
                      value={form.state}
                      onChange={(e) => changeField("state", e.target.value)}
                      placeholder="State"
                    />
                  </label>

                </div>
              </section>

              {/* Product information */}
              <section className="border-t pt-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <MapPin size={17} className="text-blue-600" />
                  Enquiry Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <label className="text-sm font-medium sm:col-span-2">
                    Enquiry Number *
                    <input
                      required
                      className={`${inputClass} bg-slate-50 font-semibold text-blue-700`}
                      value={form.enquiryId}
                      readOnly
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Automatically assigned in sequence (KPD101, KPD102, KPD103...).
                    </span>
                  </label>

                  <label className="text-sm font-medium">
                    Product Category *
                    <input
                      required
                      className={inputClass}
                      value={form.product}
                      onChange={(e) => changeField("product", e.target.value)}
                      placeholder="Enter product category"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Product Subcategory
                    <input
                      className={inputClass}
                      value={form.subcategory}
                      onChange={(e) => changeField("subcategory", e.target.value)}
                      placeholder="Enter subcategory"
                    />
                  </label>

                  <div className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <CalendarDays size={15} />
                      Enquiry Date
                    </span>
                    <input
                      type="date"
                      required
                      className={inputClass}
                      value={form.enquiryDate}
                      onChange={(e) => changeField("enquiryDate", e.target.value)}
                      aria-label="Enter enquiry date"
                    />
                    <p className="mt-1 text-xs font-normal text-slate-400">
                      Enter the date the customer enquiry was received. This date is saved and retained when you edit the enquiry.
                    </p>
                  </div>

                  <label className="text-sm font-medium">
                    Quotation Given?
                    <select
                      className={inputClass}
                      value={form.quotationGiven}
                      onChange={(e) =>
                        changeField(
                          "quotationGiven",
                          e.target.value as "Yes" | "No"
                        )
                      }
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>

                  {form.quotationGiven === "Yes" && (
                    <label className="text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <IndianRupee size={15} />
                        Quotation Amount
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={form.quotationAmount}
                        onChange={(e) =>
                          changeField(
                            "quotationAmount",
                            Number(e.target.value)
                          )
                        }
                        placeholder="Enter amount"
                      />
                    </label>
                  )}

                  <label className="text-sm font-medium">
                    Deal Status
                    <select
                      className={inputClass}
                      value={form.dealStatus}
                      onChange={(e) =>
                        changeField(
                          "dealStatus",
                          e.target.value as "Open" | "Closed" | "Dropped"
                        )
                      }
                    >
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                      <option value="Dropped">Dropped</option>
                    </select>
                  </label>

                </div>
              </section>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      {editingId ? "Save Changes" : "Create Enquiry"}
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
        
      )}
      {followupLead && (
  <FollowupManager
    enquiryId={followupLead.id}
    customerName={followupLead.name}
    onClose={() => setFollowupLead(null)}
    onSaved={fetchLeads}
  />
)}
  {reminderLead && (
  <FollowupManager
    enquiryId={reminderLead.id}
    customerName={reminderLead.name}
    onClose={() => setReminderLead(null)}
    onSaved={async () => {
      await fetchLeads();
    }}
  />
)}
    </main>
  );
}
