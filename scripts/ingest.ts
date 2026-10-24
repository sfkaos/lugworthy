// Pull one or more Shopify stores and write normalized drafts for review.
//   npm run ingest -- lorierwatches.com farer.com
// Output: data/raw/ingest/<domain>.json. Unchanged products (same hash) are skipped.
import fs from "node:fs";
import path from "node:path";
import { mapProduct, pullProducts } from "../lib/ingest/shopify";

const domains = process.argv.slice(2);
if (!domains.length) {
  console.error("usage: npm run ingest -- <domain> [domain…]");
  process.exit(1);
}
const outDir = path.resolve(__dirname, "../data/raw/ingest");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  // Domains run in parallel; requests within a domain stay 2 s apart.
  await Promise.all(domains.map(async (domain) => {
    const file = path.join(outDir, `${domain}.json`);
    const prev = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as { hash: string; slug: string }[]) : [];
    const prevHashes = new Map(prev.map((p) => [p.slug, p.hash]));
    try {
      const products = await pullProducts(domain);
      const mapped = products.map((p) => mapProduct(p, domain)).filter((m): m is NonNullable<typeof m> => !!m);
      const changed = mapped.filter((m) => prevHashes.get(m.slug) !== m.hash);
      fs.writeFileSync(file, JSON.stringify(mapped, null, 1));
      console.log(`${domain}: ${products.length} products, ${mapped.length} watches, ${changed.length} new/changed, ${mapped.filter((m) => m.needsReview).length} need review`);
    } catch (e) {
      console.error(`${domain}: ${(e as Error).message}`);
    }
  }));
})();
