import { useTranslations } from "next-intl";
import { hours, metres, mm } from "@/lib/format";
import type { Model, Provenance, SpecKey } from "@/lib/types";

type Row = { key: SpecKey; value: string | null };

export function specRows(m: Model, t: ReturnType<typeof useTranslations>): { group: string; rows: Row[] }[] {
  const s = m.specs;
  const e = (ns: string, v: string | null) => (v ? (t.has(`enum.${ns}.${v}`) ? t(`enum.${ns}.${v}`) : v) : null);
  const crystal = s.crystalMaterial ? `${e("crystal", s.crystalMaterial)}${s.crystalShape ? `, ${t(`enum.crystalShape.${s.crystalShape}`)}` : ""}` : null;
  return [
    { group: "case", rows: [
      { key: "caseDiameterMm", value: mm(s.caseDiameterMm) },
      { key: "lugToLugMm", value: mm(s.lugToLugMm) },
      { key: "thicknessMm", value: mm(s.thicknessMm) },
      { key: "thicknessInclCrystalMm", value: mm(s.thicknessInclCrystalMm) },
      { key: "lugWidthMm", value: mm(s.lugWidthMm) },
      { key: "caseMaterial", value: e("mat", s.caseMaterial) },
    ] },
    { group: "movement", rows: [
      { key: "movementType", value: e("mov", s.movementType) },
      { key: "caliber", value: s.caliber },
      { key: "powerReserveH", value: hours(s.powerReserveH) },
      { key: "complications", value: s.complications.length ? s.complications.map((c) => e("comp", c)).join(", ") : null },
    ] },
    { group: "crystal", rows: [
      { key: "crystalMaterial", value: crystal },
      { key: "bezelType", value: s.bezelType },
    ] },
    { group: "water", rows: [{ key: "waterResistanceM", value: metres(s.waterResistanceM) }] },
    { group: "dial", rows: [
      { key: "dialColor", value: s.dialColorRaw ?? e("dial", s.dialColor) },
      { key: "lumeType", value: s.lumeType },
    ] },
    { group: "strap", rows: [{ key: "strapType", value: s.strapRaw ?? e("strap", s.strapType) }] },
  ];
}

const DOT: Record<Provenance, string> = { imported: "var(--warning)", brand: "var(--success)", editor: "var(--accent)" };

/** Grouped specs; each value carries a provenance marker with a tooltip (FR-6). */
export function SpecTable({ model }: { model: Model }) {
  const t = useTranslations();
  const groups = specRows(model, t);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map((g) => (
        <section key={g.group} aria-labelledby={`spec-${g.group}`}>
          <h3 id={`spec-${g.group}`} className="mb-2 border-b border-line pb-1 text-sm font-semibold">{t(`spec.group.${g.group}`)}</h3>
          <dl className="tabular grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
            {g.rows.map((r) => {
              const prov = model.specSources[r.key];
              const provLabel = prov ? t(`enum.provenance.${prov}`) : undefined;
              return (
                <div key={r.key} className="contents">
                  <dt className="text-muted">{t(`spec.${r.key}`)}</dt>
                  <dd className={r.value ? "" : "text-muted"}>
                    {r.value ? (
                      <span className="group relative inline-flex items-center gap-1.5" tabIndex={0} aria-describedby={`prov-${r.key}`}>
                        {r.value}
                        {prov && (
                          <>
                            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DOT[prov] }} />
                            <span id={`prov-${r.key}`} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-56 rounded-md bg-ink px-2 py-1 text-xs font-normal text-bg group-hover:block group-focus:block">
                              {provLabel}
                            </span>
                          </>
                        )}
                      </span>
                    ) : (
                      t("model.notListed")
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
