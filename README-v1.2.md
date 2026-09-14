# Engineer OS v1.2 — Deep Curriculum / Glossary / Offline Foundation

v1.2 shifts Engineer OS from a simple completion model to a layered mastery model.

## Main additions

- Level-based curriculum (L1–L5) across the core tracks.
- Existing Computer Fundamentals content expanded beyond the original five units.
- Linux / Networking / Git / Python / AWS / Docker / Terraform / Kubernetes / CI/CD / SRE / Security curricula added.
- GCP and Azure starter tracks included for future expansion.
- Detailed quiz explanations for both correct and incorrect answers:
  - why the correct choice is correct
  - why the other choices are wrong
  - related knowledge
  - practical use
  - exam/interview traps
- Tap-to-explain glossary inside lessons.
- Personal glossary library with lookup counts and familiarity signals.
- iPhone safe-area / Dynamic Island / home-indicator spacing.
- Offline shell and service-worker improvements.
- Existing Tech Radar retained for tracking fast-moving technology updates.

## Curriculum depth

The intended level model is:

- L1: terminology, concepts, foundations
- L2: mechanisms, architecture, internal behavior
- L3: commands, configuration, implementation, hands-on
- L4: troubleshooting, diagnosis, operations, incident thinking
- L5: design, optimization, security, trade-offs, advanced interviews/certification

## Upgrade from v1.1

1. Run `sql/v1.2_levels_glossary_offline.sql` once in Supabase SQL Editor.
2. Copy your existing `.env.local` into this project folder.
3. Install dependencies:

```powershell
npm.cmd install
```

4. Synchronize the new curriculum and glossary:

```powershell
npm.cmd run content:sync
```

5. Start locally:

```powershell
npm.cmd run dev
```

6. After local verification, copy these files into the Git-tracked Engineer OS repository, then commit and push to GitHub so Vercel redeploys.

## Important

`content:sync` requires the server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Never expose that key in a `NEXT_PUBLIC_` variable or commit `.env.local` to GitHub.

The content pack currently contains hundreds of questions and a broad L1–L5 foundation. It is a base for continued enrichment, not a claim that every certification or vendor domain is exhaustively complete. Tech Radar and future content packs should keep vendor-specific material current against official documentation and current exam guides.
