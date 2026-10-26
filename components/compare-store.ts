"use client";

// Compare tray state: up to 4 model ids, persisted in localStorage (FR-10).
import { useSyncExternalStore } from "react";

const KEY = "lw.compare";
const LABELS = "lw.compare.labels";
export interface CompareLabel { name: string; brand: string }
export const MAX_COMPARE = 4;
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const EMPTY: string[] = [];

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(ids: string[]) {
  cache = ids.slice(0, MAX_COMPARE);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Names for the tray, saved when a watch is added (the catalog is too big to ship to every page). */
export function compareLabel(id: string): CompareLabel | null {
  try {
    const all = JSON.parse(window.localStorage.getItem(LABELS) ?? "{}") as Record<string, CompareLabel>;
    return all[id] ?? null;
  } catch {
    return null;
  }
}

function saveLabel(id: string, label: CompareLabel) {
  try {
    const all = JSON.parse(window.localStorage.getItem(LABELS) ?? "{}") as Record<string, CompareLabel>;
    all[id] = label;
    // Keep only labels for watches still in the tray, plus this one.
    const keep = new Set([...read(), id]);
    for (const k of Object.keys(all)) if (!keep.has(k)) delete all[k];
    window.localStorage.setItem(LABELS, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    full: ids.length >= MAX_COMPARE,
    toggle: (id: string, label?: CompareLabel) => {
      const cur = read();
      if (label && !cur.includes(id)) saveLabel(id, label);
      if (cur.includes(id)) write(cur.filter((x) => x !== id));
      else if (cur.length < MAX_COMPARE) write([...cur, id]);
      else return false;
      return true;
    },
    remove: (id: string) => write(read().filter((x) => x !== id)),
    clear: () => write([]),
    set: (next: string[]) => write(next),
  };
}
