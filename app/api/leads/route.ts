
import { NextRequest, NextResponse } from "next/server";
import { getClassification, normalizeDate } from "@/lib/lead-utils";
import {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  ensureSheet,
  clearRange,
} from "@/lib/google-sheets";
import { leadSchema } from "@/lib/lead-schema";

// function getClassification(enquiryDate: string, followupDate: string) {
//   const dates = [enquiryDate, followupDate]
//     .filter(Boolean)
//     .map((value) => new Date(`${value.slice(0, 10)}T00:00:00`))
//     .filter((date) => !Number.isNaN(date.getTime()));

//   if (!dates.length) {
//     return { days: null, category: "Unknown" };
//   }

//   const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);

//   const days = Math.max(
//     0,
//     Math.floor((today.getTime() - latest.getTime()) / 86400000)
//   );

//   return {
//     days,
//     category: days <= 30 ? "Hot" : days <= 60 ? "Warm" : "Cold",
//   };
// }

const LEAD_HEADERS = [
  "Enquiry_ID",
  "Enquiry_Date",
  "Customer_Name",
  "Mobile_Number",
  "Address",
  "Village",
  "District",
  "State",
  "Product_Category",
  "Product_Subcategory",
  "Quotation_Given",
  "Quotation_Amount",
  "Deal_Status",
  "Last_Followup_Date",
  "Days_Since_Activity",
  "Lead_Category",
];

const FOLLOWUP_HEADERS = [
  "Followup_ID",
  "Enquiry_ID",
  "Followup_Date",
  "Remarks",
  "Next_Followup_Date",
  "Created_At",
];

async function getSheetData() {
  // Migrate the previous layout (Created_At in B and Enquiry_Date in K)
  // to the new layout where the user-entered Enquiry_Date is stored in B.
  const existing = await readSheet("Leads!A1:Q");
  const oldHeaders = existing[0] || [];
  const isOldLayout = oldHeaders[1] === "Created_At" && oldHeaders[10] === "Enquiry_Date";

  if (isOldLayout) {
    const migratedRows = existing.slice(1).map((row) => [
      row[0] || "", row[10] || "", row[2] || "", row[3] || "",
      row[4] || "", row[5] || "", row[6] || "", row[7] || "",
      row[8] || "", row[9] || "", row[11] || "No", row[12] || 0,
      row[13] || "Open", "", "", "",
    ]);
    await updateRow("Leads!A1:P" + Math.max(existing.length, 1), [LEAD_HEADERS, ...migratedRows]);
    await clearRange("Leads!Q:Q");
    // Restore the derived activity columns using the new column positions.
    for (let i = 0; i < migratedRows.length; i++) {
      const sheetRow = i + 2;
      await updateRow(`Leads!N${sheetRow}:P${sheetRow}`, [[
        `=IF(COUNTIF(Followups!B:B,A${sheetRow})=0,"",MAXIFS(Followups!C:C,Followups!B:B,A${sheetRow}))`,
        `=IF(B${sheetRow}="","",TODAY()-MAX(B${sheetRow},IF(N${sheetRow}="",B${sheetRow},N${sheetRow})))`,
        `=IF(O${sheetRow}="","",IF(O${sheetRow}<=30,"Hot",IF(O${sheetRow}<=60,"Warm","Cold")))`,
      ]]);
    }
  }

  await Promise.all([
    ensureSheet("Leads", LEAD_HEADERS),
    ensureSheet("Followups", FOLLOWUP_HEADERS),
  ]);
  const [leads, followups] = await Promise.all([
    readSheet("Leads!A1:P"),
    readSheet("Followups!A1:F"),
  ]);

  return { leads, followups: followups.slice(1) };
}

function failure(error: unknown) {
  console.error("CRM API error:", error);

  const message = error instanceof Error
    ? error.message
    : "An unexpected server error occurred.";

  return NextResponse.json(
    { success: false, message },
    { status: 500 }
  );
}

function findLatestFollowup(id: string, followups: string[][]) {
  const dates = followups
    .filter((row) => row[1] === id && row[2])
    .map((row) => normalizeDate(row[2]))
    .filter(Boolean)
    .sort()
    .reverse();

  return dates[0] || "";
}

// GET: Read all enquiries
export async function GET() {
  try {
    const { leads, followups } = await getSheetData();

    const result = leads.slice(1).map((row, index) => {
      const lastFollowup = findLatestFollowup(row[0], followups);
      const classification = getClassification(row[1] || "", lastFollowup);

      return {
        id: row[0],
        rowNumber: index + 2,
        enquiryDate: normalizeDate(row[1] || ""),
        name: row[2] || "",
        mobile: row[3] || "",
        address: row[4] || "",
        village: row[5] || "",
        district: row[6] || "",
        state: row[7] || "",
        product: row[8] || "",
        subcategory: row[9] || "",
        quotationGiven: row[10] || "No",
        quotationAmount: row[11] === "" || row[11] == null ? 0 : Number(row[11]),
        dealStatus: row[12] || "Open",
        lastFollowup,
        daysSinceActivity: classification.days,
        category: classification.category,
      };
    }).filter((lead) => lead.id);

    return NextResponse.json({ success: true, leads: result });
  } catch (error) {
    return failure(error);
  }
}

// POST: Create enquiry
export async function POST(request: NextRequest) {
  try {
    const parsed = leadSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { leads } = await getSheetData();

    // Generate the next KPD number from the highest number already in the sheet.
    const highestNumber = leads.slice(1).reduce((max, row) => {
      const match = /^KPD(\d+)$/i.exec(String(row[0] || "").trim());
      return match ? Math.max(max, Number(match[1])) : max;
    }, 100);
    const id = `KPD${highestNumber + 1}`;

    const response = await appendRow("Leads", [
      id,
      data.enquiryDate,
      data.name,
      data.mobile,
      data.address,
      data.village,
      data.district,
      data.state,
      data.product,
      data.subcategory,
      data.quotationGiven,
      data.quotationGiven === "Yes" ? data.quotationAmount : 0,
      data.dealStatus,
    ]);

    const range = response.data.updates?.updatedRange || "";
    const match = range.match(/(?:^|!)A(\d+)(?:[:!]|$)/i);

    // Some Sheets API responses omit updatedRange. In that case, locate the
    // newly appended enquiry by its unique ID instead of reporting a false failure.
    let row = match ? Number(match[1]) : 0;
    if (!row) {
      const refreshedLeads = await readSheet("Leads!A1:A");
      const savedIndex = refreshedLeads.findIndex((values, index) => index > 0 && values[0] === id);
      if (savedIndex > 0) row = savedIndex + 1;
    }

    if (!row) {
      throw new Error("Google Sheets did not return the saved enquiry row. Check the Leads tab and spreadsheet permissions before retrying.");
    }
    await updateRow(`Leads!N${row}:P${row}`, [[
      `=IF(COUNTIF(Followups!B:B,A${row})=0,"",MAXIFS(Followups!C:C,Followups!B:B,A${row}))`,
      `=IF(B${row}="","",TODAY()-MAX(B${row},IF(N${row}="",B${row},N${row})))`,
      `=IF(O${row}="","",IF(O${row}<=30,"Hot",IF(O${row}<=60,"Warm","Cold")))`,
    ]]);

    const savedRow = await readSheet(`Leads!A${row}:A${row}`);
    if (savedRow[0]?.[0] !== id) {
      throw new Error("The enquiry could not be verified in the configured Google Sheet. Check GOOGLE_SHEETS_ID and service-account access.");
    }

    return NextResponse.json({
      success: true,
      id,
      message: "Enquiry created successfully.",
    }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

// PUT: Edit enquiry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Enquiry ID is required." },
        { status: 400 }
      );
    }

    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { leads } = await getSheetData();
    const index = leads.findIndex((row, i) => i > 0 && row[0] === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found." },
        { status: 404 }
      );
    }

    const data = parsed.data;

    if (data.enquiryId.trim() !== id) {
      return NextResponse.json(
        { success: false, message: "Enquiry number cannot be changed after creation." },
        { status: 400 }
      );
    }

    const rowNumber = index + 1;

    await updateRow(`Leads!A${rowNumber}:M${rowNumber}`, [[
      id,
      data.enquiryDate,
      data.name,
      data.mobile,
      data.address,
      data.village,
      data.district,
      data.state,
      data.product,
      data.subcategory,
      data.quotationGiven,
      data.quotationGiven === "Yes" ? data.quotationAmount : 0,
      data.dealStatus,
    ]]);

    await updateRow(`Leads!N${rowNumber}:P${rowNumber}`, [[
      `=IF(COUNTIF(Followups!B:B,A${rowNumber})=0,"",MAXIFS(Followups!C:C,Followups!B:B,A${rowNumber}))`,
      `=IF(B${rowNumber}="","",TODAY()-MAX(B${rowNumber},IF(N${rowNumber}="",B${rowNumber},N${rowNumber})))`,
      `=IF(O${rowNumber}="","",IF(O${rowNumber}<=30,"Hot",IF(O${rowNumber}<=60,"Warm","Cold")))`,
    ]]);

    return NextResponse.json({
      success: true,
      message: "Enquiry updated successfully.",
    });
  } catch (error) {
    return failure(error);
  }
}

// DELETE: Delete enquiry and its follow-ups
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Enquiry ID is required." },
        { status: 400 }
      );
    }

    const { leads, followups } = await getSheetData();

    const index = leads.findIndex((row, i) => i > 0 && row[0] === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found." },
        { status: 404 }
      );
    }

    const rowsToDelete = followups
      .map((row, i) => row[1] === id ? i + 2 : -1)
      .filter((row) => row >= 2)
      .sort((a, b) => b - a);

    for (const row of rowsToDelete) {
      await deleteRow("Followups", row);
    }

    await deleteRow("Leads", index + 1);

    return NextResponse.json({
      success: true,
      message: "Enquiry deleted successfully.",
    });
  } catch (error) {
    return failure(error);
  }
}
