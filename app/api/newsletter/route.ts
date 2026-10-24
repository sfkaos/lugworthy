import { NextResponse, type NextRequest } from "next/server";
import { limited } from "@/lib/rate-limit";

// Newsletter signup (FR-23). Email only. Sends to Resend when RESEND_API_KEY and
// RESEND_AUDIENCE_ID are set; otherwise accepts and logs a hashed address.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(`nl:${ip}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const key = process.env.RESEND_API_KEY;
  const audience = process.env.RESEND_AUDIENCE_ID;
  if (key && audience) {
    const r = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  } else {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
    console.log(JSON.stringify({ event: "newsletter_signup", source: body?.source ?? "unknown", email_sha256: Buffer.from(digest).toString("hex").slice(0, 16) }));
  }
  return NextResponse.json({ ok: true });
}
