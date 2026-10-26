// Brand rows from the master sheet. Only the sync job (lib/sync/sheet.ts) reads the sheet;
// the site and API read the database. The snapshot is the fallback for local dev and tests.

import snapshot from "@/data/raw/master.json";
import type { MasterRow } from "./columns";
import { fetchPublicRows, serviceAccountFromEnv, sheetIdFromEnv } from "./sheet";

/** Cache tag for everything read from the database. The sync job revalidates it. */
export const BRANDS_TAG = "brands";

/** Below this many rows a sheet read is treated as a mistake (wrong tab, cleared sheet) and refused. */
export const MIN_ROWS = 100;

export interface MasterRows {
  rows: MasterRow[];
  source: "sheet" | "snapshot" | "database";
  /** When the rows were read: live fetch time, or the snapshot's retrieval date. */
  syncedAt: string;
}

const snap = snapshot as unknown as { rows: MasterRow[]; retrieved: string };

export function snapshotRows(): MasterRows {
  return { rows: snap.rows, source: "snapshot", syncedAt: new Date(snap.retrieved).toISOString() };
}

export function countValidRows(rows: MasterRow[]): number {
  return rows.filter((r) => /^BRD-\d+$/i.test((r[0] ?? "").trim()) && (r[1] ?? "").trim()).length;
}

/** Reads the sheet live. Throws when credentials are missing or the result looks wrong. */
export async function fetchSheetRows(fetchImpl?: typeof fetch): Promise<MasterRows> {
  const sa = serviceAccountFromEnv();
  if (!sa) throw new Error("Google credentials are not set (GOOGLE_SERVICE_ACCOUNT_JSON)");
  const rows = await fetchPublicRows(sa, sheetIdFromEnv(), fetchImpl);
  const valid = countValidRows(rows);
  if (valid < MIN_ROWS) throw new Error(`Sheet returned only ${valid} brand rows; refusing to sync`);
  return { rows, source: "sheet", syncedAt: new Date().toISOString() };
}
