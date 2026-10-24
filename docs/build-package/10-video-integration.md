# 10 Video integration — Lugworthy (lugworthy.com)
- Sources: YouTube (videos + Shorts), Instagram Reels/posts (oEmbed), TikTok optional.
- Admin creates video by pasting URL; fetch title/thumbnail/duration via oEmbed/YouTube Data API.
- Tag via video_links: brands, models, timestamp_s (chapters). Bulk-tag UI with model search.
- Placement rules: brand page after models grid; model page after spec table; browse results max 1 VideoCard per 12 cards and only when video tagged to a model in results; home 1 card. Directory content always above the fold.
- Embed: facade (thumbnail + play button), load iframe on click (youtube-nocookie.com). Model page deep-links `?start=timestamp`.
- Video page: embed, chapters list linking models, featured watches grid, transcript (optional) for SEO.
- Series: Fair walkthroughs, Brand visits, Wrist checks, Shorts (editable).
- Schema.org VideoObject on video pages and where embedded.
