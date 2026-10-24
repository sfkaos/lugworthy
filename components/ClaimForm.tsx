"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function ClaimForm({ brands, initial }: { brands: { slug: string; name: string }[]; initial?: string }) {
  const t = useTranslations("forBrands");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const res = await fetch("/api/claim-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: fd.get("brand"), email }) }).catch(() => null);
    if (res?.ok) setSent(email);
    else setError(true);
  }
  if (sent) return <p role="status" className="font-semibold">{t("sent", { email: sent })}</p>;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">{t("brandField")}</span>
        <input list="brand-list" name="brand" required defaultValue={initial} className="input" autoComplete="off" />
        <datalist id="brand-list">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</datalist>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">{t("emailField")}</span>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">Check the brand and email, then try again.</p>}
      <button className="btn btn-primary self-start">{t("submit")}</button>
    </form>
  );
}
