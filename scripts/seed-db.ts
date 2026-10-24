// Loads data/seed/*.json into Postgres. Requires DATABASE_URL and a migrated schema
// (npm run db:generate, then apply db/migrations). Idempotent on brand/model slugs.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import brandsJson from "../data/seed/brands.json";
import modelsJson from "../data/seed/models.json";
import { CALIBERS } from "../lib/ingest/normalize";
import type { Brand, Model } from "../lib/types";
import * as s from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s });

const lumeEnum = (raw: string | null) => {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (/bgw9/.test(r)) return "super_luminova_bgw9" as const;
  if (/c3/.test(r)) return "c3" as const;
  if (/x1/.test(r)) return "x1" as const;
  if (/radium/.test(r)) return "old_radium" as const;
  if (/tritium/.test(r)) return "tritium_tubes" as const;
  return "other" as const;
};

(async () => {
  const brandIds = new Map<string, string>();
  for (const b of brandsJson as unknown as Brand[]) {
    const [row] = await db.insert(s.brands).values({
      slug: b.slug, name: b.name, websiteUrl: b.websiteUrl, platform: b.platform, country: b.country, city: b.city,
      story: b.story ? { en: b.story } : null, priceMin: b.priceMin, priceMax: b.priceMax, currency: b.currency,
      socials: b.instagram ? { instagram: b.instagram } : null, styleTags: b.styleTags, isMicrobrandClass: b.brandClass,
      enPuntoExhibitor: b.enPuntoExhibitor, status: b.status, claimStatus: b.claimStatus, imageLicenseStatus: b.imageLicenseStatus,
      lastSyncedAt: b.lastSyncedAt ? new Date(b.lastSyncedAt) : null,
    }).onConflictDoUpdate({ target: s.brands.slug, set: { name: b.name, status: b.status } }).returning({ id: s.brands.id });
    brandIds.set(b.slug, row.id);
  }
  const caliberIds = new Map<string, string>();
  for (const c of Object.values(CALIBERS)) {
    const [row] = await db.insert(s.calibers).values({ name: c.name, maker: c.maker, powerReserveH: c.powerReserveH, frequencyBph: c.frequencyBph, hacking: c.hacking, handWinding: c.handWinding, functions: c.functions })
      .onConflictDoUpdate({ target: s.calibers.name, set: { maker: c.maker } }).returning({ id: s.calibers.id });
    caliberIds.set(c.name, row.id);
  }
  for (const m of modelsJson as unknown as Model[]) {
    const brandId = brandIds.get(m.brandSlug)!;
    const [row] = await db.insert(s.models).values({
      brandId, slug: m.slug, name: m.name, reference: m.reference, status: m.status, limitedEdition: m.limitedEdition,
      style: m.styles, sourceUrl: m.sourceUrl, published: m.published,
    }).onConflictDoUpdate({ target: [s.models.brandId, s.models.slug], set: { name: m.name } }).returning({ id: s.models.id });
    const sp = m.specs;
    const n = (v: number | null) => (v == null ? null : String(v));
    await db.insert(s.specs).values({
      modelId: row.id, caseDiameterMm: n(sp.caseDiameterMm), lugToLugMm: n(sp.lugToLugMm), thicknessMm: n(sp.thicknessMm),
      thicknessInclCrystalMm: n(sp.thicknessInclCrystalMm), lugWidthMm: n(sp.lugWidthMm), caseMaterial: sp.caseMaterial,
      crystalMaterial: sp.crystalMaterial, crystalShape: sp.crystalShape, waterResistanceM: sp.waterResistanceM,
      movementType: sp.movementType, caliberId: sp.caliber ? caliberIds.get(sp.caliber) ?? null : null,
      complications: sp.complications, dialColor: sp.dialColor, lumeType: lumeEnum(sp.lumeType), strapType: sp.strapType,
      specSources: m.specSources as Record<string, "imported">,
    }).onConflictDoNothing();
    for (const [i, v] of m.variants.entries()) {
      await db.insert(s.variants).values({ modelId: row.id, sku: v.sku, title: v.title, price: v.price, currency: v.currency, compareAtPrice: v.compareAtPrice, available: v.available, url: v.url, sort: i }).onConflictDoNothing();
    }
  }
  console.log(`seeded ${brandIds.size} brands, ${modelsJson.length} models`);
  await client.end();
})();
