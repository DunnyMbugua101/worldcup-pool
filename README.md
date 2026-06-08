# ⚽ World Cup 2026 Prediction Pool

A tiny app for an office/friends pool. People sign in with a **name + password**,
predict match outcomes, picks **lock** at each round's deadline, and a
**leaderboard** tallies points. Match fixtures and results are pulled
automatically from football-data.org.

**Scoring**

| Stage | Points for a correct pick |
|---|---|
| Group stage | 1 |
| Round of 32 | 2 |
| Round of 16 | 4 |
| Quarter-finals | 6 |
| Semi-finals | 8 |
| Final | 10 |
| Third-place play-off | 0 (not scored) |

Plus **−3** for any round a player doesn't enter at all before it locks.
In the knockouts there's no draw — you pick which team advances.

**How the pieces fit:** your browser app (hosted free on GitHub Pages) reads and
writes to **Supabase** (your database + login). A small scheduled function inside
Supabase pulls results from football-data.org a few times a day and stores them.
The app never calls football-data.org directly, so your API key stays secret and
you never hit its rate limit.

---

## What you'll need (all free, all in the browser)
- A **GitHub** account
- A **Supabase** account (supabase.com)
- A **football-data.org** account (for the free API token)

You do **not** need to install Node, Git, or anything else — every step below is
done in a browser tab. (If you prefer working on your own machine, the optional
notes show the local commands too.)

> **Your computer never has to stay on.** Once set up, the live app is served by
> GitHub's servers and the data lives on Supabase's servers — both run 24/7 for
> free. You can close your laptop and the link keeps working for everyone.

---

## Step 1 — Create the Supabase project & database
1. Go to supabase.com, sign in, **New project**. Pick a name and a database
   password (save it somewhere). Wait ~2 min for it to provision.
2. Open **SQL Editor → New query**, paste the entire contents of `schema.sql`
   from this project, and click **Run**. This creates every table, the security
   rules, and the scoring logic.
3. Turn off email confirmation so name+password works instantly:
   **Authentication → Sign In / Providers → Email**, and switch **"Confirm email"
   OFF**. Save.
4. Grab your keys: **Project Settings → API**. Copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (this one is safe to put in the website)
   - **service_role** key (SECRET — only used by the sync function in Step 4)

---

## Step 2 — Get a football-data.org token
1. Register at football-data.org → you'll be emailed a free **API token**.
2. Keep it handy for Step 4. (Free plan covers the World Cup, ~10 calls/min —
   plenty, since we sync only a few times a day.)

---

## Step 3 — Get the app onto GitHub (in your browser, with Codespaces)
No installs — Codespaces is a free cloud computer you use through the browser.
1. On GitHub, click **New repository**. Name it `worldcup-pool`, make it
   **Public**, and tick **"Add a README file"** so it can open a Codespace.
   Create it.
   - ⚠️ If you name it something other than `worldcup-pool`, open `vite.config.js`
     later and change `base` to `"/your-repo-name/"`, or the page loads blank.
2. On the repo page: green **Code** button → **Codespaces** tab →
   **Create codespace on main.** A VS Code editor opens in your browser.
3. Add the project files: on your computer, unzip the download, then **drag
   everything from *inside* the `worldcup-pool` folder** (the files and the
   `src`, `.github`, `supabase` folders) into the Codespace's file list on the
   left. You should end up with `package.json`, `schema.sql`, `index.html`, and
   the folders sitting at the top level — not nested inside another folder.
4. In the terminal at the bottom of the Codespace, run:
   ```bash
   git add . && git commit -m "World Cup pool" && git push
   ```
   (Codespaces is already signed in to your repo, so this just works.)
5. *Optional preview:* run `npm install` then `npm run dev`. Codespaces pops up a
   private preview link for you to look at — handy while tweaking, but it's **not**
   the public link and isn't how you host. You can skip this entirely.

When you're done you can close/delete the Codespace; nothing depends on it.

> Prefer your own machine? Install Node + Git, then from the unzipped folder run
> the same `git` commands after `git remote add origin <your repo URL>`.

---

## Step 4 — Add your Supabase keys & turn on GitHub Pages
1. In the repo: **Settings → Secrets and variables → Actions → Variables tab →
   New repository variable.** Add two **Variables** (not secrets — the anon key
   is public by design):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow builds and publishes on every push (it runs `npm install`
   and the build *in the cloud* — your computer isn't involved). Watch it under
   the **Actions** tab. If it didn't run after you added the keys, click the
   latest run → **Re-run all jobs**. When it's green, your site is live at:
   ```
   https://YOUR_USERNAME.github.io/worldcup-pool/
   ```

---

## Step 5 — Deploy the results-sync function (Supabase dashboard, no CLI)
This little function runs on Supabase's servers and holds your secret token.
1. **Give it the football-data token:** **Project Settings → Edge Functions →
   Add new secret.** Name `FOOTBALL_DATA_KEY`, value = your football-data.org
   token. (Your Supabase URL and service key are supplied to it automatically.)
2. **Edge Functions → Deploy a new function → Via Editor.** Name it **exactly**
   `sync-fixtures`.
3. Clear the sample code, paste the entire contents of
   `supabase/functions/sync-fixtures/index.ts` from this project, then **Deploy**.
4. **Run it once:** open the function → **Test** / **Invoke** → send. You should
   get back a small `{ "rounds": …, "fixtures": … }` count. Check
   **Table Editor → fixtures** — the matches should be there.
5. **Schedule it:** on the function open **Schedules** (or **Integrations → Cron**)
   → new schedule with cron `0 */3 * * *` (every 3 hours). Now results and
   upcoming matches refresh on their own, forever.

> Prefer the CLI? Equivalent commands: `supabase login`,
> `supabase link --project-ref YOUR_REF`,
> `supabase secrets set FOOTBALL_DATA_KEY=…`,
> `supabase functions deploy sync-fixtures`.

---

## You're live 🎉
**Send the GitHub Pages link on WhatsApp.** Each person opens it, taps **Sign
up**, enters a name + password, and starts predicting. Your computer can be off.

---

## Running the pool
- **Make yourself admin (optional):** after you sign up, in **Table Editor →
  profiles**, set your `is_admin` to `true`.
- **Adjust lock times:** in **Table Editor → rounds**, each round's `lock_at`
  defaults to its earliest kickoff. Change it to set your own weekly deadline.
  Locking is enforced server-side, so nobody can sneak a late pick.
- **Manual result fix:** if the API is ever wrong or down, edit a row in
  **fixtures** — set `result` to `HOME_TEAM` / `DRAW` / `AWAY_TEAM` and `finished`
  to `true`. Scoring updates immediately.
- **Retune scoring:** edit the numbers in **stage_points** any time.

## One thing to verify on day one
The 2026 tournament has a brand-new **Round of 32**. This project assumes
football-data.org labels that stage `LAST_32`. Once real knockout fixtures load,
open **Table Editor → fixtures**, check the `stage` value on a Round-of-32 match,
and if it differs, just rename the matching row's `stage` in **stage_points** to
match. Everything else keys off that automatically.
