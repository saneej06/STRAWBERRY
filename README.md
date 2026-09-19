# STRAWBERRY

STRAWBERRY is a Vite + React expense tracker with self-hosted authentication, Supabase PostgreSQL data storage, debtor tracking, reports, and an authenticated AI assistant backed by OpenRouter.

## Current Release

- App version: `v0.5.0`
- Release notes: [RELEASE.md](./RELEASE.md)

## Stack

- Frontend: React 19, TypeScript, Vite
- Styling: Tailwind CSS v4
- Backend: a single Vercel Serverless Function (`api/[...slug].js`) dispatching the `server/` handlers, with Supabase PostgreSQL via `@supabase/supabase-js` (service-role key, server-side only)
- Auth: Self-hosted JWT auth with bcrypt password hashing
- AI: OpenRouter via `server/ai-assistant.js`
- Email (optional): Brevo for verification and password reset emails
- Deployment: Vercel

## Features

- Expense tracking with categories, history, and reporting
- Debtor tracking with partial and full payment flows
- Reporting dashboard with selectable date-range windows
- Calendar date drill-down with a details modal
- Authenticated AI assistant with live snapshot actions, assistant-scope prompts, and Tamil replies
- AI-generated debtor reminder drafts with optional user guidance
- Profile settings with curated DiceBear avatar libraries
- Recurring expenses and in-app notification support
- Secure headers configured in `vercel.json`

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier is enough)
- An OpenRouter API key

### Install

```bash
npm install
```

### Environment variables

Create `.env.local` from `.env.example` and set:

```env
# Database - Supabase (server-side only; never expose the service role key)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from Project Settings > API>

# JWT signing secret - REQUIRED
JWT_SECRET=your_long_random_secret

OPENROUTER_API_KEY=your_server_openrouter_api_key
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=verify@your-domain.com
EMAIL_VERIFICATION_SECRET=your_long_random_verification_secret
APP_URL=https://your-production-url.vercel.app
```

Notes:

- Before signing up, apply the schema once: open `supabase/migrations/0001_initial_schema.sql` in the Supabase Dashboard → SQL Editor (or run `supabase db push`). Tables are **not** auto-created at runtime; `ensureSchema()` in `server/supabase.js` verifies the tables exist and tells you which migration to run if they are missing.
- `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `BREVO_API_KEY`, and `EMAIL_VERIFICATION_SECRET` are server-side only. Do not prefix them with `VITE_`.
- `BREVO_FROM_EMAIL` must be a sender email validated in Brevo (Brevo Dashboard → Senders).
- Local development does not require email verification or a custom domain. Verification and password reset links are shown directly in the app UI in development mode.

### Start the app

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

## Build

```bash
npm run lint
npm run build
```

## Deployment

### Vercel

Set these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `OPENROUTER_API_KEY`
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `EMAIL_VERIFICATION_SECRET`
- `APP_URL`

### Database setup

Create a Supabase project and apply `supabase/migrations/0001_initial_schema.sql` once (SQL Editor or `supabase db push`). All API access goes through the service-role client in `server/supabase.js`, so no `VITE_` Supabase variables and no database access reach the browser.

### Google Login (optional)

Create an OAuth 2.0 Client ID at the Google Cloud Console and set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Authorized redirect URI must be `https://<your-domain>/api/auth-google/callback`. Until these are configured, the Google button shows a clear "not configured" message instead of a fake flow.

## Security Notes

- Passwords are hashed with bcrypt (12 rounds).
- Sessions use signed JWT tokens verified on every API request.
- The AI endpoint validates request size and sanitizes client-provided summary context.
- All database access happens server-side through the Supabase service-role client (`server/supabase.js`); the service-role key is never exposed to the browser.
- Secrets are only read on the server; no `VITE_` variables hold secrets.
- Security headers are configured in `vercel.json`.
- The AI rate limiter is in-memory, so it is best-effort on Vercel rather than globally shared.

## Project Structure

```text
strawberry/
|-- api/
|   `-- [...slug].js      (single Vercel Serverless entrypoint, dispatches /api/*)
|-- server/
|   |-- ai-assistant.js
|   |-- auth.js
|   |-- auth-google*.js
|   |-- user.js
|   |-- data.js
|   |-- password-reset.js
|   |-- email.js
|   |-- db.js
|   |-- supabase.js       (server-side Supabase client)
|   `-- jwt.js
|-- supabase/
|   `-- migrations/0001_initial_schema.sql
|-- src/
|   |-- components/
|   |-- context/
|   |-- pages/
|   `-- services/
|-- vercel.json
`-- vite.config.ts
```

## Useful Commands

- `npm run dev` - start local development
- `npm run lint` - run TypeScript checks
- `npm run build` - create the production build
- `npm run preview` - preview the built app

## Support

- Repository: `https://github.com/ryf-me/SPENDORA`
- Contact: `mohammedsaneej44@gmail.com`