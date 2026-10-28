"use client";

import { useState } from "react";

interface Img { url: string; width: number | null; height: number | null }

/** Main photo with thumbnails; click a thumbnail to show it. */
export function ModelGallery({ images, name, credit }: { images: Img[]; name: string; credit: string | null }) {
  const [i, setI] = useState(0);
  const main = images[i] ?? images[0];
  return (
    <figure className="card flex flex-col overflow-hidden">
      <div className="flex aspect-square w-full items-center justify-center bg-photo p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={main.url} alt={`${name}, photo ${i + 1} of ${images.length}`} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto border-t border-line px-3 pt-3" aria-label="Photos">
          {images.slice(0, 12).map((im, k) => (
            <li key={im.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={`Show photo ${k + 1}`}
                aria-current={k === i ? "true" : undefined}
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border bg-photo transition-colors duration-150"
                style={{ borderColor: k === i ? "var(--brass)" : "var(--border)", borderWidth: k === i ? 2 : 1 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {credit && <figcaption className="p-3 text-xs text-muted">{credit}</figcaption>}
    </figure>
  );
}
