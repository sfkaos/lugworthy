import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <StaticPage title="Privacy">
      <p>We collect as little as we can: your email if you subscribe to the newsletter, and a brand user’s email if a brand claims its page.</p>
      <p>We use PostHog to count page views and see how the site is used. It doesn’t store IP addresses or build profiles of anonymous visitors. Your compare list lives in your own browser.</p>
      <p>To have your data deleted, use the takedown form or reply to any of our emails. We honor CCPA requests.</p>
    </StaticPage>
  );
}
