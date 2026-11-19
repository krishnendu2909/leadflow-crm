import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { normalizeDate } from "@/lib/lead-utils";
import {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  ensureSheet,
} from "@/lib/google-sheets";

const FOLLOWUP_HEADERS = [
  "Followup_ID",
  "Enquiry_ID",
  "Followup_Date",
  "Remarks",
  "Next_Followup_Date",
  "Created_At",
];

async function getFollowupRows() {
  await ensureSheet("Followups", FOLLOWUP_HEADERS);
  return readSheet("Followups!A1:F");
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function failure(error: unknown) {
  console.error("Follow-ups API error:", error);
  return NextResponse.json(
    { success: false, message: "Unable to process follow-up request." },
    { status: 500 }
  );
}

function parseFollowupBody(body: Record<string, unknown>) {
  const enquiryId = typeof body.enquiryId === "string" ? body.enquiryId.trim() : "";
  const followupDate = typeof body.followupDate === "string" ? body.followupDate.trim() : "";
  const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";
  const nextFollowupDate = typeof body.nextFollowupDate === "string" ? body.nextFollowupDate.trim() : "";

  if (!enquiryId) return { error: "Enquiry ID is required." };
  if (!isValidDate(followupDate)) return { error: "Enter a valid follow-up date." };
  if (nextFollowupDate && !isValidDate(nextFollowupDate)) return { error: "Enter a valid next follow-up date." };
  if (nextFollowupDate && nextFollowupDate < followupDate) {
    return { error: "Next follow-up date cannot be earlier than the current follow-up date." };
  }
  if (!remarks) return { error: "Follow-up remarks are required." };

  return { data: { enquiryId, followupDate, remarks, nextFollowupDate } };
}

// GET: Retrieve all follow-ups or the history for one enquiry.
export async function GET(request: NextRequest) {
  try {
    const enquiryId = request.nextUrl.searchParams.get("enquiryId");
    const rows = await getFollowupRows();

    const followups = rows.slice(1)
      .map((row, index) => ({
        id: row[0] || "",
        enquiryId: row[1] || "",
        followupDate: normalizeDate(row[2] || ""),
        remarks: row[3] || "",
        nextFollowupDate: normalizeDate(row[4] || ""),
        createdAt: row[5] || "",
        rowNumber: index + 2,
      }))
      .filter((item) => item.id && item.enquiryId)
      .filter((item) => !enquiryId || item.enquiryId === enquiryId)
      .sort((a, b) => b.followupDate.localeCompare(a.followupDate));

    return NextResponse.json({ success: true, followups });
  } catch (error) {
    return failure(error);
  }
}

// POST: Create a follow-up.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseFollowupBody(body);
    if (parsed.error || !parsed.data) {
      return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
    }

    const leads = await readSheet("Leads!A2:A");
    if (!leads.some((row) => row[0] === parsed.data!.enquiryId)) {
      return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });
    }

    const id = `FUP-${randomUUID().toUpperCase()}`;
    await appendRow("Followups", [
      id,
      parsed.data.enquiryId,
      parsed.data.followupDate,
      parsed.data.remarks,
      parsed.data.nextFollowupDate,
      new Date().toISOString(),
    ]);

    return NextResponse.json({ success: true, id, message: "Follow-up created successfully." }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

// PUT: Modify an existing follow-up.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ success: false, message: "Follow-up ID is required." }, { status: 400 });
    }

    const parsed = parseFollowupBody(body);
    if (parsed.error || !parsed.data) {
      return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
    }

    const rows = await getFollowupRows();
    const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && row[0] === id);
    if (index < 0) {
      return NextResponse.json({ success: false, message: "Follow-up not found." }, { status: 404 });
    }

    const leads = await readSheet("Leads!A2:A");
    if (!leads.some((row) => row[0] === parsed.data!.enquiryId)) {
      return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });
    }

    const rowNumber = index + 1;
    await updateRow(`Followups!A${rowNumber}:F${rowNumber}`, [[
      id,
      parsed.data.enquiryId,
      parsed.data.followupDate,
      parsed.data.remarks,
      parsed.data.nextFollowupDate,
      rows[index][5] || new Date().toISOString(),
    ]]);

    return NextResponse.json({ success: true, message: "Follow-up updated successfully." });
  } catch (error) {
    return failure(error);
  }
}

// DELETE: Remove one follow-up record.
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "Follow-up ID is required." }, { status: 400 });
    }

    const rows = await getFollowupRows();
    const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && row[0] === id);
    if (index < 0) {
      return NextResponse.json({ success: false, message: "Follow-up not found." }, { status: 404 });
    }

    await deleteRow("Followups", index + 1);
    return NextResponse.json({ success: true, message: "Follow-up deleted successfully." });
  } catch (error) {
    return failure(error);
  }
}
