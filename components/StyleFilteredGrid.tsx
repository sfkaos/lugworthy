"use client";

import { useEffect, useState } from "react";

export interface StyleItem { key: string; styles: string[]; node: React.ReactNode }

/**
 * A brand's watches with style chips (?style=). Filtering happens in the browser, so the brand
 * page itself stays cached and a chip click is instant.
 */
export function StyleFilteredGrid({
  basePath, items, styles, allLabel, empty,
}: {
  basePath: string; items: StyleItem[]; styles: { value: string; label: string }[]; allLabel: string; empty: React.ReactNode;
}) {
  // Starts unfiltered (that's what the cached HTML shows), then applies ?style= from the address bar.
  const [style, setStyle] = useState("");
  useEffect(() => {
    const read = () => setStyle(new URLSearchParams(window.location.search).get("style") ?? "");
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const active = styles.some((s) => s.value === style) ? style : "";
  const shown = active ? items.filter((i) => i.styles.includes(active)) : items;

  const go = (e: React.MouseEvent<HTMLAnchorElement>, value: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setStyle(value);
    // Keep the URL shareable without asking the server for anything.
    window.history.pushState(window.history.state, "", value ? `${basePath}?style=${value}` : basePath);
  };

  return (
    <>
      {styles.length > 1 && (
        <nav aria-label="Collections" className="mb-4 flex flex-wrap gap-2">
          {[{ value: "", label: allLabel }, ...styles].map((s) => (
            <a
              key={s.value || "all"}
              href={s.value ? `${basePath}?style=${s.value}` : basePath}
              onClick={(e) => go(e, s.value)}
              className="chip"
              aria-current={active === s.value ? "page" : undefined}
              data-no-progress
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}
      {shown.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => (
            <li key={i.key} className="flex">
              <div className="flex w-full">{i.node}</div>
            </li>
          ))}
        </ul>
      ) : (
        empty
      )}
    </>
  );
}
