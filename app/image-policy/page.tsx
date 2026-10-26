import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { imagesMode } from "@/lib/brands/media";

export const metadata: Metadata = { title: "Image policy" };

export const dynamic = "force-static";

export default function ImagePolicy() {
  const mode = imagesMode();
  if (mode === "all" || mode === "logos") {
    return (
      <StaticPage title="Image policy">
        <p>
          {mode === "all"
            ? "Watch photos and brand logos on Lugworthy come from each brand’s own website. Every photo is credited to the brand and links back to the page it came from."
            : "Brand logos on Lugworthy come from each brand’s own website and are credited to the brand. We don’t display a brand’s watch photos until the brand grants permission; until then, pages show specs and a to-scale case outline."}
        </p>
        <p>We never edit a brand’s images, and we don’t sell or license them to anyone.</p>
        <p>If you’re a brand and want your images removed, use the <a className="link" href="/takedown">takedown form</a>. We take them down within 48 hours. Brands can also claim their page to manage their images directly.</p>
      </StaticPage>
    );
  }
  return (
    <StaticPage title="Image policy">
      <p>We don’t display a brand’s photos until the brand grants permission. Until then, pages show specs and a to-scale case outline.</p>
      <p>When a brand claims its page it can accept a plain-language license: non-exclusive, royalty-free and revocable permission to show its images on Lugworthy and related En Punto posts, with credit. We log who accepted, when, and which version.</p>
      <p>A brand can revoke the license at any time from its dashboard. Images come down within one hour.</p>
    </StaticPage>
  );
}
