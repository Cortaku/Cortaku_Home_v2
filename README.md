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

A header carries section links and a paper lantern on a pull cord that switches day and night.

## 2. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16, App Router, static export |
| UI | React 19 with the React Compiler enabled |
| Language | TypeScript 6 |
| Styling | Tailwind CSS v4 for utilities; component styles in plain CSS (`src/app/globals.css`) |
| Fonts | Bricolage Grotesque (text) and Pixelify Sans (arcade), via `next/font` |
| Icons | lucide-react |
| Theming | next-themes, class-based; until a visitor picks, it follows their clock (night from 7 pm to 7 am) |
| Game | Canvas 2D and Web Audio; no game library |
| Leaderboard | Supabase (Postgres with row-level security), called from the browser over REST |
| Tests | Vitest |
| Hosting | Cloudflare Workers: static assets plus a small Worker |

There is no `.env` file and no server-side secret. The only runtime dependencies are `next`, `react`, `react-dom`, `next-themes`, `lucide-react` and Tailwind.

## 3. Architecture

### 3.1 Rendering

`next build` exports the whole site as static files (`output: 'export'`). `src/app/page.tsx` is prerendered to HTML and the interactive parts are client components mounted into it. There is no Next.js server in production; the dynamic endpoints (`/api/status`, `/api/run` and `/api/score`) are served by the Cloudflare Worker in `worker/index.ts`.

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
    not-found.tsx         the 404 page
  components/
    ArcadeProvider.tsx    game open/close, scene, scores, easter eggs
    Hero.tsx              parallax scene, title, Play button
    Petals.tsx            seasonal particle canvas (sakura, fireflies, maple, snow)
    Mascot.tsx            the robot on the homepage
    JumpGame.tsx          game shell: menus, HUD, input, score entry
    ScoreBoard.tsx        two-tab leaderboard (used on the page and in the game)
    Leaderboard.tsx       homepage wrapper for ScoreBoard
    SkinPicker.tsx        skin selection (used on the page and in the game)
    AppLauncher.tsx       app tiles with status dots
    EmailCard.tsx         email link that also copies the address
    ThemeToggle.tsx       the lantern theme switch
    MoonRabbit.tsx        the rabbit let out on the fifth pull
    FallenLantern.tsx     the lantern after its cord snaps
    Logo.tsx
  game/
    sim.ts                rules (see 4.1)
    sim.test.ts           tests for the rules
    replay.ts             run recording format and the replay the Worker verifies with
    share.ts              the shareable run result
    engine.ts             fixed-step loop and renderer (see 4.2)
    assets.ts             image loading, scenes, obstacle sprites
    skins.ts              skin definitions and recolouring
    audio.ts              sound
    profile.ts            per-browser player data
  lib/
    site.ts               all site content and configuration
    scores.ts             leaderboard client
    motion.ts             reduced-motion check
    theme.ts              theme-by-clock script
worker/index.ts           Cloudflare Worker: app status, run tickets, verified score posts, keep-alive
wrangler.jsonc            Cloudflare deployment config
supabase/migrations/      leaderboard schema and access rules
tools/scenes/tokyo.lua    Aseprite script that draws the scenes
tools/sprites/lantern.lua Aseprite script that draws the lantern, tassel and rabbit
public/game-assets/       scene layers, robot sprite sheet, sounds
public/sprites/           lantern, tassel and rabbit sprites
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

**Format.** `public/game-assets/Backgrounds/<set>/<day|night>/1.png` to `5.png`, each 576 × 324. Layer 1 is an opaque sky; layers 2 to 5 are transparent and tile horizontally. `sun.png`, the same size, holds just the sun (the moon at night). It is drawn once and never tiled, between the sky and layer 2, so a wide screen shows one sun; the homepage places it at the same fraction of the screen width as it sits in the tile (`SUN_X` in `src/lib/site.ts`, which must match the script).

**Landmarks.** Fuji, the towers, the pagodas, the gates, the tea house and the train live in `N-landmark.png`, drawn over layer N. On the homepage each crosses the screen once at its layer's speed, then comes back from off the right edge, so a wide screen shows one of each at a time; a pass is always a whole number of tiles, so a landmark comes back to the same patch of hill. Landmarks the script marks `behind` (Fuji, the train, the tea house and its gate) have whatever of the layer covers them cut out. The 404 page shows them once, centred. In the game the view is one tile wide, so they simply move with their layer. Which layers have one is listed in `LANDMARK_LAYERS` in `src/lib/site.ts`, which must match the script.

**Source.** All four are drawn by `tools/scenes/tokyo.lua`, a script run inside Aseprite. It builds each layer from shape functions and a seeded random generator, and draws day and night from the same layout with different palettes. To regenerate, set the global `SCENE_OUT_DIR` to the `Backgrounds` folder and run the script. To add a scene, add a scene function to the script and raise `SCENE_COUNT`.

### 4.4 Obstacle art

Obstacles are the 💩 emoji in whatever font the visitor's device provides. Because the glyph differs by platform, `assets.ts` renders it once per size, crops it to its visible pixels and fits it to the hitbox size, so the drawing always matches what can be hit.

### 4.5 Skins

Recolours of the robot sprite sheet. Six unlock with the player's best score in any mode; one is a secret:

| Skin | Unlocks at |
| --- | --- |
| Classic | 0 |
| Sakura | 300 |
| Mint | 800 |
| Sunset | 1,800 |
| Midnight | 3,500 |
| Gold | 10,000 |
| Tsuki | catch the moon rabbit (see section 6); shown as a locked "???" until then |

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

Stored in `localStorage` under `cortaku.profile`: best endless score, best score ever, today's daily best and its date, chosen skin, mute setting, last leaderboard name and secret skins found. The legacy `highScore` key from the original game is still read and written.

## 5. Leaderboard

### 5.1 Design

Scores live in one Supabase table, `cortaku_high_scores`. The browser reads it directly through Supabase's REST API with the project's publishable key (`src/lib/scores.ts`). Scores are posted through the Worker, which replays each run before saving it (5.4).

### 5.2 Schema

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity | primary key |
| `player_name` | text | 1 to 15 characters |
| `score` | integer | 0 to 1,000,000 |
| `challenge_date` | date | null for an endless run; the UTC date for a daily run |
| `run_id` | text, unique | the run ticket it came from, so each run posts once |
| `ip_address` | text | set by trigger; not readable by clients |
| `created_at` | timestamptz | set by trigger |

### 5.3 Access rules

All enforced in the database (`supabase/migrations/`):

- Row-level security is on. Anonymous clients may select `id`, `player_name`, `score` and `challenge_date`. Nothing else: no updates, no deletes, no access to `ip_address`.
- New scores go through `cortaku_post_score`, a `security definer` function that only accepts calls carrying the shared key in `private.cortaku_settings`. Only the Worker holds that key (its `RUN_SECRET`).
- A daily score is accepted only for today's or yesterday's UTC date.
- A `before insert` trigger trims the name, records the visitor's address (passed along by the Worker), and rejects more than five posts a minute from one address.

### 5.4 Verification

The rules are deterministic (4.1), so a run is fully described by its seed and its inputs.

1. When the game opens it asks `/api/run` for a ticket: a random id, the endless seed and the time, signed with HMAC-SHA256. A spare ticket is always fetched ahead, so starting a run never waits on the network.
2. The engine records every press and release by simulation tick (`replay.ts`).
3. To post, the browser sends the ticket, the inputs, the name and the score to `/api/score`. The Worker checks the signature and the ticket's age, replays the inputs through the same `Sim` (the daily seed comes from the date), and requires the replay to die with the claimed score. It also refuses a run that arrives faster than it took to play. Only then does it post the replayed score.

This stops edited scores, forged requests and instant scripted runs. A bot that plays in real time could still get through; stopping that would need the server to run the game live. A run started offline (no ticket) still plays, but can't be posted. Replaying 25 minutes of play takes about 17 ms; typical runs take 1 to 2 ms.

### 5.5 Keep-alive

Supabase pauses free-plan projects that see little activity for about a week. The Worker has a cron trigger that reads the leaderboard every 12 hours, which keeps the project active.

### 5.6 Other tables

The same Supabase project holds an unrelated Mealie database. The second migration enables row-level security on those tables with no policies, which closes them to the publishable key.

## 6. Homepage features

- **Hero.** The five scene layers scroll at different speeds with CSS animations and lean toward the pointer. A button steps through the scenes.
- **Seasons.** One canvas of pixel particles on a breeze that follows the pointer; a click or tap throws a burst. They follow the visitor's month: sakura in spring, glowing fireflies in summer, maple leaves in autumn, snow in winter (`?season=winter` and so on overrides it). It stops when off-screen or while the game is open.
- **Mascot.** The robot runs in place, hops when clicked, and speaks up after seven seconds of inactivity.
- **Game launch.** Opening and closing the game uses the View Transitions API to morph between the hero scene and the game. The game code is loaded on demand.
- **App launcher.** The Worker's `/api/status` sends a `HEAD` request to each app with a 4 s timeout and caches the result at the edge for 60 s. Any response below 500 counts as up, since a login redirect still means the app is running. An app that doesn't answer is shown as napping, and when all of them are down a note says the homelab is asleep.
- **Email.** The email card opens a pre-addressed message and also copies the address, because a `mailto:` link does nothing on a machine with no mail app.
- **Share card.** `opengraph-image.tsx` generates the social preview image at build time.
- **Theme lantern.** A pixel paper lantern hangs from the top of the screen, unlit by day and glowing at night. Clicking it, or dragging its tassel down, switches the theme with a tug and a swing. Until a visitor pulls it, the theme follows their clock, set by a script in `<head>` before the first paint.
- **Sharing.** After a run, Share copies a short result (one 🌸 per zone cleared, then the crash and the score; daily runs are numbered). Phones open the share sheet instead.
- **404.** A missing page shows the hero scene standing still, with the robot stopped at a gap in the road.
- **Analytics.** Cloudflare Web Analytics, cookieless, loaded only on cortaku.com itself so local and preview visits don't count.
- **Easter eggs.** The fifth pull lets a moon rabbit out of the lantern to hop across the road; catching it unlocks the secret Tsuki skin. The tenth snaps the cord: the lantern falls onto the hero's road and stays there until reload, and both it and the cord stub still switch the theme. The Konami code triggers a short rainbow party.
- **Accessibility.** All motion (parallax, petals, mascot, transitions) is disabled under `prefers-reduced-motion`. Controls are keyboard reachable and labelled.

## 7. Build and run

### Local development

```bash
git clone https://github.com/Cortaku/Cortaku_Home_v2.git
cd Cortaku_Home_v2
npm install
npm run dev
```

The site is served at http://localhost:3000. No configuration is needed, but the Worker endpoints don't exist there: app status stays "checking" and scores can't be posted.

To run the Worker locally, put the run secret in a `.dev.vars` file (gitignored) and use `npm run preview`:

```
RUN_SECRET=<the same value as the database's score_key>
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Static export to `./out` |
| `npm run preview` | Build, then serve through the Worker locally (`wrangler dev`) |
| `npm run deploy` | Build, then `wrangler deploy` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

### Hosting

The site runs on Cloudflare Workers as `cortaku-home`, configured in `wrangler.jsonc`:

- The static export in `./out` is served as Worker assets. Requests for files never run Worker code.
- Only `/api/*` reaches the Worker (`worker/index.ts`).
- A cron trigger runs the leaderboard keep-alive every 12 hours.
- The secret `RUN_SECRET` signs run tickets and authorises score posts (`npx wrangler secret put RUN_SECRET`). It must match `score_key` in the database's `private.cortaku_settings`.
- `www.cortaku.com` and `cortaku.com` are attached as custom domains.

Pushing to `main` on GitHub deploys automatically through Cloudflare Workers Builds, which runs `npm run build` and then `npx wrangler deploy`.

### Pointing at a different Supabase project

Run the migrations in `supabase/migrations/` in order, then store the run secret (never committed):

```sql
insert into private.cortaku_settings (name, value) values ('score_key', '<RUN_SECRET>');
```

Change `SUPABASE_URL` and `SUPABASE_KEY` in `src/lib/site.ts`, and set the same `RUN_SECRET` on the Worker.

## 8. Tests

`src/game/sim.test.ts` covers the rules:

- the speed curve and zone thresholds
- jump height, the short hop, and the input buffer
- identical output for identical seeds, and different output for different seeds
- a robot that never jumps dies
- every course is beatable: a scripted player survives three minutes on 150 different courses

`src/game/replay.test.ts` covers verification: recorded runs replay to exactly the same score and length (up to 25 minutes of play), a different seed or doctored inputs give a different result, malformed input lists are refused, and a long replay stays fast.

`src/game/share.test.ts` covers the share text and daily numbering. `src/game/road.test.ts` covers the road palette.

The engine and UI have no automated tests.

## 9. License

This project is open source and available for personal use and modification.
