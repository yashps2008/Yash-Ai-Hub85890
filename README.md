# Yash AI Hub

Full-stack Next.js app: AI chat (Anthropic API), Supabase auth + Postgres, Instagram OAuth, and comment-triggered DM automation via Meta's official Instagram API.

**Status: source code only. It has not been compiled or run by its author. Run the build yourself (step 4) and fix any errors before deploying.**

## Features
Dashboard with real DB stats - streaming AI chat with saved conversations - Instagram OAuth connect/disconnect/reconnect - automation builder (keyword, match method, message, enable/disable, history) - signed webhook receiver with idempotent, DB-backed processing - activity log - health endpoint.

## Stack
Next.js 15 (App Router), React 19, TypeScript, Supabase (Auth + Postgres + RLS), Anthropic Messages API, Instagram API with Instagram Login, Vercel (+ Vercel Cron).

## Folder structure
```
supabase/migrations/001_init.sql   database schema + RLS
src/app/(app)/                     dashboard, chat, automations, logs, settings
src/app/login/                     sign in / sign up
src/app/api/                       chat, conversations, automations, instagram, webhooks, jobs, health
src/components/                    client components
src/lib/                           supabase clients, crypto, webhook processing, token refresh
src/middleware.ts                  session refresh + page protection
```

## 1. Local install
Requires Node 20+.
```
npm install
cp .env.example .env.local     # then fill the values (see below)
npm run dev                    # http://localhost:3000
```
Commands: `npm run dev`, `npm run build`, `npm start`.

## 2. Supabase (database + auth)
1. Create a project at supabase.com.
2. SQL Editor -> paste and run `supabase/migrations/001_init.sql`.
3. Settings -> API: copy the Project URL to `NEXT_PUBLIC_SUPABASE_URL`, the anon key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service_role key to `SUPABASE_SERVICE_ROLE_KEY` (server only, never public).
4. Authentication -> Providers: Email is enabled by default. Under URL Configuration set Site URL to your app URL.

## 3. Environment variables
| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_APP_URL | Public base URL, no trailing slash (https required for Instagram) |
| NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY | Supabase public config |
| SUPABASE_SERVICE_ROLE_KEY | Server-only DB access for webhooks and logs |
| TOKEN_ENCRYPTION_KEY | `openssl rand -base64 32`; encrypts Instagram tokens at rest. Changing it invalidates stored tokens |
| INSTAGRAM_APP_ID / _APP_SECRET | From the Meta app's Instagram product (the Instagram app ID, not the Facebook app ID) |
| INSTAGRAM_WEBHOOK_VERIFY_TOKEN | Any random string; paste the same one into Meta |
| CRON_SECRET | Random string; Vercel Cron sends it as a Bearer token |
| ANTHROPIC_API_KEY, AI_MODEL | AI provider key and the model id from Anthropic's docs |

Only `NEXT_PUBLIC_*` values reach the browser. Never commit `.env.local`.

## 4. Verify the build
```
npm install && npm run build
```
Fix any errors reported. Then open `/api/health` to see which variables are missing.

## 5. AI setup
Create a key in the Anthropic Console, set `ANTHROPIC_API_KEY` and `AI_MODEL`. Until both are set, chat shows "setup required".

## 6. Meta / Instagram setup
Check Meta's current official docs ("Instagram API with Instagram Login"); names and versions change. The code assumes Graph API v23.0.
1. developers.facebook.com -> create an app (Business type) -> add the **Instagram** product -> "API setup with Instagram login".
2. Copy the Instagram app ID and secret into the env vars.
3. Add the OAuth redirect URI: `https://YOUR_DOMAIN/api/instagram/callback`.
4. Permissions requested: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
5. Webhooks: callback URL `https://YOUR_DOMAIN/api/webhooks/instagram`, verify token = your `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`; subscribe to **comments**. Also subscribe your Instagram account to the app's webhooks.
6. The Instagram account must be a Business or Creator (professional) account.
7. Development mode: only accounts with a role on the app (add as Instagram testers) can connect. Serving other accounts requires **App Review / Advanced Access** for the permissions above, plus Business Verification where Meta requires it.

## 7. Messaging rules (important)
The app sends a *private reply* to the comment (recipient = `comment_id`). Meta limits this to one private reply per comment, within a limited window after the comment, and subject to rate limits and its platform policies. Failures are recorded truthfully; a DM is marked "sent" only when the API returns a message id. Network errors are marked "unknown" and never retried, to avoid double sends.

## 8. Deploy
GitHub:
```
git init && git add . && git commit -m "Yash AI Hub"
git remote add origin https://github.com/YOU/yash-ai-hub.git && git push -u origin main
```
Vercel: Add New Project -> import the repo -> add every env variable from the table -> Deploy. Then set `NEXT_PUBLIC_APP_URL` to the final URL, redeploy, and update the Meta redirect URI and webhook URL.

Background processing: each webhook is stored in the database and processed right after the response; `vercel.json` also runs `/api/jobs/process` once a day (the Hobby plan limit) to retry pending events and refresh tokens. Use Vercel Pro or an external pinger (with the `Authorization: Bearer CRON_SECRET` header) for more frequent recovery.

## 9. Known limitations
- Not yet build-tested or run end-to-end by the author.
- Chat replies render as plain text (no Markdown/code highlighting).
- No rate limiting on the app's own API routes yet.
- No theme switch; email/password auth only.
- Only comment-triggered private replies are supported. No other Instagram messaging.
- Instagram endpoints and scopes were written from memory of the docs; verify them.
- No automated tests.
