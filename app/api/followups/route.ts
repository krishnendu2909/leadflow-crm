
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { readSheet, appendRow } from "@/lib/google-sheets";

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function failure(error: unknown) {
  console.error("Follow-ups API error:", error);

  return NextResponse.json(
    { success: false, message: "Unable to process follow-up request." },
    { status: 500 }
  );
}

// GET: Retrieve all follow-ups or history for one enquiry
export async function GET(request: NextRequest) {
  try {
    const enquiryId = request.nextUrl.searchParams.get("enquiryId");

    const rows = await readSheet("Followups!A1:F");

    const followups = rows.slice(1)
      .map((row, index) => ({
        id: row[0] || "",
        enquiryId: row[1] || "",
        followupDate: row[2] || "",
        remarks: row[3] || "",
        nextFollowupDate: row[4] || "",
        createdAt: row[5] || "",
        rowNumber: index + 2,
      }))
      .filter((item) => item.id && item.enquiryId)
      .filter((item) => !enquiryId || item.enquiryId === enquiryId)
      .sort((a, b) =>
        b.followupDate.localeCompare(a.followupDate)
      );

    return NextResponse.json({
      success: true,
      followups,
    });
  } catch (error) {
    return failure(error);
  }
}

// POST: Create a follow-up
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const enquiryId =
      typeof body.enquiryId === "string" ? body.enquiryId.trim() : "";

    const followupDate =
      typeof body.followupDate === "string" ? body.followupDate.trim() : "";

    const remarks =
      typeof body.remarks === "string" ? body.remarks.trim() : "";

    const nextFollowupDate =
      typeof body.nextFollowupDate === "string"
        ? body.nextFollowupDate.trim()
        : "";

    if (!enquiryId) {
      return NextResponse.json(
        { success: false, message: "Enquiry ID is required." },
        { status: 400 }
      );
    }

    if (!isValidDate(followupDate)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid follow-up date." },
        { status: 400 }
      );
    }

    if (nextFollowupDate && !isValidDate(nextFollowupDate)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid next follow-up date." },
        { status: 400 }
      );
    }

    if (nextFollowupDate && nextFollowupDate < followupDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Next follow-up date cannot be earlier than the current follow-up date.",
        },
        { status: 400 }
      );
    }

    if (!remarks) {
      return NextResponse.json(
        { success: false, message: "Follow-up remarks are required." },
        { status: 400 }
      );
    }

    // Verify that the enquiry exists before creating its follow-up.
    const leads = await readSheet("Leads!A2:A");
    const enquiryExists = leads.some((row) => row[0] === enquiryId);

    if (!enquiryExists) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found." },
        { status: 404 }
      );
    }

    const id = `FUP-${randomUUID().toUpperCase()}`;
    const createdAt = new Date().toISOString();

    await appendRow("Followups", [
      id,
      enquiryId,
      followupDate,
      remarks,
      nextFollowupDate,
      createdAt,
    ]);

    return NextResponse.json(
      {
        success: true,
        id,
        message: "Follow-up saved successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    return failure(error);
  }
}
