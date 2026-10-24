"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Something broke on our side.</h1>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <Link className="btn" href="/">Go home</Link>
      </div>
    </div>
  );
}
