import { NextRequest, NextResponse } from "next/server";
import { appendRow, ensureSheet, readSheet } from "@/lib/google-sheets";

// Keep this order exactly aligned with the user's existing Quotations!A:L headers.
const HEADERS = [
  "Quotation No",
  "Enquiry ID",
  "Customer Name",
  "Mobile Number",
  "Model",
  "Price",
  "GST Rate",
  "GST Amount",
  "Total Price",
  "Amount in Words",
  "Terms and Conditions",
  "Quotation Date",
];

const TERMS =
  "1. This quotation is valid for 15 days from the date of issue.\n" +
  "2. Prices are in Indian Rupees (INR).\n" +
  "3. GST is charged at the rate selected in this quotation.\n" +
  "4. Delivery, installation and payment terms shall be as mutually agreed.\n" +
  "5. Any changes to the quoted model or specifications may change the quoted price.";

function fail(error: unknown) {
  console.error("Quotations API error:", error);
  return NextResponse.json(
    { success: false, message: "Unable to process quotation request." },
    { status: 500 }
  );
}

function toQuotation(row: string[]) {
  return {
    quotationNumber: Number(row[0]) || 0,
    enquiryId: row[1] || "",
    customerName: row[2] || "Walk-in Customer",
    mobile: row[3] || "",
    model: row[4] || "",
    price: Number(row[5]) || 0,
    gstRate: Number(row[6]) || 0,
    gstAmount: Number(row[7]) || 0,
    total: Number(row[8]) || 0,
    amountWords: row[9] || "",
    terms: row[10] || TERMS,
    quotationDate: row[11] || "",
  };
}

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET() {
  try {
    await ensureSheet("Quotations", HEADERS);
    const rows = await readSheet("Quotations!A1:L");
    const quotations = rows
      .slice(1)
      .filter((row) => row[0])
      .map(toQuotation)
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

    if (!model) {
      return NextResponse.json({ success: false, message: "Enter the model being quoted." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ success: false, message: "Enter a valid price greater than zero." }, { status: 400 });
    }
    if (![5, 18].includes(gstRate)) {
      return NextResponse.json({ success: false, message: "Select GST of 5% or 18%." }, { status: 400 });
    }

    let customerName = "Walk-in Customer";
    let mobile = "";
    if (enquiryId) {
      const leads = await readSheet("Leads!A1:Q");
      const lead = leads.slice(1).find((row) => String(row[0] || "").trim() === enquiryId);
      if (!lead) {
        return NextResponse.json({ success: false, message: "Enquiry ID was not found in the Leads tab." }, { status: 404 });
      }
      customerName = lead[2] || "";
      mobile = lead[3] || "";
    }

    // Sequential numbering based on the highest number already stored in column A.
    const existingRows = await readSheet("Quotations!A2:A");
    const highest = existingRows.reduce(
      (max, row) => Math.max(max, Number.parseInt(String(row[0] || ""), 10) || 0),
      0
    );
    const quotationNumber = highest + 1;
    const gstAmount = Number((price * gstRate / 100).toFixed(2));
    const total = Number((price + gstAmount).toFixed(2));
    const quotationDate = indiaDate();

    // Write exactly A:L in the same order as the manually-created Google Sheet headers.
    await appendRow("Quotations", [
      quotationNumber,
      enquiryId,
      customerName,
      mobile,
      model,
      price,
      gstRate,
      gstAmount,
      total,
      amountWords,
      terms,
      quotationDate,
    ]);

    return NextResponse.json(
      {
        success: true,
        quotation: {
          quotationNumber,
          enquiryId,
          customerName,
          mobile,
          model,
          price,
          gstRate,
          gstAmount,
          total,
          amountWords,
          terms,
          quotationDate,
        },
        message: "Quotation saved successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    return fail(error);
  }
}
