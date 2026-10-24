"use client";

import { useState } from "react";

export function TakedownForm() {
  const [done, setDone] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/takedown", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fd) }).catch(() => null);
    if (r?.ok) setDone(true);
  }
  if (done) return <p role="status" className="font-semibold">Received. We respond within 48 hours.</p>;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-base">
      <label className="flex flex-col gap-1"><span className="text-sm font-semibold">Page URL</span><input name="url" required className="input" /></label>
      <label className="flex flex-col gap-1"><span className="text-sm font-semibold">Your email</span><input name="email" type="email" required className="input" /></label>
      <label className="flex flex-col gap-1"><span className="text-sm font-semibold">What should come down, and why</span><textarea name="reason" required rows={5} className="input py-2" /></label>
      <button className="btn btn-primary self-start">Send request</button>
    </form>
  );
}
