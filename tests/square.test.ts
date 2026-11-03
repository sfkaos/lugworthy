import { describe, expect, it } from "vitest";
import { mapSquareProduct } from "../lib/crawl/catalog";
import { isSquareSite, squareIds, squareStorePages, type SquareProduct } from "../lib/crawl/square";

describe("Square Online and Weebly stores", () => {
  it("reads the store ids from Square Online bootstrap data", () => {
    const html = `<script>window.__BOOTSTRAP_STATE__={"user":{"id":153568797,"properties":{}},"site":{"site_id":942542171295335368},"currency":"GBP"}</script>`;
    expect(squareIds(html)).toEqual({ userId: "153568797", siteId: "942542171295335368", currency: "GBP" });
  });

  it("reads the store ids from a Weebly page", () => {
    const html = `<link href="//cdn11.editmysite.com/css/sites.css"><script>_W.storeCurrency = "CAD"; var user_id = '120409059'; var site_id = '978524898160875651';</script>`;
    expect(isSquareSite(html)).toBe(true);
    expect(squareIds(html)).toEqual({ userId: "120409059", siteId: "978524898160875651", currency: "CAD" });
    expect(squareIds("<p>no store</p>")).toBeNull();
  });

  it("finds a linked square.site shop and same-site store pages", () => {
    const html = `<a href="https://abingerwatches.square.site/">Shop</a><a href="/store/c13/numeric">Numeric</a><a href="/about">About</a><a href="https://other.com/store/x">x</a>`;
    expect(squareStorePages(html, "https://www.abingerwatches.com/")).toEqual(["https://abingerwatches.square.site/", "https://www.abingerwatches.com/store/c13/numeric"]);
  });

  it("maps products, cleans stock notes from names and skips accessories", () => {
    const watch: SquareProduct = {
      name: "Barracuda Blue 200M SOLD OUT",
      absolute_site_link: "https://oceanicawatches.com/store/p5/barracuda.html",
      short_description: "<p>40mm case, 200m water resistance</p>",
      price: { low_subunits: 26999, high_subunits: 26999 },
      images: { data: [{ absolute_url: "https://x.cdn.editmysite.com/a.jpg" }] },
      badges: { out_of_stock: true },
    };
    const w = mapSquareProduct(watch, "USD")!;
    expect(w.name).toBe("Barracuda Blue 200M");
    expect(w).toMatchObject({ priceMinor: 26999, currency: "USD", availability: "sold_out", url: watch.absolute_site_link });
    expect(w.images).toHaveLength(1);
    for (const name of ["Detroit Mint Hollywood Style Watch Cuff in Oil Tanned Black Leather", "Detroit Mint Aviator Sunglasses Gold Lenses", "Black Cordura Strap"])
      expect(mapSquareProduct({ ...watch, name }, "USD"), name).toBeNull();
  });
});
