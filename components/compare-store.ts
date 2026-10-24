"use client";

// Compare tray state: up to 4 model ids, persisted in localStorage (FR-10).
import { useSyncExternalStore } from "react";

const KEY = "lw.compare";
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

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    full: ids.length >= MAX_COMPARE,
    toggle: (id: string) => {
      const cur = read();
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
