# 13 Analytics and affiliates — Lugworthy (lugworthy.com)
Tool: PostHog (RECOMMENDATION). Events: search_performed {q, results}, filter_applied {facet, value}, model_viewed, brand_viewed, variant_selected, compare_added/opened, video_played {video, page, timestamp}, outbound_click {brand, model, variant, affiliate}, newsletter_signup, claim_started/verified, exhibit_cta_clicked.
KPIs: monthly visitors, filter usage rate, outbound clicks per session, video plays from directory pages, claimed brands, exhibitor CTA clicks, newsletter signups.
Affiliates: per-brand config {network: impact|uppromote|kutoku|shopify_collabs|refersion|none, url_template}. Outbound via /out/[variant] redirect that logs click then 302s. Always add UTM (utm_source=lugworthy, utm_medium=directory). FTC disclosure line on pages with affiliate links and in footer.
Brand reporting (later): monthly clicks/views per brand in dashboard.
