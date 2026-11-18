
export function normalizeDate(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const input = String(value).trim();

  // ISO format: YYYY-MM-DD
  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    );

    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return "";
  }

  // Indian date format: DD/MM/YYYY or DD-MM-YYYY
  const indianMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (indianMatch) {
    const [, day, month, year] = indianMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    );

    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return "";
}

export function getIndiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getClassification(
  enquiryDate: string,
  followupDate: string
) {
  const dates = [
    normalizeDate(enquiryDate),
    normalizeDate(followupDate),
  ].filter(Boolean);

  if (dates.length === 0) {
    return { days: null, category: "Unknown" };
  }

  const latestDate = dates.sort().reverse()[0];
  const today = getIndiaToday();

  const latest = new Date(`${latestDate}T00:00:00.000Z`);
  const current = new Date(`${today}T00:00:00.000Z`);

  const days = Math.max(
    0,
    Math.floor((current.getTime() - latest.getTime()) / 86400000)
  );

  return {
    days,
    category: days <= 30 ? "Hot" : days <= 60 ? "Warm" : "Cold",
  };
}
