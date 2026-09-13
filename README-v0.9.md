# Engineer OS v1.0 — Tech Radar

## What changed
- Official-first Tech Radar at `/tech-radar`
- Live server-side checks of AWS What's New, Kubernetes, CNCF and CISA feeds
- 30-minute refresh cache plus manual refresh button
- Impact classification: High / Medium / Low
- Radar rings: Adopt / Trial / Assess / Watch
- Maps updates to Engineer OS skill areas
- Uses current mastery to show whether an update is immediately relevant or should wait until foundations are stronger
- Logged-in users can mark items as curriculum candidates, watch, or hold
- Curriculum does **not** mutate automatically. Updates stay reviewable.

## Upgrade from v0.8
1. Copy `.env.local` from v0.8 to v0.9 `engineer-os/`.
2. In Supabase SQL Editor, run `sql/v0.9_tech_radar.sql` once.
3. Run `npm.cmd install`.
4. Run `npm.cmd run dev`.
5. Open Engineer OS and click **Tech Radar**.

No `content:sync` is required for this upgrade.
