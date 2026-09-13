# Engineer OS v1.0

Engineer OS v1.0 is the first productized baseline of the learning/career OS.

## Core systems
- Supabase authentication and cross-device progress sync
- Curriculum progress + mastery + spaced review
- Randomized quiz bank and answer shuffling
- Daily mission planner, study sessions, streaks, resume-in-progress
- Certification readiness, mock exams and hands-on labs
- Career OS role readiness, practical projects and GitHub evidence
- Tech Radar with official-first technology intelligence
- PWA manifest, install flow, offline fallback and service worker caching
- Settings and notification permission/test flow
- Personal data JSON export in addition to Supabase cloud persistence
- UI recovery boundary and network status banner

## v1.0 migration
1. Copy `.env.local` from v0.9 into this `engineer-os` directory.
2. Run `sql/v1.0_productization.sql` once in Supabase SQL Editor.
3. Run `npm.cmd install`.
4. Run `npm.cmd run dev`.
5. Open the Local URL printed by Next.js.

No content sync is required when upgrading from a working v0.9 database.

## PWA
On iPhone/iPad use Safari Share -> Add to Home Screen. On compatible desktop/Android browsers use the in-app Install button when available.

## Notifications
v1.0 provides notification permission/testing and a synced reminder preference. Fully reliable scheduled notifications while the app is completely closed require a server-side Web Push scheduler; this is intentionally not misrepresented as already available.

## Data safety
Primary learning data lives in Supabase under row-level security. `/backup` can export the current user's learning/career data to JSON for an additional local copy.
