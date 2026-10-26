import type { Metadata } from "next";
import { BrandsView } from "@/components/views/BrandsView";

// The unfiltered directory is cached and served instantly. Any query string (letter, filters, page)
// is rewritten by middleware.ts to /browse/brands, which renders on request.
export const metadata: Metadata = { title: "Watch brands A–Z", alternates: { canonical: "/brands" } };

export default function BrandsPage() {
  return <BrandsView search={{}} />;
}
