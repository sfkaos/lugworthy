import { finishCollections, keepCollection, normUrl, parseListing } from "../lib/crawl/collections";
import { describe, expect, it } from "vitest";
import { looksLikeWatch, mapShopifyProduct, mergeWithPrevious, specsFrom, stripSiteSuffix, type BrandCatalog } from "../lib/crawl/catalog";
import { extractDetail, extractSpecPairs } from "../lib/crawl/detail";
import { parseRobots, robotsAllowsPath } from "../lib/crawl/fetch";
import { findBrandImage, fullSizeImage, load } from "../lib/crawl/html";

describe("robots.txt", () => {
  const robots = parseRobots(`User-agent: *\nDisallow: /checkout\nDisallow: /*?variant=\nAllow: /checkout/public\nCrawl-delay: 5\nSitemap: https://x.com/sitemap.xml`);
  it("uses longest match", () => {
    expect(robotsAllowsPath(robots, "/products/a")).toBe(true);
    expect(robotsAllowsPath(robots, "/checkout/1")).toBe(false);
    expect(robotsAllowsPath(robots, "/checkout/public/x")).toBe(true);
    expect(robotsAllowsPath(robots, "/products/a?variant=1")).toBe(false);
  });
  it("reads sitemaps and crawl-delay", () => {
    expect(robots.sitemaps).toEqual(["https://x.com/sitemap.xml"]);
    expect(robots.crawlDelayS).toBe(5);
  });
  it("prefers a group naming our bot", () => {
    const r = parseRobots(`User-agent: *\nDisallow:\n\nUser-agent: LugworthyBot\nDisallow: /`);
    expect(robotsAllowsPath(r, "/")).toBe(false);
  });
});

describe("watch filter", () => {
  it("drops accessories", () => {
    expect(looksLikeWatch("Rubber Strap 20mm")).toBe(false);
    expect(looksLikeWatch("FKM 橡膠錶帶 20mm 藏青")).toBe(false);
    expect(looksLikeWatch("Gift Card")).toBe(false);
    expect(looksLikeWatch("Sticker pack", "", [], 500)).toBe(false);
  });
  it("keeps watches", () => {
    expect(looksLikeWatch("Heartlander Solar 38mm Field Watch")).toBe(true);
    expect(looksLikeWatch("Diver on bracelet", "Watches")).toBe(true);
  });
});

describe("specs", () => {
  it("reads brand spec pairs in other languages", () => {
    const s = specsFrom("", { "Diamètre": "39 mm", "Corne à corne": "46 mm", "Épaisseur": "11,7 mm", "Entrecorne": "20 mm", "Étanchéité": "10 ATM" });
    expect(s).toMatchObject({ caseDiameterMm: 39, lugToLugMm: 46, thicknessMm: 11.7, lugWidthMm: 20, waterResistanceM: 100 });
  });
  it("rejects implausible values", () => {
    expect(specsFrom("Case diameter: 12mm").caseDiameterMm).toBeNull();
  });
});

describe("detail page", () => {
  const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Field 38","description":"A field watch","offers":{"@type":"Offer","price":"450.00","priceCurrency":"USD","availability":"https://schema.org/OutOfStock"}}</script></head>
  <body><header><img class="logo" src="/logo_120x.png" alt="Acme"></header><main>
  <table><tr><th>Case size</th><td>38 mm</td></tr><tr><th>Lug width</th><td>20 mm</td></tr></table>
  <ul><li><strong>Crystal</strong> Sapphire</li><li>Water resistance: 100 m</li></ul></main></body></html>`;
  it("finds spec pairs and sold-out state", () => {
    const d = extractDetail(load(html));
    expect(d.availability).toBe("sold_out");
    expect(d.specsRaw).toMatchObject({ "Case size": "38 mm", "Lug width": "20 mm", Crystal: "Sapphire", "Water resistance": "100 m" });
  });
  it("finds the header logo at full size", () => {
    const img = findBrandImage(load(html), "https://acme.com/", "Acme");
    expect(img).toMatchObject({ kind: "logo", url: "https://acme.com/logo.png" });
  });
  it("ignores page chrome", () => {
    expect(extractSpecPairs(load(`<footer><p>Phone: 123</p></footer><main><p>Movement: NH35</p></main>`))).toEqual({ Movement: "NH35" });
  });
});

describe("helpers", () => {
  it("strips site names from titles", () => {
    expect(stripSiteSuffix("Mark III GMT — Höglund & Sons", "Höglund & Sons")).toBe("Mark III GMT");
  });
  it("asks Shopify for full-size images", () => {
    expect(fullSizeImage("https://a.com/cdn/shop/files/Logo_120x.png?v=1")).toBe("https://a.com/cdn/shop/files/Logo.png?v=1");
  });
  it("maps Shopify variants and sold-out state", () => {
    const w = mapShopifyProduct({
      title: "Diver", handle: "diver", body_html: "<p>Case diameter: 40mm</p>", product_type: "Watch", tags: [],
      options: [{ name: "Size", values: ["38mm", "40mm"] }],
      variants: [
        { title: "38mm", sku: "D38", price: "500.00", compare_at_price: null, available: false, option1: "38mm", option2: null, option3: null },
        { title: "40mm", sku: "D40", price: "520.00", compare_at_price: null, available: false, option1: "40mm", option2: null, option3: null },
      ],
      images: [{ src: "https://cdn.shopify.com/a.jpg" }],
    }, "https://acme.com", "USD")!;
    expect(w.availability).toBe("sold_out");
    expect(w.priceMinor).toBe(50000);
    expect(w.options[0].values).toEqual(["38mm", "40mm"]);
    expect(w.variants).toHaveLength(2);
  });
  it("keeps availability history across crawls", () => {
    const watch = (availability: "in_stock" | "sold_out", at: string) => ({ id: "BRD-0001/x", availability, availabilityCheckedAt: at, availabilityHistory: [{ at, availability }] });
    const prev = { watches: [watch("sold_out", "2026-10-01")] } as unknown as BrandCatalog;
    const cur = { watches: [watch("in_stock", "2026-10-08")] } as unknown as BrandCatalog;
    expect(mergeWithPrevious(cur, prev).watches[0].availabilityHistory).toEqual([
      { at: "2026-10-01", availability: "sold_out" }, { at: "2026-10-08", availability: "in_stock" },
    ]);
  });
});

describe("collections", () => {
  it("drops catch-all groupings", () => {
    expect(keepCollection("all", "All")).toBe(false);
    expect(keepCollection("straps", "Straps")).toBe(false);
    expect(keepCollection("hydra-series", "Hydra Series")).toBe(true);
  });

  it("reads a listing page as a collection with its product links", () => {
    const html = `<html><head><title>Divers | Brand</title><meta name="description" content="Our dive watches"></head><body>
      <h1>Divers</h1><a href="/products/falcon"><img src="a.jpg"></a><a href="/products/hydra">Hydra</a><a href="/blog/x"><img src="b.jpg"></a></body></html>`;
    const { draft, links } = parseListing(html, "https://brand.com/collections/divers", "Brand", /\/products\//);
    expect(draft.name).toBe("Divers");
    expect(draft.description).toBe("Our dive watches");
    expect(links.sort()).toEqual(["https://brand.com/products/falcon", "https://brand.com/products/hydra"]);
  });

  it("keeps only collections with crawled watches; a watch may have none or several", () => {
    const watches = [
      { id: "BRD-0001/a", url: "https://brand.com/products/a", collectionIds: [] as string[] },
      { id: "BRD-0001/b", url: "https://www.brand.com/products/b?variant=1", collectionIds: [] as string[] },
      { id: "BRD-0001/c", url: "https://brand.com/products/c", collectionIds: [] as string[] },
    ];
    const d = (slug: string, urls: string[]) => ({ slug, name: slug, url: null, description: null, image: null, memberUrls: new Set(urls.map(normUrl)) });
    const cols = finishCollections("BRD-0001", [d("divers", ["https://brand.com/products/a", "https://brand.com/products/b"]), d("field", ["https://brand.com/products/a"]), d("empty", ["https://brand.com/products/zzz"])], watches);
    expect(cols.map((c) => c.id)).toEqual(["BRD-0001/divers", "BRD-0001/field"]);
    expect(watches[0].collectionIds).toEqual(["BRD-0001/divers", "BRD-0001/field"]);
    expect(watches[1].collectionIds).toEqual(["BRD-0001/divers"]);
    expect(watches[2].collectionIds).toEqual([]);
  });
});
