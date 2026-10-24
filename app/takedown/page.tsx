import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { TakedownForm } from "@/components/TakedownForm";

export const metadata: Metadata = { title: "Takedown request" };

export default function Takedown() {
  return (
    <StaticPage title="Takedown request">
      <p>Anyone can ask us to remove content, including DMCA notices. Brands can also request removal from their dashboard. We act within 48 hours.</p>
      <TakedownForm />
    </StaticPage>
  );
}
