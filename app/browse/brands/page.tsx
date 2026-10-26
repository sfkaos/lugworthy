import type { Metadata } from "next";
import { BrandsView, type BrandsSearch } from "@/components/views/BrandsView";

// Filtered /brands views. Reached through the middleware rewrite, so the address bar keeps /brands?…
export const metadata: Metadata = { title: "Watch brands A–Z", alternates: { canonical: "/brands" }, robots: { index: false, follow: true } };

export default async function FilteredBrandsPage({ searchParams }: { searchParams: Promise<BrandsSearch> }) {
  return <BrandsView search={await searchParams} />;
}
