import type { Metadata } from "next";
import { WatchesView, type WatchesSearch } from "@/components/views/WatchesView";

// Filtered /watches views. Reached through the middleware rewrite, so the address bar keeps /watches?…
// Arbitrary filter combos are noindex; curated combos live on hub pages (doc 09).
export const metadata: Metadata = { title: "Watches", alternates: { canonical: "/watches" }, robots: { index: false, follow: true } };

export default async function FilteredWatchesPage({ searchParams }: { searchParams: Promise<WatchesSearch> }) {
  return <WatchesView search={await searchParams} />;
}
