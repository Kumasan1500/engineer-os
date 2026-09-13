# Engineer OS v1.1 — Mobile UX & Learning Analytics

v1.1 turns the productized v1.0 baseline into a phone-first daily learning OS with reliable active-time analytics.

## What changed

- Mobile bottom navigation: Home / Learn / Review / Progress / More
- Compact iPhone home dashboard and reduced header clutter
- Dedicated Learn index and spaced-review queue
- Learning Analytics dashboard with all-time / today / week / month study time
- 14-day study chart
- Domain-level investment time
- Per-unit study time cards with Mastery, attempts and score
- Lesson / quiz / explanation-review time breakdown
- Active-time timer ignores background tabs and pauses after 90 seconds without interaction
- Device/session IDs reduce double-counting risk across PC and phone
- Mock, Lab and Project pages now contribute to total learning time

## Migration from v1.0

1. Keep your current `.env.local`; do not commit it.
2. Run `sql/v1.1_mobile_analytics.sql` once in Supabase SQL Editor.
3. Replace your v1.0 code with the v1.1 code.
4. Run `npm.cmd install` and `npm.cmd run dev` locally if you want a local check.
5. Commit and push to the connected GitHub repository. Vercel will redeploy automatically.

## Time accounting

The timer counts a 15-second interval only when the page is visible and the user has interacted in the previous 90 seconds. Background time and long idle time are not counted. Unit learning separates lecture, quiz and explanation/review time. Historical v1.0 records remain part of total time, but cannot be retroactively split into those phases.

## Note

This is a learning analytics system, not a guarantee of exam success or compensation. Readiness and efficiency metrics are decision aids.
