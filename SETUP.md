# Setup — coding on another machine (Windows)

This project lives on GitHub and auto-deploys to Vercel
(<https://task-dashboard-ap2tone.vercel.app>). To work on it from another
Windows PC, you only need Git, Node.js, and a clone of the repo.

## 1. Install Git and Node.js

Run in PowerShell (skip either if already installed):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
```

Close and reopen PowerShell so the new commands land on your PATH, then verify:

```powershell
git --version
node --version
```

## 2. Clone the repo

```powershell
cd $HOME
git clone https://github.com/APurg21/Task-Dashboard.git
cd Task-Dashboard
npm install
```

## 3. Set your Git identity (once per machine)

```powershell
git config --global user.name "Alex Purgason"
git config --global user.email "purgasonalexp@gmail.com"
```

The first `git push` opens a browser sign-in to GitHub.

## 4. (Optional) Run the app locally with the database

Only needed if you want `npm run dev` to fully work locally, including the API
and Redis. Pull the secrets straight from Vercel instead of copy-pasting:

```powershell
npx vercel link              # sign in, pick the Task-Dashboard project
npx vercel env pull .env.local
```

This writes `REDIS_URL` (and any other env vars) into `.env.local`, which is
git-ignored. Without it the UI still loads, but local API calls to the database
will error — fine if you just edit code and rely on the deployed site.

Start the dev server:

```powershell
npm run dev
```

## Daily workflow

- `git pull` before you start (gets changes from the other machine).
- `git push` when done — Vercel auto-deploys whatever lands on `main`.

## Tip: launch Claude Code from inside this folder

Always `cd` into `Task-Dashboard` before starting Claude Code, rather than
running it from your home directory. Launching from the home directory makes
file searches scan the entire drive, which is slow and memory-heavy.
