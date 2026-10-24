import { describe, expect, it } from "vitest";
import { caliberName, extractSpecsFromText, inferStyles, isAccessory, toComplications, toDialColor, toMetres, toMm, toStrapType, toThickness } from "@/lib/ingest/normalize";
import { toIso2 } from "@/lib/countries";

describe("units", () => {
  it("parses mm and inches", () => {
    expect(toMm("40mm")).toBe(40);
    expect(toMm("39.5 mm")).toBe(39.5);
    expect(toMm(46.5)).toBe(46.5);
    expect(toMm('1.5"')).toBe(38.1);
    expect(toMm("n/a")).toBeNull();
  });
  it("converts ATM and bar to metres", () => {
    expect(toMetres("10 ATM")).toBe(100);
    expect(toMetres("20bar")).toBe(200);
    expect(toMetres("200m")).toBe(200);
    expect(toMetres(300)).toBe(300);
  });
  it("splits thickness with and without crystal", () => {
    expect(toThickness("11.5 without crystal, 12.5 with crystal")).toEqual({ thickness: 11.5, inclCrystal: 12.5 });
    expect(toThickness(12)).toEqual({ thickness: 12, inclCrystal: null });
  });
});

describe("calibers", () => {
  it("collapses aliases", () => {
    expect(caliberName("SII NH35A")).toBe("Seiko NH35");
    expect(caliberName("Cal. 9015")).toBe("Miyota 9015");
    expect(caliberName("Sellita 330")).toBe("Sellita SW330-2");
    expect(caliberName("Sellita SW200-1b")).toBe("Sellita SW200-1");
    expect(caliberName("Some in-house thing")).toBe("Some in-house thing");
  });
});

describe("synonyms", () => {
  it("maps dial and strap words", () => {
    expect(toDialColor("Teal fumé MOP")).toBe("teal");
    expect(toDialColor("vert olive")).toBe("green");
    expect(toDialColor("Taxi yellow and matte black")).toBe("multi");
    expect(toStrapType("Milanese Bracelet")).toBe("mesh");
    expect(toStrapType("Single Pass Recon - Olive")).toBe("nato");
    expect(toStrapType("Bonklip en acier")).toBe("bracelet");
  });
  it("finds complications and styles", () => {
    const c = toComplications(["GMT", "quick-set date"]);
    expect(c).toEqual(expect.arrayContaining(["gmt", "date"]));
    expect(inferStyles({ title: "Odyssey Pacific Blue", tags: [], wrM: 500, bezel: "120-click unidirectional", complications: [] })).toContain("diver");
    expect(inferStyles({ title: "Metric Lite", tags: ["metricchronograph"], complications: [] })).not.toContain("chronograph");
  });
  it("skips accessories", () => {
    expect(isAccessory("Leather Strap 20mm", "Straps")).toBe(true);
    expect(isAccessory("Helmsman SS", "Watch")).toBe(false);
  });
});

describe("text extraction", () => {
  it("pulls specs from body_html", () => {
    const html = "<p>Case diameter: 39mm</p><p>Lug to lug: 47.5mm</p><p>Thickness: 12.2mm</p><p>Water resistance: 20 ATM</p><p>Movement: Seiko NH35A</p><p>Domed sapphire crystal</p>";
    const s = extractSpecsFromText(html);
    expect(s).toMatchObject({ caseDiameterMm: 39, lugToLugMm: 47.5, thicknessMm: 12.2, waterResistanceM: 200, caliber: "Seiko NH35", crystal: "domed sapphire" });
    expect(s.confidence).toBe(1);
  });
});

describe("countries", () => {
  it("normalizes sheet country text", () => {
    expect(toIso2("USA (Dallas, TX)")).toBe("US");
    expect(toIso2("UK (Scotland)")).toBe("GB");
    expect(toIso2("Puerto Rico (USA)")).toBe("PR");
    expect(toIso2("Unknown (likely USA)")).toBeNull();
    expect(toIso2("Switzerland (Biel/Bienne)")).toBe("CH");
  });
});
