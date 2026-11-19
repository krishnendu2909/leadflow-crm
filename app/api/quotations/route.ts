import { NextRequest, NextResponse } from "next/server";
import { appendRow, ensureSheet, readSheet } from "@/lib/google-sheets";

const HEADERS = ["Quotation Number", "Quotation Date", "Enquiry ID", "Customer Name", "Mobile Number", "Model", "Base Price", "GST Rate", "GST Amount", "Total Price", "Amount in Words", "Terms and Conditions", "Created At"];

const TERMS = "1. This quotation is valid for 15 days from the date of issue.\n2. Prices are in Indian Rupees (INR).\n3. GST is charged at the rate selected in this quotation.\n4. Delivery, installation and payment terms shall be as mutually agreed.\n5. Any changes to the quoted model or specifications may change the quoted price.";

function fail(error: unknown) {
  console.error("Quotations API error:", error);
  return NextResponse.json(
    { success: false, message: "Unable to process quotation request." },
    { status: 500 }
  );
}

function toQuotation(row: string[], index: number) {
  return {
    quotationNumber: Number(row[0]) || index + 1,
    quotationDate: row[1] || "",
    enquiryId: row[2] || "",
    customerName: row[3] || "",
    mobile: row[4] || "",
    model: row[5] || "",
    price: Number(row[6]) || 0,
    gstRate: Number(row[7]) || 0,
    gstAmount: Number(row[8]) || 0,
    total: Number(row[9]) || 0,
    amountWords: row[10] || "",
    terms: row[11] || TERMS,
    createdAt: row[12] || "",
  };
}

export async function GET() {
  try {
    await ensureSheet("Quotations", HEADERS);
    const rows = await readSheet("Quotations!A1:M");
    const quotations = rows.slice(1)
      .filter((row) => row[0])
      .map((row, index) => toQuotation(row, index))
      .sort((a, b) => b.quotationNumber - a.quotationNumber);

    return NextResponse.json({ success: true, quotations, terms: TERMS });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSheet("Quotations", HEADERS);
    const body = await request.json();
    const enquiryId = typeof body.enquiryId === "string" ? body.enquiryId.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const price = Number(body.price);
    const gstRate = Number(body.gstRate);
    const amountWords = typeof body.amountWords === "string" ? body.amountWords.trim() : "";
    const terms = typeof body.terms === "string" && body.terms.trim() ? body.terms.trim() : TERMS;

    if (!model) return NextResponse.json({ success: false, message: "Enter the model being quoted." }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ success: false, message: "Enter a valid price greater than zero." }, { status: 400 });
    if (![5, 18].includes(gstRate)) return NextResponse.json({ success: false, message: "Select GST of 5% or 18%." }, { status: 400 });

    let customerName = "Walk-in Customer";
    let mobile = "";
    if (enquiryId) {
      const leads = await readSheet("Leads!A1:Q");
      const lead = leads.slice(1).find((row) => String(row[0] || "").trim() === enquiryId);
      if (!lead) return NextResponse.json({ success: false, message: "Enquiry ID was not found in the Leads tab." }, { status: 404 });
      customerName = lead[2] || "";
      mobile = lead[3] || "";
    }

    // Read the existing serials and increment the highest number, rather than relying on row count.
    const rows = await readSheet("Quotations!A2:A");
    const highest = rows.reduce((max, row) => Math.max(max, Number.parseInt(String(row[0] || ""), 10) || 0), 0);
    const quotationNumber = highest + 1;
    const gstAmount = Number((price * gstRate / 100).toFixed(2));
    const total = Number((price + gstAmount).toFixed(2));
    const quotationDate = new Date().toISOString().slice(0, 10);
    const createdAt = new Date().toISOString();

    await appendRow("Quotations", [
      quotationNumber, quotationDate, enquiryId, customerName, mobile, model,
      price, gstRate, gstAmount, total, amountWords, terms, createdAt,
    ]);

    return NextResponse.json({
      success: true,
      quotation: { quotationNumber, quotationDate, enquiryId, customerName, mobile, model, price, gstRate, gstAmount, total, amountWords, terms, createdAt },
      message: "Quotation saved successfully.",
    }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
