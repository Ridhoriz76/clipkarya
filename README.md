# ClipKarya AI

AI short-form video platform: auto-clip long videos, script-to-video, transcription and subtitles, AI voiceover/image/video, a multitrack editor, and **real MP4 export** rendered with FFmpeg. Bahasa Indonesia first, with the i18n structure ready for English. The product name is configurable via `NEXT_PUBLIC_APP_NAME`.

```
apps/web       Next.js 16 (App Router, TS strict, Tailwind v4, shadcn/ui-style components, Lucide)
apps/worker    Node worker: BullMQ consumers, FFmpeg/FFprobe pipeline, AI provider calls
packages/core  Shared logic: timeline model, subtitle/ASS builder, FFmpeg render plan,
               clip scoring, credits, provider adapters, templates
supabase/      SQL migrations (schema, functions, RLS, storage policies), seed, DB tests
```

**Personal mode (one password).** If you set `APP_PASSWORD` on the web app, the app works like this:
- There is no landing page, sign-up or email password reset.
- `/login` asks only for that password. The check is server-side, rate-limited to 10 tries per 15 minutes per IP, and uses a constant-time comparison.
- The first successful login creates one built-in owner account (`OWNER_EMAIL`, admin role). Its real Supabase password is derived from `APP_PASSWORD` and the service-role key, so it is never stored, and changing `APP_PASSWORD` changes it.
- Supabase Auth, RLS and secure session cookies still apply underneath.
- Any other Supabase user is rejected by the app and the API.
- In Supabase, also turn off **Authentication → Sign In / Providers → Allow new users to sign up**, so nobody can create accounts directly against the public API.

Leave `APP_PASSWORD` empty for normal multi-user accounts.

**Free mode (default).** With `NEXT_PUBLIC_FREE_MODE=true` (or unset), the app is completely free:
- There is no pricing section and no plans.
- Credits are not shown or charged, and every user can export at 1080p.
- To keep AI provider bills bounded, each user gets daily fair-use caps per feature (e.g. 5 AI videos and 30 exports per 24 hours), shown on the Penggunaan page.
- Per-minute rate limits and the provider usage log stay on.

Set `NEXT_PUBLIC_FREE_MODE=false` on both web and worker to switch plans and credits back on; the web app needs a redeploy because the value is inlined at build time.

**How a job flows:** the browser calls an API route → the route checks auth/ownership/plan and reserves credits in Postgres → it enqueues only the job id in Redis → the worker reads the authoritative job row, does the work, uploads results to Supabase Storage, and updates status/progress. The browser polls. Failed or canceled jobs refund their credits exactly once (enforced by a unique index).

---

## 1. Run locally

Requirements: Node ≥ 20.9, pnpm 10 (`corepack enable`), FFmpeg ≥ 6 with libx264 and libass, Redis, and a Supabase project (hosted, or local with the Supabase CLI).

```bash
pnpm install
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env      # same values; the worker ignores the web-only ones
docker compose up -d redis            # or any Redis at REDIS_URL
pnpm dev                              # web on :3000 + worker, in parallel
```

Without Supabase configured, the landing page works and `/app` shows a setup notice.

### Supabase setup

1. Create a project at supabase.com, then copy the URL, anon key and service-role key into the env files.
2. Apply the database, either way:
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push` (uses `supabase/migrations`), then run `supabase/seed.sql` in the SQL editor.
   - **SQL editor:** run the three files in `supabase/migrations/` in order, then `supabase/seed.sql`.
   This creates every table, RLS policy, the private `media` storage bucket and its policies, the credit functions, and the sign-up trigger (profile, Free plan, starting credits and an empty brand kit for each new user).
3. **Personal mode:** if you use `APP_PASSWORD`, disable new sign-ups in Supabase Auth. You can skip steps 4 and 5, because the owner account is created and made admin automatically.
4. **Auth → URL configuration:** set Site URL to your `APP_BASE_URL` and add `<APP_BASE_URL>/auth/callback` to the redirect URLs.
5. **Make yourself admin** (after signing up): `update public.profiles set role = 'admin' where email = 'you@example.com';`
6. Storage: uploads up to 2 GB need the project's global file-size limit raised (Storage → Settings). The free Supabase tier caps files at 50 MB.

### Database tests (no Supabase needed)

```bash
PGURL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
```
This applies the migrations to a throwaway database on vanilla Postgres and checks RLS isolation between users, that column-level grants block self-promotion to admin, credit spend/refund (including exactly-once refunds), and optimistic timeline saves.

---

## 2. AI providers and API keys

Keys are read **only on the server** (API routes and worker) and are never sent to the browser. Set them in **both** the web app and the worker: the web app uses them to show availability and list voices, and the worker uses them for generation.

| Capability | Providers (env) | Notes |
|---|---|---|
| Script / text, clip relevance | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Prompts ask for JSON and forbid invented statistics; listicle claims are flagged "needs verification". |
| Transcription (word timestamps) | `ELEVENLABS_API_KEY` (Scribe) or `OPENAI_API_KEY` (Whisper) | Feeds auto-clip, subtitles, SRT/VTT. |
| Voiceover | `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` | The voice list comes live from the provider. |
| Image | `OPENAI_API_KEY` (gpt-image-1) or `FAL_KEY` (FLUX) | |
| Video | `FAL_KEY` | Model id is configurable via `FAL_VIDEO_MODEL`. |

When several providers are configured, pick one with `TEXT_PROVIDER`, `TRANSCRIPTION_PROVIDER`, `SPEECH_PROVIDER` or `IMAGE_PROVIDER`. Model ids can be overridden with the `*_MODEL` variables listed in `.env.example`.

**No key means no fake output.** Unconfigured features show a "Perlu API key" badge, and a job that is started anyway fails with a clear message and refunds its credits.

**`DEMO_MODE=true`** lets you test the pipeline without keys. Only two capabilities get demo output, and both are labeled **DEMO** everywhere:
- Transcription returns a `[DEMO]` placeholder transcript.
- Voiceover returns a test tone.

Text, image and video generation are never simulated.

Admins can see each provider's status at `/app/admin`.

---

## 3. The worker

```bash
pnpm dev:worker                  # tsx watch, reads apps/worker/.env
pnpm --filter worker build && pnpm --filter worker start
```

**Queues**
- `ck-ai`: probe, transcription, clip analysis, voice, script, image and video jobs. Concurrency is set by `WORKER_AI_CONCURRENCY`.
- `ck-render`: MP4 export. Concurrency is set by `WORKER_RENDER_CONCURRENCY`; use 1 per vCPU pair.
- `ck-maintenance`: runs every 15 minutes. It cleans temp files, fails stuck jobs (with a refund), deletes abandoned uploads, and renews monthly credits.

**Rendering**
- The worker builds a single FFmpeg filter graph:
  - visuals: a canvas, then trim, crop, scale/pad, fades and timed overlays;
  - audio: an `amix` mix normalised with `loudnorm`;
  - subtitles: burned in from an ASS file, with word-by-word karaoke highlight.
- Output is H.264 high-profile yuv420p with AAC 48 kHz and `+faststart`.
- The worker checks the output dimensions before marking the render complete.
- It uploads the MP4, a thumbnail and (optionally) an SRT.
- The download button appears only after all of that succeeds.

Fonts offered in the caption editor (Inter, DejaVu Sans, Liberation Sans/Serif, Noto Sans) must be installed where the worker runs. The Docker image installs them.

---

## 4. Deploy

**Web → Vercel**
- Import the repo and set Root Directory to `apps/web`. Vercel detects pnpm workspaces.
- Add the env vars: Supabase, `REDIS_URL` (e.g. Upstash, `rediss://…`), provider keys, `APP_BASE_URL` and `NEXT_PUBLIC_APP_NAME`.
- Uploads go straight from the browser to Supabase Storage through signed URLs, so Vercel's body-size limits don't apply.

**Worker → Railway or Render (Docker)**
- Build context: the repo root. Dockerfile: `apps/worker/Dockerfile`.
- Local equivalent: `docker build -f apps/worker/Dockerfile -t clipkarya-worker .`
- Set the worker env vars. Give it at least 2 vCPU / 2 GB RAM for 1080p renders, plus ephemeral disk for `WORKER_TMP_DIR`.
- Use the same Redis as the web app. Redis needs `maxmemory-policy noeviction` (BullMQ requirement).
- `docker compose --profile worker up` runs it locally next to Redis.

---

## 5. Testing the workflow end to end

1. Sign up and confirm your email, or in personal mode just log in with `APP_PASSWORD`.
2. **Auto-clip** (needs a transcription key, or `DEMO_MODE`):
   - Create → Auto-clip → upload an MP4 (a 2–10 minute talk works best).
   - Watch it go through probe → transcription → analysis.
   - Review the clip candidates and their score breakdowns, then "Buat proyek" on one.
3. **Editor:**
   - Trim or split the clip, add a text item, and restyle the captions.
   - Undo/redo work, and the timeline autosaves.
4. **Export:**
   - Choose 9:16 and 720p, then follow the progress bar.
   - Download the MP4, and the SRT if you ticked it. The project page keeps an export history.
5. **Script to video** (needs a text key):
   - Topic → generated scenes → edit them.
   - Generate voice and images per scene, then "Rakit ke editor" → export.
6. **Transcriber:** upload → search the transcript → edit lines → download SRT/VTT.
7. **Limits:** in free mode, the Penggunaan page shows today's usage against each daily cap. With credits on (`NEXT_PUBLIC_FREE_MODE=false`), credits are deducted when a job starts, and cancelling a queued job shows the refund under Penggunaan & Kredit.

Automated checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Core tests: timeline ops, subtitles, clip scoring, render-plan args.
- Worker tests: real FFmpeg renders verified with ffprobe; they need ffmpeg on PATH.
- Web tests: API error handling and helpers.
- DB tests: run `scripts/test-db.sh` (see section 1).

---

## 6. Implemented vs. needs configuration

**Works out of the box (with Supabase + Redis + the worker)**
- Auth and accounts: sign up/in/out, password reset, protected routes, profile, settings, and dark/light theme.
- Uploads: signed direct uploads up to 2 GB and 3 hours, validated by type, size and plan, then probed by FFprobe.
- Projects and editor: projects CRUD/duplicate, and the multitrack editor (preview, timeline, trim/split/reorder/duplicate/delete, crop and fit, aspect ratio, volume/mute, music, text, fade transitions, caption styling, undo/redo, autosave).
- Layouts: split-screen and picture-in-picture.
- Export: real MP4 in 9:16, 16:9 or 1:1 at 720p or 1080p, with burned-in captions, optional SRT, progress, cancel and history.
- Transcript editing: search, edit, and SRT/VTT export once a transcript exists.
- Free mode (default) with daily fair-use caps; optional credit system (reserve and refund, history, plan limits) behind `NEXT_PUBLIC_FREE_MODE=false`. Usage logs and rate limits are always on.
- Content: templates (8 presets), brand kit (colors, fonts, caption preset applied to new projects, logo/intro/outro, default voice), help center, and the landing page with configurable pricing from the DB.
- Admin: provider status, job and queue monitor, plan editor, credit adjustments, and changing a user's plan.

**Needs API keys**: AI scripts, transcription, auto-clip analysis, voiceover, AI images and AI video (see section 2).

**Not done / limitations (honest list)**
- **Free mode is the default:** the items below about payments and credits only matter if you turn it off.
- **Payments:**
  - No payment gateway (e.g. Midtrans or Xendit) is connected.
  - Upgrades are manual: an admin changes the plan, and the usage page says so.
  - `subscription_plans.external_price_id` is ready for an integration.
- **Brand kit:**
  - The logo, intro/outro and default voice are stored but not yet auto-inserted into timelines or preselected in the voice picker.
  - Watermarking is not implemented (the plan flag exists).
- **Transitions:** only fade in/out per clip, no cross-dissolves between clips.
- **English UI:** the i18n dictionaries and the locale setting exist, and the navigation and dashboard are translated; the remaining pages are Indonesian only.
- **Workflow-only modes:** "Video story" and "Commentary" are editor workflows (upload + layout + narration) with no extra AI step.
- **Not run against live services in this build:**
  - The provider adapters follow each vendor's documented API, but no keys were available, so OpenAI, Anthropic, ElevenLabs and fal.ai were not called live.
  - The worker Docker image was not built, because no Docker daemon was available. The `pnpm deploy` bundle it uses was verified.
  - No full browser run against a real Supabase project was done. Schema and RLS were tested on Postgres, and rendering was tested with real FFmpeg.
- **Out of scope:** downloading videos from third-party links (YouTube/TikTok) is intentionally not supported. Users upload files they own.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `/app` shows "Konfigurasi diperlukan" | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing in `apps/web/.env.local`. |
| Jobs stay "Dalam antrean" | The worker isn't running, or the web app and worker use different `REDIS_URL`s. Check the queue panel in `/app/admin`. |
| Worker exits with "Invalid environment" | It prints the missing variable; usually `SUPABASE_SERVICE_ROLE_KEY`. |
| Upload fails with HTTP 413 | Raise the Supabase Storage file-size limit. |
| Export fails with "font" errors or captions look wrong | Install the caption fonts (or use the Docker image), or set `FONTS_DIR`. |
| Confirmation email links go to localhost | Set `APP_BASE_URL` and the Supabase Site URL / redirect URLs. |
| "Fitur … belum dikonfigurasi" | Add that provider's key to **both** web and worker env, then restart. |
| Redis errors "maxmemory-policy" | Set `noeviction`; Upstash's default is fine. |
