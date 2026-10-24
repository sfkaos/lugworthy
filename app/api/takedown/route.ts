import { NextResponse, type NextRequest } from "next/server";
import { limited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(`td:${ip}`, 3)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = await req.json().catch(() => null);
  if (!b?.url || !b?.email || !b?.reason) return NextResponse.json({ ok: false }, { status: 400 });
  // Admin alert goes here (Resend) once configured; the 48h SLA clock starts now.
  console.log(JSON.stringify({ event: "takedown_requested", url: String(b.url).slice(0, 500), ts: new Date().toISOString() }));
  return NextResponse.json({ ok: true });
}
