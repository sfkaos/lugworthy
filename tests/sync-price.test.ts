import { describe, expect, it } from "vitest";
import { fitsInt } from "@/lib/sync/catalog";

// price_minor is a 32-bit integer column; BRD-0805 lists a ¥26,774,000.00 piece (2,677,400,000 minor units).
describe("catalog import price guard", () => {
  it("keeps prices that fit the column", () => {
    expect(fitsInt(39000)).toBe(39000);
    expect(fitsInt(2_147_483_647)).toBe(2_147_483_647);
    expect(fitsInt(null)).toBeNull();
  });
  it("drops prices too large for price_minor instead of failing the import", () => {
    expect(fitsInt(2_677_400_000)).toBeNull();
    expect(fitsInt(1.5)).toBeNull();
  });
});
