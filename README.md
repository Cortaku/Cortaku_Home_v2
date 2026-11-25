# Cortaku Homepage

Technical specification for [www.cortaku.com](https://www.cortaku.com): a personal homepage built around a browser jump game with a global leaderboard, plus a launcher for a self-hosted homelab.

## 1. Overview

The site is a single page with four parts:

| Part | What it is |
| --- | --- |
| Hero | The game's attract mode: a parallax pixel scene, drifting petals and the robot mascot. Play (or Space) morphs the scene into the game. |
| Arcade | Leaderboard (all-time and today's daily run), controls, and the robot skin picker. |
| Home base | Links to six self-hosted apps, each with a live up/down indicator. |
| Elsewhere | YouTube, Letterboxd, Instagram and email. |

A header carries section links, a quick search (Ctrl/Cmd+K) and a day/night toggle.

## 2. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16, App Router, standalone output |
| UI | React 19 with the React Compiler enabled |
| Language | TypeScript 6 |
| Styling | Tailwind CSS v4 for utilities; component styles in plain CSS (`src/app/globals.css`) |
| Fonts | Bricolage Grotesque (text) and Pixelify Sans (arcade), via `next/font` |
| Icons | lucide-react |
| Theming | next-themes, class-based, follows the system setting |
| Game | Canvas 2D and Web Audio; no game library |
| Leaderboard | Supabase (Postgres with row-level security), called from the browser over REST |
| Tests | Vitest |
| Hosting | Docker (Node 22 Alpine, multi-stage) |

There is no `.env` file and no server-side secret. The only runtime dependencies are `next`, `react`, `react-dom`, `next-themes`, `lucide-react` and Tailwind.

## 3. Architecture

### 3.1 Rendering

`src/app/page.tsx` is a server component and the page is prerendered as static HTML. Interactive parts are client components mounted into it. The one server route is `/api/status`.

### 3.2 Layout of the source

```
src/
  app/
    layout.tsx            fonts, metadata, viewport
    page.tsx              the page
    providers.tsx         theme + arcade providers
    globals.css           design tokens and all component styles
    icon.svg              favicon (the robot)
    opengraph-image.tsx   share card, generated at build time
    api/status/route.ts   up/down check for the app launcher
  components/
    ArcadeProvider.tsx    game open/close, scene, scores, easter eggs
    Hero.tsx              parallax scene, title, Play button
    Petals.tsx            petal canvas
    Mascot.tsx            the robot on the homepage
    JumpGame.tsx          game shell: menus, HUD, input, score entry
    ScoreBoard.tsx        two-tab leaderboard (used on the page and in the game)
    Leaderboard.tsx       homepage wrapper for ScoreBoard
    SkinPicker.tsx        skin selection (used on the page and in the game)
    AppLauncher.tsx       app tiles with status dots
    CommandPalette.tsx    Ctrl/Cmd+K quick search
    EmailCard.tsx         email link that also copies the address
    ThemeToggle.tsx, Logo.tsx
  game/
    sim.ts                rules (see 4.1)
    sim.test.ts           tests for the rules
    engine.ts             fixed-step loop and renderer (see 4.2)
    assets.ts             image loading, scenes, obstacle sprites
    skins.ts              skin definitions and recolouring
    audio.ts              sound
    profile.ts            per-browser player data
  lib/
    site.ts               all site content and configuration
    scores.ts             leaderboard client
  instrumentation.ts      leaderboard keep-alive (see 5.4)
supabase/migrations/      leaderboard schema and access rules
tools/scenes/tokyo.lua    Aseprite script that draws the scenes
public/game-assets/       scene layers, robot sprite sheet, sounds
```

### 3.3 Configuration

Everything that names a URL, a link or a count lives in `src/lib/site.ts`: the site URL, Supabase URL and key, the app list, social links, email address, `SCENE_COUNT` and `DEFAULT_SCENE`.

## 4. The game

A one-button endless runner. The robot runs; the player jumps obstacles; speed rises over time.

### 4.1 Rules (`src/game/sim.ts`)

The rules are a single class, `Sim`, with no browser APIs. Given the same seed and the same inputs on the same ticks it always produces the same run. That property makes the daily run fair and lets the rules be unit-tested.

| Parameter | Value |
| --- | --- |
| Playfield | 800 × 450 game px; ground at y = 350 |
| Tick | 1/120 s, fixed |
| Gravity / jump velocity | 3600 px/s² / 900 px/s (apex about 112 px, 0.5 s in the air) |
| Variable jump | Releasing early cuts upward speed to 45 %, after a minimum 0.08 s rise |
| Input buffer | A press up to 0.11 s before landing still jumps |
| Speed | 300 px/s, +21 px/s per second to 720, then +6 px/s per second to a cap of 1080 |
| Score | 10 points per second × (speed / 300)^1.5 |
| Zones | Zone *n* begins at 150 · n · (n + 1) points: 300, 900, 1800, 3000, … |

**Obstacles.** Three sizes (26 × 24, 36 × 33, 48 × 44) arranged in nine group patterns, from a single small one to a row of three. Patterns unlock with difficulty, and a pattern is only eligible if a short hop can clear it at the current speed. Groups are spaced by distance, 0.62 s apart at minimum. Obstacles come from a fixed pool of 24, so play allocates nothing.

**Hitboxes.** The robot is two boxes (head, then narrower legs). Each obstacle is three stacked bands that follow its pile shape. Append `?hitbox` to the URL to draw them.

**Seeds.** An endless run uses a random seed. The daily run uses a hash of the UTC date, so every player gets the same course until midnight UTC.

### 4.2 Engine (`src/game/engine.ts`)

- Advances `Sim` in fixed 1/120 s steps from an accumulator and interpolates positions when drawing, so the game behaves identically at any refresh rate.
- Renders to a Canvas 2D context at the device's pixel ratio (capped at 2× and 1920 px wide), with coordinates snapped to whole screen pixels.
- Draws five parallax layers per scene at 0, 0.05, 0.15, 0.3 and 0.5 of ground speed.
- Handles presentation only: squash and stretch, dust, the death tumble, screen shake, and a 1.4 s crossfade between scenes.
- Pauses automatically when the tab is hidden or loses focus.

### 4.3 Scenes

Four scene sets, each with a day and a night version, shared by the game and the homepage hero:

1. Mount Fuji, with a pagoda, torii gate and cherry trees
2. A neon city, with Tokyo Tower and the Skytree
3. A railway viaduct at sunset
4. A Kyoto bamboo forest

The homepage and every run open on scene 1. Each new zone moves to the next set and flips between day and night.

**Format.** `public/game-assets/Backgrounds/<set>/<day|night>/1.png` to `5.png`, each 576 × 324. Layer 1 is an opaque sky; layers 2 to 5 are transparent and tile horizontally.

**Source.** All four are drawn by `tools/scenes/tokyo.lua`, a script run inside Aseprite. It builds each layer from shape functions and a seeded random generator, and draws day and night from the same layout with different palettes. To regenerate, set the global `SCENE_OUT_DIR` to the `Backgrounds` folder and run the script. To add a scene, add a scene function to the script and raise `SCENE_COUNT`.

### 4.4 Obstacle art

Obstacles are the 💩 emoji in whatever font the visitor's device provides. Because the glyph differs by platform, `assets.ts` renders it once per size, crops it to its visible pixels and fits it to the hitbox size, so the drawing always matches what can be hit.

### 4.5 Skins

Six recolours of the robot sprite sheet, unlocked by the player's best score in any mode:

| Skin | Unlocks at |
| --- | --- |
| Classic | 0 |
| Sakura | 300 |
| Mint | 800 |
| Sunset | 1,800 |
| Midnight | 3,500 |
| Gold | 10,000 |

`skins.ts` recolours the sheet in the browser, keeping the original outlines and shading. The chosen skin is worn in the game and by the homepage mascot.

### 4.6 Controls and layout

| Input | Action |
| --- | --- |
| Space, ↑, W, click or tap | Start, jump (hold for height), resume, retry |
| P | Pause |
| M | Mute |
| Esc | Close a dialog, or exit the game |

The game screen is the largest 16:9 box that fits, sized entirely in CSS with container units. On a handheld held upright the stage is rotated 90° to fill the screen; name entry and the leaderboard stay upright. The whole screen, letterbox bars included, is the jump button. Safe-area insets keep the game clear of notches.

### 4.7 Sound

Jump and death effects play through Web Audio for low latency; a zone chime is synthesised; the soundtrack streams through an `<audio>` element. Audio unlocks on the first key press or completed touch.

### 4.8 Player data

Stored in `localStorage` under `cortaku.profile`: best endless score, best score ever, today's daily best and its date, chosen skin, mute setting and last leaderboard name. The legacy `highScore` key from the original game is still read and written.

## 5. Leaderboard

### 5.1 Design

Scores live in one Supabase table, `cortaku_high_scores`. The browser reads and writes it directly through Supabase's REST API with the project's publishable key (`src/lib/scores.ts`). The site's own server is not involved, so the leaderboard stays available when the site's host is down.

### 5.2 Schema

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity | primary key |
| `player_name` | text | 1 to 15 characters |
| `score` | integer | 0 to 1,000,000 |
| `challenge_date` | date | null for an endless run; the UTC date for a daily run |
| `ip_address` | text | set by trigger; not readable by clients |
| `created_at` | timestamptz | set by trigger |

### 5.3 Access rules

All enforced in the database (`supabase/migrations/`):

- Row-level security is on. Anonymous clients may select `id`, `player_name`, `score` and `challenge_date`, and insert `player_name`, `score` and `challenge_date`. Nothing else: no updates, no deletes, no access to `ip_address`.
- A daily score is accepted only for today's or yesterday's UTC date.
- A `before insert` trigger trims the name, records the caller's address from the request headers, and rejects more than five posts a minute from one address.

Scores are submitted by the client and are not verified against a replay, so the board is not cheat-proof.

### 5.4 Keep-alive

Supabase pauses free-plan projects that see little activity for about a week. `src/instrumentation.ts` reads the leaderboard when the server starts and every 12 hours after, which keeps the project active while the site is running.

### 5.5 Other tables

The same Supabase project holds an unrelated Mealie database. The second migration enables row-level security on those tables with no policies, which closes them to the publishable key.

## 6. Homepage features

- **Hero.** The five scene layers scroll at different speeds with CSS animations and lean toward the pointer. A button steps through the scenes.
- **Petals.** One canvas of pixel petals that drift on a breeze following the pointer; a click or tap throws a burst. It stops when off-screen or while the game is open.
- **Mascot.** The robot runs in place, hops when clicked, and speaks up after seven seconds of inactivity.
- **Game launch.** Opening and closing the game uses the View Transitions API to morph between the hero scene and the game. The game code is loaded on demand.
- **App launcher.** `/api/status` sends a `HEAD` request to each app with a 4 s timeout and caches the result for 60 s. Any response below 500 counts as up, since a login redirect still means the app is running.
- **Quick search.** Ctrl/Cmd+K opens a `<dialog>` listing the game, every app and link, the theme toggle and the scene switch, with arrow-key navigation.
- **Email.** The email card opens a pre-addressed message and also copies the address, because a `mailto:` link does nothing on a machine with no mail app.
- **Share card.** `opengraph-image.tsx` generates the social preview image at build time.
- **Easter eggs.** Toggling the theme five times, or entering the Konami code, triggers a short rainbow party.
- **Accessibility.** All motion (parallax, petals, mascot, transitions) is disabled under `prefers-reduced-motion`. Controls are keyboard reachable and labelled.

## 7. Build and run

### Local development

```bash
git clone https://github.com/Cortaku/Cortaku_Home_v2.git
cd Cortaku_Home_v2
npm install
npm run dev
```

The site is served at http://localhost:3000. No configuration is needed.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

### Docker

```bash
docker build -t cortaku-site .
docker-compose up -d
```

The image is a two-stage Node 22 Alpine build that runs Next's standalone server on port 3000. `docker-compose.yml` attaches the container to an existing external network named `containers_cortaku`.

### Pointing at a different Supabase project

Run `supabase/migrations/20261124000000_create_cortaku_high_scores.sql` in the new project, then change `SUPABASE_URL` and `SUPABASE_KEY` in `src/lib/site.ts`.

## 8. Tests

`src/game/sim.test.ts` covers the rules:

- the speed curve and zone thresholds
- jump height, the short hop, and the input buffer
- identical output for identical seeds, and different output for different seeds
- a robot that never jumps dies
- every course is beatable: a scripted player survives three minutes on 150 different courses

The engine, UI and leaderboard client have no automated tests.

## 9. License

This project is open source and available for personal use and modification.
