# 8DCHONGS — beginner starter

This is a working React + TypeScript + Vite starter with Supabase email/password authentication, a public song catalogue, favorites, and an admin-only upload screen. It is a prototype, not a finished commercial streaming service.

## 0. What you need
- A Windows laptop with a current Node.js LTS release installed: https://nodejs.org/
- A free Supabase account: https://supabase.com/
- A GitHub account: https://github.com/
- A Cloudflare account: https://pages.cloudflare.com/

## 1. Run the website on your laptop
1. Extract the ZIP to a folder such as `C:\Users\YOURNAME\Desktop\8dchongs`.
2. Open that folder in VS Code (https://code.visualstudio.com/).
3. In VS Code, choose Terminal > New Terminal.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL printed in the terminal, normally `http://localhost:5173`.
6. Without Supabase settings, the website shows a preview only. Real sign-in, catalogue and uploads require steps below.

## 2. Create Supabase project
1. Open https://supabase.com/ and create a new project on a plan that fits the free-tier limits.
2. Wait for the database to finish provisioning.
3. Open SQL Editor in the Supabase dashboard.
4. Open `supabase-setup.sql` from this project, copy all of it, paste into SQL Editor, and run it.
5. Open Project Settings / API (or Connect) and copy the Project URL and publishable key. Use the publishable key (older projects may call it the anon key). NEVER use a service-role or secret key in frontend code.

## 3. Add environment variables
1. In the project root, copy `.env.example` to a new file named `.env.local`.
2. Put your real values in `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

3. Save the file and restart the dev server (Ctrl+C, then `npm run dev`).

Do not upload `.env.local` to GitHub. `.gitignore` already excludes it.

## 4. Create your first account and make it admin
1. Open your local website and choose Sign in > Create account.
2. Sign up with your email and a strong, unique password.
3. If email confirmation is enabled, confirm the email first.
4. In Supabase Dashboard > Authentication > Users, find your account and copy its UUID.
5. In SQL Editor run this statement after replacing the placeholder with your UUID:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'PASTE_YOUR_USER_UUID_HERE';
   ```

6. Sign out and sign back in (or refresh after signing in). The Admin panel should appear.

Security: the role change is performed only from the trusted Supabase dashboard. The profile policy prevents users from promoting themselves. Do not create a public “make me admin” button.

## 5. Test upload and playback
1. Only use audio you created, own, or have explicit permission to stream and distribute.
2. Sign in as the admin account.
3. Open Admin panel, enter title/artist/genre, select an audio file (max 25 MB), optionally add a cover image (max 5 MB), then upload.
4. Published tracks should appear in the catalogue and play from the bottom player.
5. Create a second regular account and confirm it cannot see the Admin panel or upload/delete songs.

The audio bucket is public so visitors can play published tracks without signing in. That means anyone with the public audio URL may be able to access those files. Do not upload private or unlicensed files. A commercial service may need a different delivery and rights strategy.

## 6. Build before deploying
In the terminal:

```bash
npm run build
```

A successful Vite build creates a `dist` folder. Fix any build errors before publishing.

## 7. Deploy to Cloudflare Pages with GitHub
1. Create a GitHub repository named `8dchongs` at https://github.com/new.
2. In VS Code terminal, from the project folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial 8DCHONGS website"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/8dchongs.git
   git push -u origin main
   ```

   If Git asks you to identify yourself, set your name/email with `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`. If Git is not installed, install it from https://git-scm.com/ and restart VS Code.

3. Open Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git.
4. Select the `8dchongs` repository.
5. Choose Vite / React if offered. Set:
   - Build command: `npm run build`
   - Build output directory: `dist`
6. Add these environment variables in the Pages project settings for Production (and Preview if needed):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. Save and deploy. Open the `.pages.dev` URL from the dashboard.

If you already deployed before adding variables, trigger a new deployment after saving them.

## 8. Important next improvements before a real public launch
- Add password reset and email verification UX.
- Add rate limits, moderation, upload audit logs, abuse reporting, and account deletion.
- Add robust playlists UI (tables are prepared but playlist creation UI is not implemented yet).
- Add proper cover-image storage cleanup when deleting a song.
- Consider private storage with signed URLs, CDN/audio bandwidth planning, and legal music licences at scale.
- Test every Row Level Security policy and backup data.
- Review the licensing terms for every audio file. “Free download” does not automatically mean permission to rehost or stream.

## Troubleshooting
- `npm` not recognized: install Node.js LTS and restart VS Code.
- Sign-up works but no profile row: check SQL script ran fully and inspect Supabase Logs.
- Admin panel missing: confirm the UUID in `profiles`, sign out, and sign back in.
- Upload denied: verify SQL policies ran, account role is `admin`, and file is within size/type limits.
- No sound: ensure a real authorized audio file uploaded, browser volume is up, and the file format is supported by the browser.
- Deploy build fails: run `npm run build` locally and inspect the first TypeScript error.

Official docs:
- Supabase React setup: https://supabase.com/docs/guides/getting-started/tutorials/with-react
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage security: https://supabase.com/docs/guides/storage/security/access-control
- Cloudflare Pages build settings: https://developers.cloudflare.com/pages/configuration/build-configuration/
