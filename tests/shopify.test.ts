import { describe, expect, it } from "vitest";
import { mapProduct, payloadHash, type ShopifyProduct } from "@/lib/ingest/shopify";

const product: ShopifyProduct = {
  id: 1, title: "Sea Hound 39", handle: "sea-hound-39", product_type: "Watch", tags: ["dive", "automatic"],
  body_html: "<ul><li>Case diameter: 39mm</li><li>Lug to lug: 47mm</li><li>Thickness: 12.5mm</li><li>Water resistance: 20 ATM</li><li>Movement: SII NH35A automatic</li><li>Sapphire crystal</li></ul>",
  variants: [
    { id: 11, title: "Blue / Bracelet", sku: "SH39-BLU-BR", price: "449.00", compare_at_price: null, available: true, option1: "Blue", option2: "Bracelet", option3: null },
  ],
  images: [{ src: "https://cdn.example/1.jpg", width: 2000, height: 2000 }],
};

describe("mapProduct", () => {
  it("normalizes a Shopify product into a draft model", () => {
    const m = mapProduct(product, "example.com")!;
    expect(m.specs).toMatchObject({ caseDiameterMm: 39, lugToLugMm: 47, thicknessMm: 12.5, waterResistanceM: 200, caliber: "Seiko NH35", movementType: "automatic", dialColor: "blue", strapType: "bracelet" });
    expect(m.styles).toContain("diver");
    expect(m.variants[0].price).toBe(44900);
    expect(m.needsReview).toBe(false);
  });
  it("keeps imported images private", () => {
    expect(mapProduct(product, "example.com")!.images.every((i) => i.rights === "unknown")).toBe(true);
  });
  it("skips straps and accessories", () => {
    expect(mapProduct({ ...product, title: "Tropic Rubber Strap", product_type: "Straps" }, "example.com")).toBeNull();
  });
  it("hash ignores irrelevant fields and changes with price (AC-6)", () => {
    const h = payloadHash(product);
    expect(payloadHash({ ...product, images: [] })).toBe(h);
    expect(payloadHash({ ...product, variants: [{ ...product.variants[0], price: "499.00" }] })).not.toBe(h);
  });
});
