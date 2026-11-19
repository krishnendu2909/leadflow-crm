
import { NextRequest, NextResponse } from "next/server";
import { getClassification, normalizeDate } from "@/lib/lead-utils";
import {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
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

async function getSheetData() {
  const [leads, followups] = await Promise.all([
    readSheet("Leads!A1:Q"),
    readSheet("Followups!A1:F"),
  ]);

  return { leads, followups: followups.slice(1) };
}

function failure(error: unknown) {
  console.error("CRM API error:", error);

  return NextResponse.json(
    { success: false, message: "Unable to process request." },
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
      const classification = getClassification(row[10] || "", lastFollowup);

      return {
        id: row[0],
        rowNumber: index + 2,
        createdAt: row[1] || "",
        name: row[2] || "",
        mobile: row[3] || "",
        address: row[4] || "",
        village: row[5] || "",
        district: row[6] || "",
        state: row[7] || "",
        product: row[8] || "",
        subcategory: row[9] || "",
        enquiryDate: row[10] || "",
        quotationGiven: row[11] || "No",
        quotationAmount:
  row[12] === "" || row[12] == null
    ? 0
    : Number(row[12]),
        dealStatus: row[13] || "Open",
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

    const createdAt = new Date().toISOString();

    const response = await appendRow("Leads", [
      id,
      createdAt,
      data.name,
      data.mobile,
      data.address,
      data.village,
      data.district,
      data.state,
      data.product,
      data.subcategory,
      data.enquiryDate,
      data.quotationGiven,
      data.quotationGiven === "Yes" ? data.quotationAmount : 0,
      data.dealStatus,
    ]);

    const range = response.data.updates?.updatedRange || "";
    const match = range.match(/!A(\d+)/);

    if (match) {
      const row = Number(match[1]);
      await updateRow(`Leads!O${row}:Q${row}`, [[
        `=IF(COUNTIF(Followups!B:B,A${row})=0,"",MAXIFS(Followups!C:C,Followups!B:B,A${row}))`,
        `=IF(K${row}="","",TODAY()-MAX(K${row},IF(O${row}="",K${row},O${row})))`,
        `=IF(P${row}="","",IF(P${row}<=30,"Hot",IF(P${row}<=60,"Warm","Cold")))`,
      ]]);
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

    await updateRow(`Leads!A${rowNumber}:N${rowNumber}`, [[
      id,
      leads[index][1],
      data.name,
      data.mobile,
      data.address,
      data.village,
      data.district,
      data.state,
      data.product,
      data.subcategory,
      data.enquiryDate,
      data.quotationGiven,
      data.quotationGiven === "Yes" ? data.quotationAmount : 0,
      data.dealStatus,
    ]]);

    await updateRow(`Leads!O${rowNumber}:Q${rowNumber}`, [[
      `=IF(COUNTIF(Followups!B:B,A${rowNumber})=0,"",MAXIFS(Followups!C:C,Followups!B:B,A${rowNumber}))`,
      `=IF(K${rowNumber}="","",TODAY()-MAX(K${rowNumber},IF(O${rowNumber}="",K${rowNumber},O${rowNumber})))`,
      `=IF(P${rowNumber}="","",IF(P${rowNumber}<=30,"Hot",IF(P${rowNumber}<=60,"Warm","Cold")))`,
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
