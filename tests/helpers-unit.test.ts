import { describe, expect, it } from "vitest";
import { countryName, toIso2 } from "@/lib/countries";
import { metres, mm, money, shortDate, wristFit } from "@/lib/format";
import { isAvailable, minPriceUsd, modelId } from "@/lib/model-utils";
import { brandThemeStyle, contrast } from "@/lib/theme";
import type { Brand, Model } from "@/lib/types";

describe("format", () => {
  it("shows whole dollars without cents and keeps cents when there are some", () => {
    expect(money(45000)).toBe("$450");
    expect(money(45050)).toBe("$450.50");
    expect(money(123456700)).toBe("$1,234,567");
  });
  it("uses a non-breaking space before units and handles missing values", () => {
    expect(mm(40)).toBe("40 mm");
    expect(mm(38.5)).toBe("38.5 mm");
    expect(mm(null)).toBeNull();
    expect(metres(200)).toBe("200 m");
    expect(metres(undefined)).toBeNull();
  });
  it("gives a wrist-fit hint from lug-to-lug", () => {
    expect(wristFit(null)).toBeNull();
    expect(Number(wristFit(48)!.min)).toBeCloseTo(6.5, 1);
  });
  it("formats dates in UTC", () => {
    expect(shortDate("2026-10-26T23:30:00Z")).toBe("Oct 26, 2026");
  });
});

describe("countries", () => {
  it("maps sheet country text to ISO codes", () => {
    expect(toIso2("USA (Dallas, TX)")).toBe("US");
    expect(toIso2("Germany")).toBe("DE");
    expect(toIso2("Unknown")).toBeNull();
    expect(toIso2("")).toBeNull();
    expect(toIso2(null)).toBeNull();
  });
  it("names countries and falls back for unknown codes", () => {
    expect(countryName("DE")).toBe("Germany");
    expect(countryName(null)).toBe("Unknown");
    expect(countryName("ZZ")).toBe("ZZ");
  });
});

describe("model helpers", () => {
  const model = {
    brandSlug: "acme",
    slug: "diver-40",
    variants: [
      { priceUsd: 52000, available: false },
      { priceUsd: 48000, available: true },
    ],
  } as unknown as Model;
  it("builds compare IDs and finds the lowest price", () => {
    expect(modelId(model)).toBe("acme~diver-40");
    expect(minPriceUsd(model)).toBe(48000);
  });
  it("is available when any variant is", () => {
    expect(isAvailable(model)).toBe(true);
    expect(isAvailable({ ...model, variants: model.variants.map((v) => ({ ...v, available: false })) } as Model)).toBe(false);
  });
});

describe("brand theme", () => {
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  it("only themes claimed brands with a valid colour", () => {
    const b = { claimStatus: "unclaimed", colorPrimary: "#1f4f46" } as unknown as Brand;
    expect(brandThemeStyle(b)).toBeUndefined();
    expect(brandThemeStyle({ ...b, claimStatus: "claimed", colorPrimary: "red" } as Brand)).toBeUndefined();
    const style = brandThemeStyle({ ...b, claimStatus: "claimed" } as Brand) as Record<string, string>;
    expect(style["--brand-primary"]).toBe("#1f4f46");
    expect(style["--brand-on-primary"]).toBe("#ffffff");
  });
  it("demotes a colour that fails contrast to an accent", () => {
    const style = brandThemeStyle({ claimStatus: "claimed", colorPrimary: "#777777" } as unknown as Brand) as Record<string, string>;
    expect(style["--brand-primary"]).toBe("var(--surface-2)");
  });
});
