export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lugworthy.com";
export const EN_PUNTO_URL = process.env.NEXT_PUBLIC_EN_PUNTO_URL ?? "https://enpunto.watch";
export const EXHIBIT_URL = process.env.NEXT_PUBLIC_EXHIBIT_URL ?? `${EN_PUNTO_URL}`;

export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
