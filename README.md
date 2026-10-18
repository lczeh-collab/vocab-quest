# Vocab Quest ✨

Snap a photo of a handwritten English–Hungarian vocabulary notebook, check the words, then learn them with games.

**Stack:** Next.js (TypeScript, Tailwind) on Vercel · Supabase (Postgres + magic-link login) · Claude vision API for reading handwriting.

## How it works

```
Browser ── photo (resized to 1600px JPEG) ──▶ /api/parse ──▶ Claude → [{en, hu, kind, uncertain}]
   │                                                                          │
   └── review & fix pairs ◀───────────────────────────────────────────────────┘
   └── save / play games ──▶ Supabase (words, profiles, rounds; row-level security)
```

- **Spaced repetition:** each word sits in a Leitner box 1–5. A right answer moves it up a box (due again after 0/1/3/7/14 days); a wrong answer sends it back to box 1. Each round picks due words first.
- **Games:** Flashcards (EN↔HU, keyboard: space / ← / →), Speed Match (against the clock), Type It (lenient checking that accepts typos and missing accents, with hints).
- **Gamification:** XP, levels and titles, daily streak, combos, 9 badges, end-of-round feedback with "tricky words".

| Path | What |
|---|---|
| `src/app/api/parse/route.ts` | Claude call: image → structured word pairs |
| `src/app/scan/page.tsx` | Upload / webcam capture + review screen |
| `src/app/words/page.tsx` | Word list: edit, delete, add, search |
| `src/app/play/*` | The three games |
| `src/components/GameShell.tsx` | Round loading + results/feedback screen |
| `src/lib/leitner.ts`, `progress.ts`, `gamification.ts`, `check.ts` | Learning logic |
| `supabase/schema.sql` | Database tables + security policies |

## Setup (about 20 minutes)

1. **Supabase**: create a free project at supabase.com.
   - SQL Editor → paste `supabase/schema.sql` → Run.
   - Authentication → URL Configuration: set **Site URL** to your Vercel URL and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to Redirect URLs.
   - After you and she have each logged in once, turn off **Allow new users to sign up** (Authentication → Sign In / Providers).
2. **Anthropic**: console.anthropic.com → add a few dollars of credit → create an API key. Optionally set a monthly spend limit.
3. **Local run**: `cp .env.example .env.local`, fill in the values, then `npm install && npm run dev` → http://localhost:3000
4. **Deploy**: push to GitHub → vercel.com → *Add New Project* → import the repo → add the env vars from `.env.example` → Deploy. Every `git push` redeploys.

## Costs

Vercel Hobby and Supabase Free cost $0. Claude: about 2–3¢ per photo on the default model, or under 0.1¢ with `ANTHROPIC_MODEL=claude-haiku-5-5`. Try Haiku on a few real pages and keep it if it reads her handwriting well. Note: Supabase pauses free projects after 7 days of no activity; you restore them with one click in the dashboard.

## Ideas for next steps

- Arcade "falling words" game, and a Hungarian→English multiple-choice quiz
- Lessons/units: tag each scan with a notebook page or date and practice one unit before a test
- Pronunciation check with the browser's speech recognition
- Parent view: weekly stats from the `rounds` table
