// Where brand rows come from at runtime.
//
// With Google credentials set, rows are read live from the master sheet and cached for
// BRANDS_REVALIDATE_SECONDS (default 600) under the "brands" cache tag, so sheet edits reach the
// site and the API without a rebuild. /api/v1/brands/refresh drops the cache on demand.
// Without credentials, or if Google can't be reached, the checked-in snapshot is used.

import { unstable_cache } from "next/cache";
import snapshot from "@/data/raw/master.json";
import type { MasterRow } from "./columns";
import { fetchPublicRows, serviceAccountFromEnv, sheetIdFromEnv } from "./sheet";

export const BRANDS_TAG = "brands";
export const REVALIDATE_SECONDS = Number(process.env.BRANDS_REVALIDATE_SECONDS) || 600;

/** Below this many rows a live read is treated as a mistake (wrong tab, cleared sheet) and ignored. */
const MIN_ROWS = 100;

export interface MasterRows {
  rows: MasterRow[];
  source: "sheet" | "snapshot";
  /** When the rows were read: live fetch time, or the snapshot's retrieval date. */
  syncedAt: string;
  error?: string;
}

const snap = snapshot as unknown as { rows: MasterRow[]; retrieved: string };

export function snapshotRows(error?: string): MasterRows {
  return { rows: snap.rows, source: "snapshot", syncedAt: new Date(snap.retrieved).toISOString(), ...(error ? { error } : {}) };
}

const readSheet = unstable_cache(
  async (sheetId: string): Promise<MasterRows> => {
    const sa = serviceAccountFromEnv();
    if (!sa) throw new Error("no credentials");
    const rows = await fetchPublicRows(sa, sheetId);
    const valid = rows.filter((r) => /^BRD-\d+$/i.test((r[0] ?? "").trim()) && (r[1] ?? "").trim()).length;
    if (valid < MIN_ROWS) throw new Error(`Sheet returned only ${valid} brand rows; keeping the snapshot`);
    return { rows, source: "sheet", syncedAt: new Date().toISOString() };
  },
  ["master-rows-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [BRANDS_TAG] },
);

export async function loadMasterRows(): Promise<MasterRows> {
  let configured = false;
  try {
    configured = serviceAccountFromEnv() !== null;
  } catch (e) {
    console.error("[brands] bad Google credentials:", (e as Error).message);
    return snapshotRows("bad credentials");
  }
  if (!configured) return snapshotRows();
  try {
    return await readSheet(sheetIdFromEnv());
  } catch (e) {
    console.error("[brands] live sheet read failed, using snapshot:", (e as Error).message);
    return snapshotRows((e as Error).message);
  }
}
