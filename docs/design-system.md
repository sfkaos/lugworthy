# Lugworthy design system

Picked with the [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) design data
(queries: "luxury ecommerce jewelry watches" and "luxury watch catalog directory editorial").

| Decision | Choice | Why |
|---|---|---|
| Page pattern | Marketplace / Directory: search-first hero, categories with icons, featured listings, trust section | Search and filters are the main job of the site |
| Style | Minimalism & Swiss: hairlines, no shadows, 2–6 px corners | The skill's "Luxury" match was Liquid Glass, but its own data rates that for Apple app chrome with a blur cost; the luxury profile lists Minimalism as the alternative |
| Palette | Warm stone neutrals, near-black `#1c1917` primary, brass accent (`#8a5a0b` light, `#e3c27a` dark) | Luxury/Premium palette ("premium dark + gold accent"); brass darkened from `#A16207` to keep 4.5:1 on small text |
| Type | Cormorant Garamond for headings, Inter for body and specs | Cormorant from the "Luxury Serif" pairing; Inter (from "Classic Elegant") kept for body because spec tables need clear tabular figures |
| Motion | 150–300 ms color and border changes; off under `prefers-reduced-motion` | Skill checklist |

Tokens live in `app/globals.css` (`:root`, dark overrides, `@theme inline`). Components use the tokens,
never raw hex. Claimed brands can still theme their pages (`lib/theme.ts`); the buy button takes the
brand color only when its text stays readable.

Before/after screenshots: `docs/redesign/`.
