"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// One progress bar for every in-site navigation, so a click always shows something right away.
// It starts on a link click (or when code calls startNavProgress) and stops when the URL changes.

let show: ((on: boolean) => void) | null = null;

/** Call before a router.push/replace so the bar shows while the next page loads. */
export function startNavProgress() {
  show?.(true);
}

function isInSiteNavigation(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.hasAttribute("download") || a.dataset.noProgress != null) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.getAttribute("aria-disabled") === "true") return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (or just a #hash): nothing to load.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [on, setOn] = useState(false);

  useEffect(() => {
    show = setOn;
    const onClick = (e: MouseEvent) => {
      if (isInSiteNavigation(e)) setOn(true);
    };
    const off = () => setOn(false);
    // Capture phase: Next's <Link> calls preventDefault, so a bubbling listener can't tell links apart.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", off);
    window.addEventListener("pageshow", off);
    return () => {
      show = null;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", off);
      window.removeEventListener("pageshow", off);
    };
  }, []);

  // The new URL is in place: done.
  useEffect(() => setOn(false), [pathname, search]);

  useEffect(() => {
    const root = document.documentElement;
    if (!on) {
      delete root.dataset.navigating;
      return;
    }
    root.dataset.navigating = "";
    // Never leave the page looking busy if a navigation fails or is cancelled.
    const t = setTimeout(() => setOn(false), 20000);
    return () => clearTimeout(t);
  }, [on]);

  return <div className="nav-progress" data-active={on || undefined} aria-hidden />;
}
