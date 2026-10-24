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
- **Games:** Speed Match (Hungarian words with their pictures on the left, English on the right, against the clock; the English is read aloud on a match), Type It (large picture and the Hungarian word, plus a gap-sentence clue for hard words; lenient checking that accepts typos and missing accents, with hints; correct answers are read aloud), Balloon Pop (pick the translation before the balloon escapes), Memory (4×4 cards: Hungarian with picture vs English, flip two at a time; a found pair becomes one card with the picture and the English word, click it to hear it again; moves, timer and best result; bonus XP for few moves).
- **Gamification:** XP, levels and titles, daily streak, combos, 9 badges, end-of-round feedback with "tricky words".
- **Pictures:** every word gets an AI picture. Claude Haiku decides what to show (for hard words like "although" it picks a simple example expression and pictures that), GPT (`gpt-image-1-mini`) draws it, and it is stored in the `word_pictures` table (served only to its family by `/api/picture`). One picture per word per family, shared by siblings; "🔄 New picture" on the Words page replaces it.
- **Family players:** after the family email login, a "Who's playing?" screen. Each player has a name, avatar, colour and 4-digit PIN, plus their own words, XP, streak and badges.

| Path | What |
|---|---|
| `src/app/api/parse/route.ts` | Claude call: image → structured word pairs |
| `src/app/scan/page.tsx` | Upload / webcam capture + review screen |
| `src/app/words/page.tsx` | Word list: edit, delete, add, search |
| `src/app/play/*` | The four games |
| `src/components/GameShell.tsx` | Round loading + results/feedback screen |
| `src/lib/leitner.ts`, `progress.ts`, `gamification.ts`, `check.ts` | Learning logic |
| `src/app/players/page.tsx`, `src/app/me/page.tsx` | Who's playing? / add player / edit profile and PIN |
| `src/app/api/picture/route.ts`, `src/lib/pictures.ts` | Picture planning (Claude) + drawing (GPT) + storage |
| `supabase/schema.sql`, `002_players.sql`, `003_pictures.sql`, `004_pictures_in_table.sql` | Database tables, player PIN functions, pictures, security policies |

## Setup (about 20 minutes)

1. **Supabase**: create a free project at supabase.com.
   - SQL Editor → paste `supabase/schema.sql` → Run, then the same with `supabase/002_players.sql` `supabase/003_pictures.sql` and `supabase/004_pictures_in_table.sql`.
   - Authentication → URL Configuration: set **Site URL** to your Vercel URL and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to Redirect URLs.
   - After you and she have each logged in once, turn off **Allow new users to sign up** (Authentication → Sign In / Providers).
2. **Anthropic**: console.anthropic.com → add a few dollars of credit → create an API key. Optionally set a monthly spend limit.
3. **OpenAI** (pictures): platform.openai.com → add a few dollars of credit → create an API key → `OPENAI_API_KEY`. OpenAI may ask you to verify your organization before its image models work.
4. **Local run**: `cp .env.example .env.local`, fill in the values, then `npm install && npm run dev` → http://localhost:3000
5. **Deploy**: push to GitHub → vercel.com → *Add New Project* → import the repo → add the env vars from `.env.example` → Deploy. Every `git push` redeploys.

## Forgotten PIN

In Supabase → SQL Editor, run this with the player's name and a new PIN (it also clears a lockout):

```sql
update public.player_pins set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
       failed_tries = 0, locked_until = null
 where player_id = (select id from public.players where name = 'Anna');
```

## Costs

Vercel Hobby and Supabase Free cost $0. Pictures: about 1¢ each with `gpt-image-1-mini` at medium quality (0.5¢ at low), made once per word, so a few dollars a year; `PICTURE_DAILY_LIMIT` caps new pictures per day. Claude: about 2–3¢ per photo on the default model, or under 0.1¢ with `ANTHROPIC_MODEL=claude-haiku-5-5`. Try Haiku on a few real pages and keep it if it reads her handwriting well. Note: Supabase pauses free projects after 7 days of no activity; you restore them with one click in the dashboard.

## Ideas for next steps

- Arcade "falling words" game, and a Hungarian→English multiple-choice quiz
- Lessons/units: tag each scan with a notebook page or date and practice one unit before a test
- Pronunciation check with the browser's speech recognition
- Parent view: weekly stats from the `rounds` table
