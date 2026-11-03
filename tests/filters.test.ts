import { describe, expect, it } from "vitest";
import { snapshotCatalog } from "@/lib/data";

const catalog = snapshotCatalog();
const publishedBrands = () => catalog.publishedBrands();
const publishedModels = () => catalog.publishedModels();
import { PRICE_STOPS, browse, formatRangeValue, linearStops, parseFilters, rangeText, textScore, toSearchParams } from "@/lib/filters";

const models = publishedModels();

describe("browse (AC-1)", () => {
  it("returns only matching models for 36–40 mm + automatic + 200 m+", () => {
    const f = parseFilters({ dia: "36-40", mov: "automatic", wr: "200" });
    const r = browse(models, f);
    expect(r.total).toBeGreaterThan(0);
    for (const m of r.items) {
      expect(m.specs.caseDiameterMm).toBeGreaterThanOrEqual(36);
      expect(m.specs.caseDiameterMm).toBeLessThanOrEqual(40);
      expect(m.specs.movementType).toBe("automatic");
      expect(m.specs.waterResistanceM).toBeGreaterThanOrEqual(200);
    }
  });
  it("round-trips URL params", () => {
    const f = parseFilters({ price: "200-800", dia: "36-40", mov: "automatic,hand_wound", style: "diver", sort: "price_asc" });
    expect(parseFilters(Object.fromEntries(toSearchParams(f)))).toEqual(f);
  });
  it("keeps a facet's own options countable while it is selected", () => {
    const r = browse(models, parseFilters({ mov: "automatic" }));
    expect(r.counts.mov.quartz).toBeGreaterThan(0);
  });
  it("sorts by price", () => {
    const r = browse(models, parseFilters({ sort: "price_asc" }));
    const prices = r.items.map((m) => Math.min(...m.variants.map((v) => v.priceUsd)));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});

describe("text search (FR-8)", () => {
  it("handles synonyms and typos", () => {
    const helmsman = models.find((m) => m.name.startsWith("Helmsman"))!;
    expect(textScore(helmsman, "zelos dive")).toBeGreaterThan(0);
    expect(textScore(helmsman, "helmsmn")).toBeGreaterThan(0);
    expect(textScore(helmsman, "chronograph")).toBe(0);
  });
});

describe("data hygiene", () => {
  it("never exposes outreach fields", () => {
    const raw = JSON.stringify(publishedBrands());
    expect(raw).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i); // no email addresses
    expect(raw).not.toMatch(/EMAIL_SENT|RESPONDED|Leaning yes/);
  });
  it("shows no brand images while no license exists (AC-3)", () => {
    expect(publishedBrands().every((b) => b.imageLicenseStatus !== "granted")).toBe(true);
  });
});

describe("range slider helpers", () => {
  it("builds half-millimetre stops rounded outward", () => {
    expect(linearStops(25.6, 27.2, 0.5)).toEqual([25.5, 26, 26.5, 27, 27.5]);
    expect(linearStops(null, 40, 0.5)).toEqual([]);
  });
  it("price stops start at zero and climb", () => {
    expect(PRICE_STOPS[0]).toBe(0);
    expect(PRICE_STOPS.every((v, i) => i === 0 || v > PRICE_STOPS[i - 1])).toBe(true);
  });
  it("describes open and closed ranges", () => {
    const usd = (n: number) => formatRangeValue(n, "$");
    expect(rangeText({ min: 200, max: 1000 }, usd)).toBe("$200 – $1,000");
    expect(rangeText({ min: 5000 }, usd)).toBe("$5,000+");
    expect(rangeText({ max: 40.5 }, (n) => formatRangeValue(n, "mm"))).toBe("Up to 40.5 mm");
    expect(rangeText({}, usd)).toBeUndefined();
  });
});
