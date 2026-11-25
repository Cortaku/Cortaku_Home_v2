# Cortaku Homepage (www.cortaku.com)

A highly customized, self-hosted personal dashboard built with modern web technologies. Designed to serve as a beautiful landing page for homelab services, complete with interactive UI elements, Easter eggs, and a hidden mini-game.

## ✨ Features

* **The hero is the game's attract mode:** parallax pixel scenes, drifting petals and the robot mascot, with a Play button (or Space) that morphs into the game.
* **Jump game:** one button, variable jump height, four scenes, each in day and night, that change as you climb through zones, and a pause menu. Plays with keyboard, mouse or touch; a phone held upright gets the game turned sideways.
* **Daily run:** the same course for every player each UTC day, with its own leaderboard.
* **Robot skins:** recolours unlocked by best score, worn in the game and on the homepage.
* **Global leaderboard:** all-time and daily boards in Supabase, with validation and per-IP rate limiting enforced by the database.
* **App launcher:** links to the self-hosted services with live up/down dots, plus a Ctrl+K quick search.
* **Easter eggs:** toggle the theme five times, or enter the Konami code.
* **Containerized:** Docker and Docker Compose configs included.

## 🚀 Tech Stack

* **Framework:** Next.js 16 (App Router, React 19, React Compiler)
* **Styling:** Tailwind CSS v4 plus plain CSS
* **Leaderboard:** Supabase (Postgres with row-level security, called straight from the browser)
* **Tests:** Vitest (`npm test`)
* **Deployment:** Docker & Docker Compose

## 🧩 How the game is put together

| File | Job |
| --- | --- |
| `src/game/sim.ts` | The rules: physics, obstacle courses, scoring, hitboxes. Deterministic and free of browser APIs, so it is unit-tested in `sim.test.ts`. |
| `src/game/engine.ts` | Runs the rules at a fixed 120 Hz and draws them, with interpolation, scene crossfades and effects. |
| `src/game/assets.ts`, `skins.ts`, `audio.ts`, `profile.ts` | Images and scenes, skin recolouring, sound, and what the browser remembers about the player. |
| `src/components/JumpGame.tsx` | The React shell: menus, HUD, input, score entry. |

Add `?hitbox` to the URL to draw the collision boxes.

### Scenes

The game and the homepage share four parallax scene sets in `public/game-assets/Backgrounds/<set>/<day|night>/1-5.png` (576x324; layer 1 is the sky, layers 2-5 are transparent and tile sideways): 1 Mount Fuji, 2 a neon city, 3 a railway at sunset, 4 a Kyoto bamboo forest. All four are drawn by `tools/scenes/tokyo.lua`, an Aseprite script: set the global `SCENE_OUT_DIR` to the Backgrounds folder and run it to regenerate or extend them. To add a set, add the ten images and raise `SCENE_COUNT` in `src/lib/site.ts`. The homepage and each run open on Mount Fuji; every new zone moves to the next set and flips between day and night.

## 🛠️ Getting Started

### Run it locally

```bash
git clone https://github.com/Cortaku/Cortaku-Homepage.git
cd Cortaku-Homepage
npm install
npm run dev
```

The site is at http://localhost:3000. There is nothing to configure: no database connection string and no `.env` file.

### Run it with Docker

```bash
docker build -t cortaku-site .
docker-compose up -d
```

### The leaderboard

Scores live in one Supabase table, `cortaku_high_scores`, which the browser reads and writes directly, so the leaderboard does not depend on this site's server being up. The table, its access rules and its rate limit are defined in `supabase/migrations/`. The project URL and publishable key are in `src/lib/site.ts`; both are safe to publish.

To use a different Supabase project, run the migration there and change those two values.

## 📝 License
This project is open-source and available for personal use and modification.
