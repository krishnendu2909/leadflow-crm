"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, Printer, RefreshCw, Search, X, FileText } from "lucide-react";

type Lead = { id: string; name: string; mobile: string; address: string; village: string; district: string; state: string };
type Quotation = { quotationNumber: number; quotationDate: string; enquiryId: string; customerName: string; mobile: string; model: string; price: number; gstRate: number; gstAmount: number; total: number; amountWords: string; terms: string; createdAt: string };
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const defaultTerms = "1. This quotation is valid for 15 days from the date of issue.\n2. Prices are in Indian Rupees (INR).\n3. GST is charged at the rate selected in this quotation.\n4. Delivery, installation and payment terms shall be as mutually agreed.\n5. Any changes to the quoted model or specifications may change the quoted price.";

function amountInWords(value: number) {
  if (!Number.isFinite(value) || value < 0) return "";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underThousand = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`;
  };
  const whole = Math.floor(value);
  const paise = Math.round((value - whole) * 100);
  if (whole === 0 && paise === 0) return "Zero Rupees Only";
  let n = whole;
  const parts: string[] = [];
  for (const [size, label] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [1, ""]] as [number, string][]) {
    const chunk = Math.floor(n / size);
    if (chunk) parts.push(`${underThousand(chunk)}${label ? ` ${label}` : ""}`);
    n %= size;
  }
  return `${parts.join(" ")} Rupees${paise ? ` and ${underThousand(paise)} Paise` : ""} Only`;
}

export default function QuotationManager() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [enquiryId, setEnquiryId] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [gstRate, setGstRate] = useState<5 | 18>(18);
  const [terms, setTerms] = useState(defaultTerms);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [qRes, lRes] = await Promise.all([fetch("/api/quotations", { cache: "no-store" }), fetch("/api/leads", { cache: "no-store" })]);
      const [qData, lData] = await Promise.all([qRes.json(), lRes.json()]);
      if (!qRes.ok || !qData.success) throw new Error(qData.message || "Unable to load quotations.");
      if (!lRes.ok || !lData.success) throw new Error(lData.message || "Unable to load enquiries.");
      setQuotations(qData.quotations || []); setLeads(lData.leads || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load quotation data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const customer = leads.find((lead) => lead.id === enquiryId);
  const numericPrice = Number(price) || 0;
  const gstAmount = Number((numericPrice * gstRate / 100).toFixed(2));
  const total = Number((numericPrice + gstAmount).toFixed(2));
  const words = amountInWords(total);
  const filtered = useMemo(() => quotations.filter((q) => `${q.quotationNumber} ${q.enquiryId} ${q.customerName} ${q.model}`.toLowerCase().includes(search.toLowerCase())), [quotations, search]);

  function resetForm() { setEnquiryId(""); setModel(""); setPrice(""); setGstRate(18); setTerms(defaultTerms); setFormOpen(false); }
  async function saveQuotation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enquiryId, model, price: numericPrice, gstRate, amountWords: words, terms }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to save quotation.");
      setSelected(result.quotation); resetForm(); await fetchData();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save quotation."); }
    finally { setSaving(false); }
  }

  function printInvoice(q: Quotation) {
    setSelected(q);
    window.setTimeout(() => window.print(), 100);
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h2 className="text-2xl font-bold text-slate-900">Quotations</h2><p className="mt-1 text-sm text-slate-500">Create, track and print customer quotations as GST invoices.</p></div>
      <div className="flex gap-2"><button onClick={() => void fetchData()} className="rounded-xl border bg-white p-3 text-slate-600 hover:bg-slate-50" title="Refresh"><RefreshCw size={18} /></button><button onClick={() => { setSelected(null); setFormOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"><FilePlus2 size={17} /> Create Quotation</button></div>
    </div>
    {error && <div className="flex justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => setError("")}><X size={16}/></button></div>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Total Quotations</p><p className="mt-2 text-3xl font-bold">{quotations.length}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Quotation Value</p><p className="mt-2 text-2xl font-bold">{money(quotations.reduce((sum, q) => sum + q.total, 0))}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Latest Quotation No.</p><p className="mt-2 text-3xl font-bold">{quotations.length ? Math.max(...quotations.map(q => q.quotationNumber)) : 0}</p></div></div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-bold">Quotation Register</h3><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input className="rounded-xl border py-2 pl-9 pr-3 text-sm" placeholder="Search quotation, customer, model..." value={search} onChange={e => setSearch(e.target.value)}/></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["S.No.","Date","Enquiry ID","Customer","Model","Price","GST","Total","Invoice"].map(x=><th key={x} className="whitespace-nowrap px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(q=><tr key={q.quotationNumber} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold">{q.quotationNumber}</td><td className="px-4 py-3">{q.quotationDate}</td><td className="px-4 py-3">{q.enquiryId || "—"}</td><td className="px-4 py-3">{q.customerName}</td><td className="px-4 py-3">{q.model}</td><td className="px-4 py-3">{money(q.price)}</td><td className="px-4 py-3">{q.gstRate}%</td><td className="px-4 py-3 font-semibold">{money(q.total)}</td><td className="px-4 py-3"><button onClick={()=>printInvoice(q)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-100"><Printer size={14}/> Print</button></td></tr>)}{!loading && filtered.length===0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No quotations found. Create your first quotation.</td></tr>}</tbody></table></div>{loading && <p className="p-5 text-sm text-slate-500">Loading quotations...</p>}</section>

    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h3 className="text-xl font-bold">Create Quotation</h3><p className="text-sm text-slate-500">Quotation number is assigned sequentially when saved.</p></div><button onClick={resetForm} className="rounded-lg p-2 hover:bg-slate-100"><X/></button></div><form onSubmit={saveQuotation} className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Enquiry ID (optional)<select value={enquiryId} onChange={e=>setEnquiryId(e.target.value)} className={inputClass}><option value="">No linked enquiry / Walk-in</option>{leads.map(l=><option key={l.id} value={l.id}>{l.id} — {l.name} ({l.mobile})</option>)}</select></label><label className="text-sm font-medium">Quotation Date<input className={inputClass} value={today()} readOnly/></label></div>{customer && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm"><p className="font-semibold text-blue-900">{customer.name}</p><p className="mt-1 text-blue-800">{customer.mobile} · {[customer.address,customer.village,customer.district,customer.state].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-blue-700">Customer details fetched from the Leads tab.</p></div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Model being quoted *<input required value={model} onChange={e=>setModel(e.target.value)} className={inputClass} placeholder="Enter model / product name"/></label><label className="text-sm font-medium">Price for this model (₹) *<input required type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className={inputClass} placeholder="Enter base price"/></label><label className="text-sm font-medium">GST *<select value={gstRate} onChange={e=>setGstRate(Number(e.target.value) as 5|18)} className={inputClass}><option value={5}>5%</option><option value={18}>18%</option></select></label><div className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">GST amount</span><strong>{money(gstAmount)}</strong></div><div className="mt-2 flex justify-between text-base"><span className="font-semibold">Total price</span><strong className="text-blue-700">{money(total)}</strong></div></div></div><div className="rounded-xl border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount in words</p><p className="mt-2 text-sm font-semibold">{words || "Enter a price to calculate amount in words."}</p></div><label className="block text-sm font-medium">Terms and Conditions<textarea rows={5} value={terms} onChange={e=>setTerms(e.target.value)} className={inputClass}/></label><div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={resetForm} className="rounded-xl border px-5 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Saving...":"Save Quotation"}</button></div></form></div></div>}

    {selected && <div className="fixed inset-0 z-[70] overflow-y-auto bg-white p-4 sm:p-8 print:static print:overflow-visible print:p-0"><div className="mx-auto max-w-4xl"><div className="mb-5 flex justify-end gap-2 print:hidden"><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Printer size={16}/> Print Invoice</button><button onClick={()=>setSelected(null)} className="rounded-xl border px-4 py-2.5"><X size={16}/></button></div><article id="quotation-invoice" className="border border-slate-300 p-8 text-slate-900 print:border-0 print:p-0"><div className="flex items-start justify-between border-b-2 border-slate-900 pb-5"><div><div className="flex items-center gap-2"><FileText size={24}/><h1 className="text-2xl font-bold">LEADFLOW CRM</h1></div><p className="mt-2 text-sm text-slate-500">Quotation / Proforma Invoice</p></div><div className="text-right text-sm"><p><strong>Quotation No:</strong> {selected.quotationNumber}</p><p className="mt-1"><strong>Date:</strong> {selected.quotationDate}</p></div></div><div className="grid gap-6 py-6 sm:grid-cols-2"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Bill To</p><p className="font-semibold">{selected.customerName}</p><p className="text-sm">{selected.mobile}</p>{selected.enquiryId && <p className="mt-1 text-sm">Enquiry ID: {selected.enquiryId}</p>}</div><div className="sm:text-right"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Quotation Details</p><p className="text-sm">Currency: INR (₹)</p><p className="text-sm">GST Rate: {selected.gstRate}%</p></div></div><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-3 text-left">Description / Model</th><th className="border p-3 text-right">Price</th></tr></thead><tbody><tr><td className="border p-3">{selected.model}</td><td className="border p-3 text-right">{money(selected.price)}</td></tr></tbody></table><div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{money(selected.price)}</strong></div><div className="flex justify-between"><span>GST ({selected.gstRate}%)</span><strong>{money(selected.gstAmount)}</strong></div><div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg"><span className="font-bold">Grand Total</span><strong>{money(selected.total)}</strong></div></div><div className="mt-6 rounded-lg bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount in Words</p><p className="mt-1 text-sm font-semibold">{selected.amountWords}</p></div><div className="mt-7"><h2 className="font-bold">Terms &amp; Conditions</h2><ol className="mt-2 list-decimal whitespace-pre-line pl-5 text-sm leading-6">{selected.terms}</ol></div><div className="mt-14 flex justify-end"><div className="w-52 border-t border-slate-500 pt-2 text-center text-sm">Authorized Signatory</div></div><p className="mt-10 border-t pt-3 text-center text-xs text-slate-500">This is a computer-generated quotation.</p></article></div></div>}
    <style jsx global>{`@media print { body * { visibility: hidden !important; } #quotation-invoice, #quotation-invoice * { visibility: visible !important; } #quotation-invoice { position: absolute; inset: 0; width: 100%; } @page { size: A4; margin: 14mm; } }`}</style>
  </div>;
}
