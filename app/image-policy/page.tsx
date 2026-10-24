import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Image policy" };

export default function ImagePolicy() {
  return (
    <StaticPage title="Image policy">
      <p>We don’t display a brand’s photos until the brand grants permission. Until then, pages show specs and a to-scale case outline.</p>
      <p>When a brand claims its page it can accept a plain-language license: non-exclusive, royalty-free and revocable permission to show its images on Lugworthy and related En Punto posts, with credit. We log who accepted, when, and which version.</p>
      <p>A brand can revoke the license at any time from its dashboard. Images come down within one hour.</p>
    </StaticPage>
  );
}
