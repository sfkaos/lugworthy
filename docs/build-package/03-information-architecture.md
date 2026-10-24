# 03 Information architecture and routes — Lugworthy (lugworthy.com)
English at root. A Spanish locale can be added later under /es (RECOMMENDATION).

| Route | Page | Notes |
|---|---|---|
| / | Home | |
| /watches | Browse/filter | Core page; filters in query string |
| /brands | Brand index | |
| /brands/[brand] | Brand detail | |
| /brands/[brand]/[model] | Model detail | ?v=variant |
| /compare | Compare | ?ids=a,b,c |
| /calibers/[caliber] | Caliber hub | |
| /styles/[style] | Style hub | diver, field, gmt... |
| /countries/[country] | Country hub | e.g. American-made micros |
| /videos, /videos/[video] | Video hub/page | |
| /editorial, /editorial/[slug] | Articles | |
| /en-punto | En Punto fair + videos | links to En Punto site |
| /for-brands | Brand info + claim start | |
| /claim/[token] | Claim flow | |
| /dashboard/* | Brand dashboard | auth |
| /admin/* | Admin CMS | auth |
| /search?q= | Search results | |

Global nav: Watches · Brands · Videos · Editorial · En Punto · For brands · search.
Footer: about, image policy, takedown request, privacy, newsletter.
