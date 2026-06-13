# POP FIVE 🎬🎵⭐📺

Five clues. One icon. A new pop culture mystery every day. Built with React + Vite, deployed on Vercel, with a shared leaderboard on Upstash Redis.

## Features

- **Daily puzzle**: picked deterministically from the date, so everyone gets the same mystery. Puzzle #1 = June 12, 2026.
- **Streaks**: win streak, best streak, and total points saved in the browser.
- **Shared leaderboard**: daily and all time rankings across everyone who plays on your link. First submission per name per day counts, so no retry sniping.
- **Sound effects**: synthesized with the Web Audio API, mutable, no audio files.
- **Share results**: Wordle style spoiler free emoji block with your link included.
- **Free play**: random practice puzzles after the daily is done.

## Deploy in about 10 minutes

You already know this flow from your betting agent repos.

### 1. Push to GitHub

```bash
cd pop-five
git init
git add .
git commit -m "POP FIVE v1"
gh repo create pop-five --public --source=. --push
```

(Or create the repo on github.com and push manually.)

### 2. Import to Vercel

1. Go to vercel.com and sign in with GitHub.
2. Click **Add New → Project** and import the `pop-five` repo.
3. Vercel auto detects Vite. Click **Deploy**. Done, the game is live.

At this point everything works except the leaderboard (streaks, sounds, daily puzzle, and sharing are all client side).

### 3. Add the leaderboard database (2 minutes)

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database → Upstash Redis** (free tier is plenty).
3. Accept the defaults and connect it to the project.
4. Redeploy (Deployments tab → ⋯ → Redeploy).

Vercel injects the Redis credentials as environment variables automatically. The API code checks both `UPSTASH_REDIS_REST_*` and `KV_REST_API_*` names, so either integration works.

### 4. Share the link

Send your Vercel URL (something like `pop-five.vercel.app`) to the group chat. Everyone picks a player name on first visit and their daily scores land on the shared leaderboard.

## Adding puzzles

Open `src/puzzles.js` and add entries to the array. Each puzzle needs:

```js
{ category: "Movie", answer: "Display Name", accept: ["display name", "nickname"], clues: [
  "Vaguest clue.", "...", "...", "...", "Most obvious clue." ]}
```

The daily rotation cycles through the bank automatically, jumping around so back to back days mix categories.

## Local development

```bash
npm install
npm run dev
```

Note: the leaderboard API only runs on Vercel (or via `vercel dev`). In plain `npm run dev` the leaderboard shows a "not connected" message, which is expected.

## How scoring works

| Solved on clue | Points |
|---|---|
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |
| Stumped | 0 |

Streak counts consecutive daily wins. Miss a day or get stumped and it resets.
