# Touchline — eFootball League Manager

A React + TypeScript + Vite application for an eFootball league. The first build includes public league pages, Supabase-backed data services, standings and round-robin logic, protected admin routing, team CRUD, fixture management foundations, and SQL migrations with RLS.

## Requirements

- Node.js 20 or later
- npm
- A Supabase project for persistent data

## Run locally

1. Extract the project and open its folder in a terminal.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable/anon key.
4. In Supabase SQL Editor, run `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_security_and_views.sql` in order.
5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local URL printed by Vite.

If Supabase environment variables are missing, the application displays a configuration notice instead of pretending that data was saved. With a configured but empty database, public pages show empty states. It does not silently substitute sample records.

## First administrator

1. In Supabase Authentication, create a user through **Authentication → Users → Add user** (or enable sign-up temporarily and register).
2. Copy that user's UUID.
3. In SQL Editor, run:

   ```sql
   insert into public.profiles (id, display_name, role)
   values ('598bb816-a30a-4ae5-a988-d9c552b0a035', 'League Admin', 'admin')
   on conflict (id) do update set role = 'admin';
   ```

4. Sign in at `/admin/login`.

Do not put a service-role key in this app. The browser should only use the publishable/anon key; RLS protects the database.

## Tests and build

```bash
npm test
npm run build
```

Tests cover round-robin generation and standings calculations. A successful local build does not prove Supabase policies are configured correctly; test the administrator and public flows against your own Supabase project before launch.

## Deploy to Vercel

1. Push the project to a Git repository.
2. Import the repository into Vercel.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables.
4. Deploy. The included `vercel.json` rewrites SPA routes to `index.html`, so direct navigation to `/admin` works.
5. Verify sign-in, team creation, public standings, fixture updates, and RLS behaviour on the deployed site.

## Current scope / limitations

Implemented: responsive public overview, standings, fixtures, teams and team detail routes; Supabase configuration handling; Supabase Auth admin login; protected admin layout; team create/edit/delete flow; fixture creation/status editing/result entry; season listing/creation/activation foundations; fixture generator and standings logic; schema, views and RLS; unit tests.

Still worth adding before a real competition launch: full end-to-end browser tests, robust audit-log UI, logo upload progress/replacement UI, season archival UX, and a transactional fixture replacement RPC with a preview/confirmation workflow. Fixture generation is previewed in the admin UI and saves new fixtures without deleting existing ones. Destructive team deletion is blocked when fixtures reference the team.
