"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const t = useTranslations("newsletter");
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done" | "invalid" | "error">("idle");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setState("invalid");
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, source }) });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done") return <p role="status" className="font-semibold">{t("thanks")}</p>;
  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row" noValidate>
      <label htmlFor={id} className="sr-only">{t("label")}</label>
      <input id={id} name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="input" aria-invalid={state === "invalid"} aria-describedby={`${id}-msg`} />
      <button className="btn btn-primary" disabled={state === "sending"}>{t("button")}</button>
      <span id={`${id}-msg`} role="status" className="text-sm text-danger sm:hidden">
        {state === "invalid" ? t("invalid") : state === "error" ? t("error") : ""}
      </span>
      {(state === "invalid" || state === "error") && (
        <span className="hidden text-sm text-danger sm:block sm:self-center">{state === "invalid" ? t("invalid") : t("error")}</span>
      )}
    </form>
  );
}
