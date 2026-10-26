import type { Metadata } from "next";
import { WatchesView } from "@/components/views/WatchesView";

// The unfiltered list is cached and served instantly. Any query string (filters, sort, page,
// search) is rewritten by middleware.ts to /browse/watches, which renders on request.
export const metadata: Metadata = { title: "Watches", alternates: { canonical: "/watches" } };

export default function WatchesPage() {
  return <WatchesView search={{}} />;
}
