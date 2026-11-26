-- Generates the scene sets for the jump game: 1 Mount Fuji, 2 neon city, 3 railway at sunset, 4 bamboo forest.
--
-- Run inside Aseprite (File > Scripts, or `aseprite -b --script`) after setting
-- the global SCENE_OUT_DIR to public/game-assets/Backgrounds. Each set is five
-- 576x324 layers for day and for night: layer 1 is the sky, layers 2-5 are
-- transparent and tile horizontally. sun.png holds the sun (or the moon at
-- night) and is drawn once, never tiled. N-landmark.png holds the landmarks of
-- layer N (Fuji, the towers, pagodas, gates, the train): drawn on top of that
-- layer and moving with it, but only once across the screen at a time.
--
-- Everything is drawn from code with a seeded random generator, so a rerun
-- reproduces the same art and a tweak to a palette or a shape is one edit.

local W, H = 576, 324
local pc = app.pixelColor
local OUT = SCENE_OUT_DIR

-- ---------- Colour ----------

local function rgb(h)
  return { tonumber(h:sub(2, 3), 16), tonumber(h:sub(4, 5), 16), tonumber(h:sub(6, 7), 16) }
end

local function hex(h, a)
  local c = rgb(h)
  return pc.rgba(c[1], c[2], c[3], a or 255)
end

-- Blend two hex colours; t = 0 gives a, t = 1 gives b.
local function mix(a, b, t, alpha)
  local ca, cb = rgb(a), rgb(b)
  return pc.rgba(
    math.floor(ca[1] + (cb[1] - ca[1]) * t),
    math.floor(ca[2] + (cb[2] - ca[2]) * t),
    math.floor(ca[3] + (cb[3] - ca[3]) * t),
    alpha or 255)
end

-- ---------- Random ----------

local seed = 1
local function srand(s) seed = s end
local function rnd()
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
end
local function ri(a, b) return a + math.floor(rnd() * (b - a + 1)) end

-- ---------- Drawing ----------
-- x wraps around the image, so anything drawn across the right edge continues on the left and the layer tiles.

local function px(img, x, y, c)
  x = math.floor(x) % W
  y = math.floor(y)
  if y >= 0 and y < H then img:drawPixel(x, y, c) end
end

local function rect(img, x, y, w, h, c)
  x = math.floor(x); y = math.floor(y); w = math.floor(w); h = math.floor(h)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do px(img, xx, yy, c) end
  end
end

local function disc(img, cx, cy, r, c)
  r = math.floor(r)
  for yy = -r, r do
    for xx = -r, r do
      if xx * xx + yy * yy <= r * r then px(img, cx + xx, cy + yy, c) end
    end
  end
end

local function ground(img, y, c) rect(img, 0, y, W, H - y, c) end

local function layer() return Image(W, H, ColorMode.RGB) end

-- ---------- Sky ----------

local BAYER = { { 0, 8, 2, 10 }, { 12, 4, 14, 6 }, { 3, 11, 1, 9 }, { 15, 7, 13, 5 } }

-- A banded gradient with ordered dithering between the bands.
local function sky(top, bottom, bands)
  local img = layer()
  local a, b = rgb(top), rgb(bottom)
  for y = 0, H - 1 do
    local t = y / (H - 1) * bands
    local band = math.floor(t)
    local frac = t - band
    for x = 0, W - 1 do
      local n = band
      if frac > (BAYER[y % 4 + 1][x % 4 + 1] + 0.5) / 16 then n = n + 1 end
      local k = math.min(n, bands) / bands
      img:drawPixel(x, y, pc.rgba(
        math.floor(a[1] + (b[1] - a[1]) * k),
        math.floor(a[2] + (b[2] - a[2]) * k),
        math.floor(a[3] + (b[3] - a[3]) * k), 255))
    end
  end
  return img
end

local function stars(img, count)
  for _ = 1, count do
    local x, y, bright = ri(0, W - 1), ri(0, 190), rnd()
    px(img, x, y, pc.rgba(255, 255, 255, bright < 0.2 and 255 or 150))
    if bright < 0.06 then
      px(img, x - 1, y, pc.rgba(255, 255, 255, 110)); px(img, x + 1, y, pc.rgba(255, 255, 255, 110))
      px(img, x, y - 1, pc.rgba(255, 255, 255, 110)); px(img, x, y + 1, pc.rgba(255, 255, 255, 110))
    end
  end
end

local function sun(img, cx, cy, r, core, halo)
  disc(img, cx, cy, r + 5, hex(halo, 60))
  disc(img, cx, cy, r + 2, hex(halo, 110))
  disc(img, cx, cy, r, hex(core))
end

local function moon(img, cx, cy, r)
  disc(img, cx, cy, r + 3, pc.rgba(255, 255, 255, 35))
  disc(img, cx, cy, r, hex('#f4f1dc'))
  disc(img, cx - 4, cy - 3, 2, hex('#d9d5bd'))
  disc(img, cx + 4, cy + 4, 3, hex('#d9d5bd'))
  disc(img, cx + 5, cy - 6, 1, hex('#d9d5bd'))
end

-- ---------- Land ----------

-- Rolling hills. k1 and k2 are whole numbers of waves across the image, which keeps the edges matching.
-- Returns the surface, a function giving the top row of the hill at any x, so things can stand on it.
local function hills(img, base, amp, c, phase, k1, k2)
  local function surface(x)
    local a = 2 * math.pi * (math.floor(x) % W) / W
    return math.floor(base - amp * (0.6 * math.sin(k1 * a + phase) + 0.4 * math.sin(k2 * a + phase * 1.7)))
  end
  for x = 0, W - 1 do
    local y = surface(x)
    rect(img, x, y, 1, H - y, c)
  end
  return surface
end

-- The base for something standing on `surface` between x0 and x1: one row into the lowest point under it,
-- so no part hangs over a dip. Objects fill the rows above their base.
local function footing(surface, x0, x1)
  local low = surface(x0)
  for x = math.floor(x0) + 1, math.floor(x1) do low = math.max(low, surface(x)) end
  return low + 1
end

local function fuji(img, cx, peak, base, halfWidth, c, snow)
  for dx = -halfWidth, halfWidth do
    local t = 1 - math.abs(dx) / halfWidth
    local y = math.max(math.floor(base - (base - peak) * 1.06 * t ^ 1.7), peak)
    rect(img, cx + dx, y, 1, H - y, c)
    -- A jagged snow line.
    local snowLine = peak + math.floor((base - peak) * 0.26 + 5 * math.sin(dx * 0.45) + 4 * math.sin(dx * 0.19 + 1))
    if y < snowLine then rect(img, cx + dx, y, 1, snowLine - y, snow) end
  end
end

-- ---------- City ----------

-- Windows stop at this height so the strip the robot and obstacles run along stays calm and readable.
local WINDOW_FLOOR = 228

local function building(img, x, top, w, base, c, win, litChance)
  rect(img, x, top, w, base - top, c)
  for wy = top + 3, math.min(base - 5, WINDOW_FLOOR), 5 do
    for wx = x + 2, x + w - 4, 4 do
      if rnd() < litChance then rect(img, wx, wy, 2, 3, win) end
    end
  end
end

-- A row of buildings across the whole image, with the odd antenna or water tank on the roofs.
local function skyline(img, minTop, maxTop, minW, maxW, base, c, win, litChance)
  local x = 0
  while x < W do
    local w, top = ri(minW, maxW), ri(minTop, maxTop)
    building(img, x, top, w, base, c, win, litChance)
    local extra = rnd()
    if extra < 0.3 then
      rect(img, x + w // 2, top - ri(5, 11), 1, 11, c)
    elseif extra < 0.5 then
      rect(img, x + 2, top - 4, math.min(7, w - 4), 4, c)
    end
    x = x + w + ri(0, 3)
  end
end

-- The red-and-white lattice tower.
local function tokyoTower(img, cx, base, h, red, white)
  for i = 0, h - 1 do
    local t = i / h
    local y = base - h + i
    local c = (math.floor(t * 7) % 2 == 0) and red or white
    if t < 0.14 then
      px(img, cx, y, c)
    else
      local hw = math.floor(1 + h * 0.2 * ((t - 0.14) / 0.86) ^ 2)
      for dx = -hw, hw do
        if math.abs(dx) >= hw - 1 or (i + dx) % 4 == 0 or (i - dx) % 4 == 0 then px(img, cx + dx, y, c) end
      end
    end
  end
  rect(img, cx - 3, base - h * 0.74, 7, 3, white)
  rect(img, cx - h * 0.06 - 2, base - h * 0.5, h * 0.12 + 5, 4, white)
end

-- The tall broadcasting needle with its two observation pods.
local function skytree(img, cx, base, h, c, light)
  rect(img, cx, base - h, 1, h * 0.2, c)
  rect(img, cx - 1, base - h * 0.8, 3, h * 0.8, c)
  rect(img, cx - 2, base - h * 0.45, 5, h * 0.45, c)
  rect(img, cx - 4, base - h * 0.72, 9, 5, c)
  rect(img, cx - 3, base - h * 0.63, 7, 4, c)
  rect(img, cx - 4, base - h * 0.72 + 2, 9, 1, light)
  rect(img, cx - 3, base - h * 0.63 + 1, 7, 1, light)
end

-- A vertical shop sign filled with blocky made-up characters.
local function sign(img, x, y, w, h, frame, ink, glow)
  if glow then rect(img, x - 1, y - 1, w + 2, h + 2, glow) end
  rect(img, x, y, w, h, frame)
  local cell = w - 2
  local gy = y + 1
  while gy + cell <= y + h - 1 do
    for cy = 0, cell - 1 do
      for cx = 0, cell - 1 do
        if rnd() < 0.55 then px(img, x + 1 + cx, gy + cy, ink) end
      end
    end
    gy = gy + cell + 1
  end
end

local function pole(img, x, base, h, c)
  rect(img, x, base - h, 2, h, c)
  rect(img, x - 5, base - h + 3, 12, 1, c)
  rect(img, x - 3, base - h + 8, 8, 1, c)
  rect(img, x - 5, base - h + 1, 1, 2, c)
  rect(img, x + 6, base - h + 1, 1, 2, c)
end

-- A sagging cable between two points.
local function wire(img, x1, y1, x2, y2, sag, c)
  for x = x1, x2 do
    local t = (x - x1) / (x2 - x1)
    px(img, x, y1 + (y2 - y1) * t + sag * 4 * t * (1 - t) + 0.5, c)
  end
end

-- ---------- Tradition ----------

local function pagoda(img, cx, base, tiers, c)
  local y = base
  for i = 1, tiers do
    local bodyW = 10 + (tiers - i) * 5
    rect(img, cx - bodyW / 2, y - 9, bodyW, 9, c)
    y = y - 9
    local roofW = bodyW + 14
    local left = math.floor(cx - roofW / 2)
    rect(img, left, y - 2, roofW, 2, c)
    rect(img, left + 3, y - 4, roofW - 6, 2, c)
    rect(img, left + 7, y - 6, roofW - 14, 2, c)
    -- Upturned eaves.
    px(img, left - 1, y - 3, c); px(img, left - 2, y - 4, c)
    px(img, left + roofW, y - 3, c); px(img, left + roofW + 1, y - 4, c)
    y = y - 6
  end
  rect(img, cx, y - 12, 1, 12, c)
  rect(img, cx - 1, y - 8, 3, 1, c)
  rect(img, cx - 1, y - 5, 3, 1, c)
end

local function torii(img, cx, base, s, c)
  local hw, h, t = math.floor(10 * s), math.floor(26 * s), math.max(2, math.floor(2 * s))
  rect(img, cx - hw, base - h, t, h, c)
  rect(img, cx + hw - t, base - h, t, h, c)
  local beamL, beamW = cx - hw - math.floor(5 * s), 2 * hw + math.floor(10 * s)
  rect(img, beamL, base - h - t, beamW, t, c)
  px(img, beamL - 1, base - h - t - 1, c); px(img, beamL, base - h - t - 1, c)
  px(img, beamL + beamW - 1, base - h - t - 1, c); px(img, beamL + beamW, base - h - t - 1, c)
  rect(img, cx - hw - math.floor(2 * s), base - h + math.floor(5 * s), 2 * hw + math.floor(4 * s), t, c)
end

-- A cherry tree centred on x: a trunk flaring at the root, two boughs reaching up into the crown, and a crown
-- built around the trunk top. Lobes come in mirrored pairs (with a little jitter) and the middle lobe overlaps
-- the trunk, so the blossom never floats or leans off its trunk.
local function blossomTree(img, x, base, s, trunk, leaf, light)
  local top = base - 21 * s
  rect(img, x - 1, top, 3, base - top, trunk)
  rect(img, x - 2, base - 3, 5, 3, trunk)
  rect(img, x - 3, base - 1, 7, 1, trunk)
  -- Boughs: a diagonal each way from the upper trunk, ending inside the side lobes.
  for i = 0, 3 * s do
    local y = top + 4 * s - math.floor(i * 0.7)
    rect(img, x - 1 - i, y, 1, 2, trunk)
    rect(img, x + 1 + i, y - s, 1, 2, trunk)
  end
  local cy = top - 3 * s
  disc(img, x, cy, 6 * s, leaf)
  for _ = 1, 2 do
    local dx, dy = ri(6, 9) * s, ri(-1, 2) * s
    disc(img, x - dx, cy + dy + ri(-1, 1), 4 * s + ri(0, 2), leaf)
    disc(img, x + dx, cy + dy + ri(-1, 1), 4 * s + ri(0, 2), leaf)
  end
  local ux = ri(2, 4) * s
  disc(img, x - ux, cy - 5 * s, 4 * s, leaf)
  disc(img, x + ux, cy - 5 * s - ri(0, 1) * s, 4 * s, leaf)
  for _ = 1, 3 do
    local dx, dy = ri(2, 7) * s, ri(-6, 1) * s
    disc(img, x - dx, cy + dy, 1.5 * s, light)
    disc(img, x + ri(2, 7) * s, cy + ri(-6, 1) * s, 1.5 * s, light)
  end
end

local function pine(img, x, base, h, c)
  rect(img, x, base - h * 0.3, 2, h * 0.3, c)
  for tier = 0, 2 do
    local top = base - h + tier * h * 0.22
    local rows = math.floor(h * 0.34)
    for r = 0, rows - 1 do
      local half = math.floor(1 + r * (0.5 + tier * 0.12))
      rect(img, x + 1 - half, top + r, half * 2, 1, c)
    end
  end
end

local function stoneLantern(img, x, base, c, lit)
  rect(img, x - 2, base - 3, 5, 3, c)
  rect(img, x - 1, base - 9, 3, 6, c)
  rect(img, x - 3, base - 14, 7, 5, c)
  rect(img, x - 1, base - 13, 3, 3, lit)
  rect(img, x - 4, base - 16, 9, 2, c)
  rect(img, x - 1, base - 18, 3, 2, c)
end

local function house(img, x, base, w, h, wall, roof, win)
  rect(img, x, base - h, w, h, wall)
  for i = 0, 5 do rect(img, x - 3 + i, base - h - 1 - i, w + 6 - 2 * i, 1, roof) end
  rect(img, x + 3, base - h + 4, 3, 3, win)
  if w > 18 then rect(img, x + w - 7, base - h + 4, 3, 3, win) end
end

-- ---------- Railway ----------

local function viaduct(img, y, base, c)
  rect(img, 0, y, W, 6, c)
  rect(img, 0, y - 3, W, 1, c)
  for x = 0, W - 1, 4 do rect(img, x, y - 3, 1, 3, c) end
  for x = 12, W - 1, 48 do
    rect(img, x, y + 6, 5, base - y - 6, c)
    rect(img, x - 2, y + 6, 9, 2, c)
  end
end

local function train(img, x, y, cars, body, stripe, win)
  for i = 0, cars - 1 do
    local cx = x + i * 46
    rect(img, cx, y - 13, 44, 13, body)
    rect(img, cx + 1, y - 14, 42, 1, body)
    rect(img, cx, y - 4, 44, 2, stripe)
    for wx = cx + 4, cx + 36, 8 do rect(img, wx, y - 11, 5, 4, win) end
    rect(img, cx + 6, y, 6, 2, body)
    rect(img, cx + 32, y, 6, 2, body)
  end
  -- A sloped nose on the leading car.
  local nose = x + cars * 46 - 2
  rect(img, nose, y - 11, 3, 11, body)
  rect(img, nose + 3, y - 8, 2, 8, body)
end

-- ---------- Palettes ----------
-- The sun and moon get an image of their own (sun.png), drawn once between the sky and layer 2: the sky is
-- stretched to fit and layer 2 tiles, so either would warp the sun or repeat it on a wide screen.
-- Palettes are sky top and bottom, then silhouette colours from the farthest layer (2) to the nearest (5).

local function palette(time, day, night)
  return time == 'day' and day or night
end

-- ---------- Scene 1: Mount Fuji, a pagoda and cherry blossom ----------

local function sceneFuji(time)
  local night = time == 'night'
  local p = palette(time,
    { '#8ecbf2', '#ffe6d6', '#aebbe0', '#8c9bcc', '#5e6dab', '#37437a' },
    { '#0d0b26', '#2f2a63', '#2b2d60', '#222352', '#17183c', '#0d0e26' })
  local lit = night and hex('#ffd77a') or mix(p[4], '#ffffff', 0.3)
  local out = {}

  srand(901)
  out[1] = sky(p[1], p[2], 9)
  if night then stars(out[1], 150) end

  srand(902)
  out[2] = layer()
  out.sun = layer()
  if night then moon(out.sun, 452, 62, 15) else sun(out.sun, 452, 70, 17, '#fff6d8', '#fff0c0') end
  out.marks = { [2] = layer(), [3] = layer(), [4] = layer() }
  out.behind = { [2] = true }
  fuji(out.marks[2], 210, 74, 236, 176, hex(p[3]), night and hex('#c9cdf0') or hex('#ffffff'))
  hills(out[2], 232, 8, mix(p[3], p[4], 0.4), 0.6, 2, 5)

  srand(903)
  out[3] = layer()
  local land3 = hills(out[3], 228, 9, hex(p[4]), 2.1, 3, 7)
  pagoda(out.marks[3], 438, footing(land3, 423, 453), 5, hex(p[4]))
  for _, x in ipairs({ 40, 62, 92, 300, 330, 520, 548 }) do pine(out[3], x, footing(land3, x, x + 1), ri(16, 24), hex(p[4])) end

  srand(904)
  out[4] = layer()
  local land4 = hills(out[4], 244, 5, hex(p[5]), 4.0, 2, 6)
  torii(out.marks[4], 120, footing(land4, 103, 137), 1.7, night and hex('#7a2238') or hex('#d8455a'))
  local pagodaBase = footing(land4, 308, 328)
  pagoda(out.marks[4], 318, pagodaBase, 3, hex(p[5]))
  for _, x in ipairs({ 20, 190, 214, 400, 470, 496, 560 }) do pine(out[4], x, footing(land4, x, x + 1), ri(22, 34), hex(p[5])) end
  rect(out.marks[4], 318 - 4, pagodaBase - 6, 3, 3, lit)

  srand(905)
  out[5] = layer()
  ground(out[5], 272, hex(p[6]))
  local hill5 = hills(out[5], 270, 3, hex(p[6]), 1.0, 4, 9)
  local function land5(x) return math.min(hill5(x), 272) end
  local leaf = night and hex('#8a4a78') or hex('#ff9fc0')
  local light = night and hex('#b0669a') or hex('#ffd3e2')
  for _, x in ipairs({ 36, 150, 262, 372, 486 }) do
    local tx = x + ri(-8, 8)
    blossomTree(out[5], tx, footing(land5, tx - 1, tx + 3), 2, hex(p[6]), leaf, light)
  end
  for _, x in ipairs({ 96, 318, 432 }) do stoneLantern(out[5], x, footing(land5, x - 2, x + 2), hex(p[6]), lit) end
  rect(out[5], 0, 262, W, 1, hex(p[6]))
  for x = 6, W - 1, 12 do rect(out[5], x, 259, 2, footing(land5, x, x + 1) - 259, hex(p[6])) end
  return out
end

-- ---------- Scene 2: neon city ----------

local function sceneNeon(time)
  local night = time == 'night'
  local p = palette(time,
    { '#a9c9ee', '#f6d9e6', '#b3bfe0', '#8794c6', '#5a67a3', '#333d70' },
    { '#120a2e', '#4a1f5c', '#2a2460', '#1f1a4c', '#151238', '#0b0920' })
  local litChance = night and 0.38 or 0.5
  local function windows(i) return night and hex('#ffd77a') or mix(p[i], '#ffffff', 0.22) end
  local out = {}

  srand(1001)
  out[1] = sky(p[1], p[2], 9)
  if night then stars(out[1], 90) end

  srand(1002)
  out[2] = layer()
  out.sun = layer()
  if night then moon(out.sun, 280, 54, 12) else sun(out.sun, 280, 60, 14, '#fffbe8', '#ffe9c4') end
  skyline(out[2], 120, 190, 14, 30, H, hex(p[3]), windows(3), litChance * 0.5)
  out.marks = { [2] = layer() }
  skytree(out.marks[2], 150, 232, 168, hex(p[3]), night and hex('#9ad8ff') or mix(p[3], '#ffffff', 0.4))
  tokyoTower(out.marks[2], 408, 232, 150,
    night and hex('#ff7a3c') or hex('#e8553f'),
    night and hex('#ffe9b0') or hex('#f6f1ea'))

  srand(1003)
  out[3] = layer()
  skyline(out[3], 150, 205, 18, 36, H, hex(p[4]), windows(4), litChance)

  srand(1004)
  out[4] = layer()
  skyline(out[4], 172, 222, 24, 44, H, hex(p[5]), windows(5), litChance * 0.7)
  local inks = { '#ff5c8f', '#5ce1ff', '#ffd84d', '#9dff8a' }
  local n = 0
  for x = 18, W - 20, 62 do
    n = n + 1
    local ink = inks[(n - 1) % #inks + 1]
    local sx, sy, sh = x + ri(0, 14), ri(150, 176), ri(26, 40)
    sign(out[4], sx, sy, 7, sh,
      night and hex('#0b0920') or hex(p[6]),
      night and hex(ink) or mix(ink, p[5], 0.35),
      night and hex(ink, 70) or nil)
  end

  srand(1005)
  out[5] = layer()
  ground(out[5], 272, hex(p[6]))
  -- Low shopfronts with awnings and lit doorways.
  local x = 0
  while x < W do
    local w, top = ri(26, 46), ri(232, 252)
    rect(out[5], x, top, w, H - top, hex(p[6]))
    rect(out[5], x - 1, top + 5, w + 2, 2, night and hex('#3a1f4f') or mix(p[6], p[5], 0.5))
    if rnd() < 0.6 then rect(out[5], x + 4, 261, 6, 9, night and hex('#ffb86b') or mix(p[6], '#ffffff', 0.18)) end
    if rnd() < 0.35 then rect(out[5], x + w - 9, 258, 5, 12, night and hex('#7fe6ff') or mix(p[6], '#ffffff', 0.25)) end
    x = x + w + ri(2, 8)
  end
  for px0 = 40, W - 1, 144 do pole(out[5], px0, 272, 62, hex(p[6])) end
  for px0 = 40, W - 1, 144 do
    wire(out[5], px0 - 5, 213, px0 + 139, 213, 9, hex(p[6]))
    wire(out[5], px0 + 7, 213, px0 + 151, 213, 12, hex(p[6]))
    wire(out[5], px0 - 3, 218, px0 + 141, 218, 7, hex(p[6]))
  end
  return out
end

-- ---------- Scene 3: the railway through the suburbs at sunset ----------

local function sceneRail(time)
  local night = time == 'night'
  local p = palette(time,
    { '#5d70b4', '#ffb38a', '#c58fa6', '#9a6f96', '#6a4f82', '#3d3160' },
    { '#0a1030', '#1f3360', '#22305e', '#1a2550', '#121a3c', '#0a1026' })
  local lit = night and hex('#ffd77a') or hex('#ffe3b8')
  local out = {}

  srand(1101)
  out[1] = sky(p[1], p[2], 10)
  if night then stars(out[1], 130) end

  srand(1102)
  out[2] = layer()
  out.sun = layer()
  if night then moon(out.sun, 300, 58, 13) else sun(out.sun, 300, 190, 26, '#fff1c9', '#ffd49a') end
  hills(out[2], 196, 26, hex(p[3]), 0.4, 1, 3)
  hills(out[2], 214, 14, mix(p[3], p[4], 0.5), 2.6, 2, 5)

  srand(1103)
  out[3] = layer()
  skyline(out[3], 196, 218, 10, 22, H, hex(p[4]), night and lit or mix(p[4], '#ffffff', 0.2), night and 0.3 or 0.4)
  for _, x in ipairs({ 70, 250, 430 }) do pole(out[3], x, 232, 40, hex(p[4])) end

  srand(1104)
  out[4] = layer()
  ground(out[4], 250, hex(p[5]))
  viaduct(out[4], 210, 250, hex(p[5]))
  out.marks = { [4] = layer() }
  out.behind = { [4] = true }
  train(out.marks[4], 70, 207, 4,
    night and hex('#2b3a6a') or hex('#f1ece4'),
    night and hex('#ff7a3c') or hex('#e8553f'),
    lit)
  -- Overhead line masts and the contact wire.
  for x = 30, W - 1, 96 do
    rect(out[4], x, 180, 1, 27, hex(p[5]))
    rect(out[4], x - 4, 182, 9, 1, hex(p[5]))
  end
  rect(out[4], 0, 186, W, 1, hex(p[5]))

  srand(1105)
  out[5] = layer()
  ground(out[5], 272, hex(p[6]))
  local x = 4
  while x < W - 30 do
    local w, h = ri(18, 30), ri(14, 22)
    house(out[5], x, 272, w, h, hex(p[6]), mix(p[6], p[5], 0.45), lit)
    x = x + w + ri(10, 34)
  end
  for _ = 1, 14 do disc(out[5], ri(0, W - 1), 270, ri(4, 7), hex(p[6])) end
  for px0 = 88, W - 1, 144 do pole(out[5], px0, 272, 58, hex(p[6])) end
  for px0 = 88, W - 1, 144 do
    wire(out[5], px0 - 5, 217, px0 + 139, 217, 10, hex(p[6]))
    wire(out[5], px0 + 7, 217, px0 + 151, 217, 8, hex(p[6]))
  end
  return out
end

-- ---------- Bamboo ----------

-- One stalk from `top` down to `base`, with a ring at every joint. `lean` tilts it (px sideways per px of height).
local function bamboo(img, x, top, base, w, c, joint, lean)
  local segment = 12 + w * 3
  for y = top, base - 1 do
    local sx = x + math.floor((base - y) * lean)
    rect(img, sx, y, w, 1, c)
    if (base - y) % segment == 0 then rect(img, sx, y, w, 1, joint) end
  end
end

-- A fan of thin drooping leaves around a point.
local function leaves(img, x, y, count, c)
  for _ = 1, count do
    local x0, y0 = x + ri(-6, 6), y + ri(-4, 4)
    local dir = rnd() < 0.5 and -1 or 1
    local len = ri(4, 8)
    for i = 0, len do px(img, x0 + dir * i, y0 + i // 2, c) end
  end
end

-- The leafy roof of the grove: a band hanging from the top of the image with a wavy lower edge.
local function canopy(img, depth, amp, c, phase, k1, k2)
  for x = 0, W - 1 do
    local a = 2 * math.pi * x / W
    local y = math.floor(depth + amp * (0.6 * math.sin(k1 * a + phase) + 0.4 * math.sin(k2 * a + phase * 1.7)))
    rect(img, x, 0, 1, y, c)
  end
end

-- A row of stalks across the whole image, each topped with leaves where it meets the canopy.
local function grove(img, base, spacing, jitter, w, wJitter, canopyY, c, joint, leaf)
  local x = ri(0, spacing)
  while x < W do
    local width = w + ri(0, wJitter)
    local lean = (rnd() - 0.5) * 0.06
    bamboo(img, x, 0, base, width, c, joint, lean)
    leaves(img, x + math.floor(base * lean), canopyY + ri(0, 14), 5, leaf)
    if rnd() < 0.5 then leaves(img, x + math.floor((base - 90) * lean), ri(70, 130), 3, leaf) end
    x = x + spacing + ri(-jitter, jitter)
  end
end

-- A slatted bamboo fence, the kind that lines the paths in Arashiyama.
local function fence(img, top, base, c, rail)
  for x = 0, W - 1, 3 do rect(img, x, top + ((x // 3) % 2), 2, base - top, c) end
  rect(img, 0, top + 4, W, 2, rail)
  rect(img, 0, base - 6, W, 2, rail)
end

local function teaHouse(img, x, base, wall, roof, lit)
  rect(img, x, base - 16, 40, 16, wall)
  for i = 0, 7 do rect(img, x - 8 + i, base - 17 - i, 56 - 2 * i, 1, roof) end
  px(img, x - 9, base - 18, roof); px(img, x - 10, base - 19, roof)
  px(img, x + 48, base - 18, roof); px(img, x + 49, base - 19, roof)
  rect(img, x + 6, base - 12, 9, 9, lit)
  rect(img, x + 10, base - 12, 1, 9, wall)
  rect(img, x + 6, base - 8, 9, 1, wall)
  rect(img, x + 24, base - 12, 9, 12, lit)
  rect(img, x + 28, base - 12, 1, 12, wall)
end

-- ---------- Scene 4: a Kyoto bamboo forest ----------

local function sceneBamboo(time)
  local night = time == 'night'
  local p = palette(time,
    { '#cfe9c4', '#f6f7d6', '#b3d8a6', '#84bb78', '#4c9156', '#2a5e3e' },
    { '#051518', '#12383a', '#17403c', '#123431', '#0c2825', '#071a18' })
  local lit = night and hex('#ffd77a') or hex('#fff3c4')
  local function joint(i) return night and mix(p[i], '#000000', 0.3) or mix(p[i], '#ffffff', 0.3) end
  local out = {}

  srand(1201)
  out[1] = sky(p[1], p[2], 8)
  if night then stars(out[1], 60) end

  -- Far: a pale wall of thin stalks in the mist, with the sun or moon behind them.
  srand(1202)
  out[2] = layer()
  out.sun = layer()
  if night then moon(out.sun, 404, 96, 14) else sun(out.sun, 404, 100, 20, '#fffde8', '#fbf6c8') end
  canopy(out[2], 46, 10, hex(p[3]), 0.8, 2, 5)
  grove(out[2], H, 13, 4, 2, 1, 50, hex(p[3]), joint(3), hex(p[3]))
  hills(out[2], 236, 6, hex(p[3]), 1.3, 2, 5)

  srand(1203)
  out[3] = layer()
  canopy(out[3], 34, 9, hex(p[4]), 2.4, 3, 7)
  grove(out[3], H, 27, 8, 3, 1, 40, hex(p[4]), joint(4), hex(p[4]))
  hills(out[3], 240, 5, hex(p[4]), 3.0, 3, 4)

  -- Near: thick stalks, a tea house and a gate on the path.
  srand(1204)
  out[4] = layer()
  canopy(out[4], 22, 8, hex(p[5]), 4.1, 2, 6)
  local land = hills(out[4], 246, 4, hex(p[5]), 0.5, 2, 6)
  out.marks = { [4] = layer() }
  out.behind = { [4] = true }
  teaHouse(out.marks[4], 300, footing(land, 300, 339), hex(p[5]), mix(p[5], p[6], 0.6), lit)
  torii(out.marks[4], 124, footing(land, 109, 139), 1.5, night and hex('#7a2238') or hex('#d8455a'))
  grove(out[4], 250, 58, 14, 5, 2, 28, hex(p[5]), joint(5), hex(p[5]))
  if night then
    -- Fireflies. Drawn last so the extra random numbers cannot shift anything else in the layer.
    for _ = 1, 46 do
      local fx, fy = ri(0, W - 1), ri(120, 240)
      px(out[4], fx, fy, hex('#eaff8a'))
      px(out[4], fx + 1, fy, hex('#eaff8a', 110)); px(out[4], fx - 1, fy, hex('#eaff8a', 110))
      px(out[4], fx, fy + 1, hex('#eaff8a', 110)); px(out[4], fx, fy - 1, hex('#eaff8a', 110))
    end
  end

  -- Foreground: the fence along the path, stone lanterns and a few heavy stalks.
  srand(1205)
  out[5] = layer()
  ground(out[5], 272, hex(p[6]))
  fence(out[5], 254, 272, hex(p[6]), mix(p[6], '#000000', 0.25))
  for _, x in ipairs({ 70, 214, 358, 502 }) do stoneLantern(out[5], x, 254, hex(p[6]), lit) end
  for _, x in ipairs({ 20, 164, 290, 440 }) do
    bamboo(out[5], x + ri(-10, 10), 0, 272, 7, hex(p[6]), joint(6), (rnd() - 0.5) * 0.05)
  end
  canopy(out[5], 12, 6, hex(p[6]), 5.2, 3, 8)
  for x = 10, W - 1, 38 do leaves(out[5], x + ri(-8, 8), 18 + ri(0, 8), 6, hex(p[6])) end
  return out
end

-- ---------- Output ----------

-- A landmark marked `behind` sits behind everything else in its layer (hills, stalks, masts): clear
-- whatever of it the layer covers, since the landmark image is drawn on top of the layer.
local function tuckBehind(mark, img)
  local clear = pc.rgba(0, 0, 0, 0)
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      if pc.rgbaA(img:getPixel(x, y)) > 0 then mark:drawPixel(x, y, clear) end
    end
  end
end

local SCENES = { [1] = sceneFuji, [2] = sceneNeon, [3] = sceneRail, [4] = sceneBamboo }

local written = 0
for set, build in pairs(SCENES) do
  for _, time in ipairs({ 'day', 'night' }) do
    local layers = build(time)
    for i, img in ipairs(layers) do
      img:saveAs(OUT .. '/' .. set .. '/' .. time .. '/' .. i .. '.png')
      written = written + 1
    end
    layers.sun:saveAs(OUT .. '/' .. set .. '/' .. time .. '/sun.png')
    written = written + 1
    for n, mark in pairs(layers.marks or {}) do
      if layers.behind and layers.behind[n] then tuckBehind(mark, layers[n]) end
      mark:saveAs(OUT .. '/' .. set .. '/' .. time .. '/' .. n .. '-landmark.png')
      written = written + 1
    end
  end
end
print('wrote ' .. written .. ' layers to ' .. OUT)
