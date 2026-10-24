// Facet value labels, resolved from messages so they translate with the UI.
import { getTranslations } from "next-intl/server";
import { CALIBERS } from "./ingest/normalize";
import { countryName } from "./countries";

export async function facetLabels(counts: Record<string, Record<string, number>>) {
  const t = await getTranslations("enum");
  const out: Record<string, Record<string, string>> = {};
  const enumFacet: Record<string, string> = { mov: "mov", style: "style", dial: "dial", strap: "strap", avail: "avail", crystal: "crystal", mat: "mat", comp: "comp" };
  const caliberNames = Object.fromEntries(Object.values(CALIBERS).map((c) => [c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), c.name]));
  for (const [facet, values] of Object.entries(counts)) {
    out[facet] = {};
    for (const v of Object.keys(values)) {
      if (enumFacet[facet]) out[facet][v] = t.has(`${enumFacet[facet]}.${v}`) ? t(`${enumFacet[facet]}.${v}`) : v;
      else if (facet === "country") out[facet][v] = countryName(v);
      else if (facet === "lug") out[facet][v] = `${v} mm`;
      else if (facet === "cal") out[facet][v] = caliberNames[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      else out[facet][v] = v;
    }
  }
  return out;
}
