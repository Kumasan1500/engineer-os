# Engineer OS v1.0 — phone/PWA deployment

To use Engineer OS as a real phone app, deploy it over HTTPS. Service workers/PWA installation require HTTPS outside localhost.

## Recommended baseline: GitHub + Vercel
1. Put the `engineer-os` folder in a private GitHub repository.
2. Import the repository into Vercel as a Next.js project.
3. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to the browser or any `NEXT_PUBLIC_` variable. It is only needed for the local `content:sync` script unless you intentionally build a protected server-side content pipeline later.
5. Deploy.
6. Open the HTTPS deployment URL on iPhone Safari and use Share -> Add to Home Screen.

## Supabase
Run every migration through `sql/v1.0_productization.sql` in order. Existing v0.9 users only need to run the v1.0 SQL migration.

## Security rules
- Publishable key is safe for browser use when RLS is correctly configured.
- Secret/service-role key bypasses RLS and must remain server-only.
- Keep `.env.local` out of Git. The included `.gitignore` should continue to ignore it.
- If a secret key is ever committed or shared publicly, rotate it in Supabase immediately.

## Production smoke test
After deployment, check:
- Login/logout persists after reload.
- Home progress matches desktop.
- Lesson, quiz, mastery and review save successfully.
- Career OS / Readiness / Tech Radar load.
- Settings save and notification test works where browser permission allows it.
- Backup JSON downloads.
- PWA installs and launches standalone.
- Going offline shows the offline banner/fallback instead of a blank page.
