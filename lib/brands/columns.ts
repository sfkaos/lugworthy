// The public slice of the "Brand master list (source of truth)" sheet.
//
// Only columns A-L are ever requested from Google. Columns R-AN hold private outreach data
// (emails, founders, status, replies, notes) and must never be read by the app or the API.

export const DEFAULT_SHEET_ID = "1SneG4cik7d6Wu3Mfd6IWJ8-tv5Zds40bV4Nq2-aemf8";

/** A1 range for the public columns. Row 1 is the header, checked against PUBLIC_COLUMNS. */
export const PUBLIC_RANGE = "Brands!A1:L";
export const PUBLIC_LAST_COLUMN = "L";

export const PUBLIC_COLUMNS = [
  "Brand ID",
  "Brand",
  "Website",
  "Other website(s)",
  "Country",
  "City",
  "Instagram",
  "Description",
  "Site check",
  "Ownership",
  "Ownership note",
  "Lugworthy fit",
] as const;

export type MasterRow = string[];
