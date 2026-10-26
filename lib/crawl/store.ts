// Saves brand logos and watch photos to file storage.
// Images are resized (max 1000 px, WebP) so the full catalog stays small.
// Driver is picked by IMAGE_STORE:
//   r2           Cloudflare R2 (S3 API): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
//   vercel-blob  Vercel Blob: BLOB_READ_WRITE_TOKEN
//   local        writes to data/images-local/ (for testing; never committed)
//   (unset)      no storage; catalogs keep only the brand's source URLs
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { politeGet } from "./fetch";

export interface ImageStore {
  name: string;
  /** Uploads bytes under key and returns the public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
}

export function imageStoreFromEnv(): ImageStore | null {
  const kind = process.env.IMAGE_STORE;
  if (kind === "r2") {
    // Trimmed: a pasted key with a trailing newline makes an invalid Authorization header.
    const env = (k: string) => process.env[k]?.trim() || undefined;
    const [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL] =
      ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"].map(env);
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) throw new Error("IMAGE_STORE=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL");
    let client: import("aws4fetch").AwsClient | null = null;
    return {
      name: "r2",
      async put(key, body, contentType) {
        if (!client) client = new (await import("aws4fetch")).AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
        const res = await client.fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`, {
          method: "PUT",
          body: new Uint8Array(body),
          headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
        });
        if (!res.ok) throw new Error(`R2 upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
      },
    };
  }
  if (kind === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("IMAGE_STORE=vercel-blob needs BLOB_READ_WRITE_TOKEN");
    return {
      name: "vercel-blob",
      async put(key, body, contentType) {
        const { put } = await import("@vercel/blob");
        const r = await put(key, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 });
        return r.url;
      },
    };
  }
  if (kind === "local") {
    const dir = path.resolve(__dirname, "../../data/images-local");
    return {
      name: "local",
      async put(key, body) {
        const file = path.join(dir, key);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
        return `file://${file}`;
      },
    };
  }
  return null;
}

export const keyHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);

/**
 * Downloads one image from the brand's site, resizes it, and stores it.
 * Logos keep transparency and are stored as WebP too; SVG logos are stored as-is.
 */
export async function mirrorImage(store: ImageStore, sourceUrl: string, keyBase: string, maxPx = 1000): Promise<{ storedUrl: string; width: number | null; height: number | null } | null> {
  const r = await politeGet(sourceUrl, "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8");
  if (!r.ok) return null;
  const isSvg = /svg/i.test(r.contentType) || (/\.svg(\?|$)/i.test(sourceUrl) && !/^image\/(?!svg)/i.test(r.contentType));
  const bytes = r.bytes;
  if (bytes.length < 200) return null;
  const key = `${keyBase}-${keyHash(sourceUrl)}`;
  if (isSvg) {
    if (!/<svg[\s>]/i.test(r.text) || /<script/i.test(r.text)) return null;
    return { storedUrl: await store.put(`${key}.svg`, bytes, "image/svg+xml"), width: null, height: null };
  }
  let data: Buffer, info: { width: number; height: number };
  try {
    const img = sharp(bytes, { animated: false, limitInputPixels: 80_000_000 }).rotate().resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true });
    ({ data, info } = await img.webp({ quality: 80 }).toBuffer({ resolveWithObject: true }));
  } catch {
    return null; // not a readable image
  }
  return { storedUrl: await store.put(`${key}.webp`, data, "image/webp"), width: info.width, height: info.height };
}
