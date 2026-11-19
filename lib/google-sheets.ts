
import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  .replace(/\r\n/g, "\n")
  .trim();

if (!spreadsheetId || !email || !privateKey) {
  throw new Error("Google Sheets credentials are missing.");
}

const auth = new google.auth.JWT({
  email,
  key: privateKey,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

export async function readSheet(range: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values ?? [];
}

export async function appendRow(
  sheetName: string,
  values: (string | number | boolean)[]
) {
  return sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values],
    },
  });
}

export async function updateRow(
  range: string,
  values: (string | number | boolean)[][]
) {
  return sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function deleteRow(
  sheetName: string,
  rowNumber: number
) {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Invalid row number.");
  }

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (item) => item.properties?.title === sheetName
  );

  const sheetId = sheet?.properties?.sheetId;

  if (sheetId === undefined) {
    throw new Error(`Sheet ${sheetName} not found.`);
  }

  return sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}


export async function clearRange(range: string) {
  return sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}

export async function ensureSheet(
  sheetName: string,
  headers: string[]
) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets?.some(
    (item) => item.properties?.title === sheetName
  );

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    } catch (error) {
      // Another request may have created the tab at the same time.
      const refreshed = await sheets.spreadsheets.get({ spreadsheetId });
      const createdByAnotherRequest = refreshed.data.sheets?.some(
        (item) => item.properties?.title === sheetName
      );
      if (!createdByAnotherRequest) throw error;
    }
  }

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
  });

  const existingHeaders = current.data.values?.[0] ?? [];
  const headersMatch = headers.every((header, index) => existingHeaders[index] === header)
    && existingHeaders.length === headers.length;

  // Keep the first row aligned with the application's schema without touching data rows.
  if (!headersMatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}
