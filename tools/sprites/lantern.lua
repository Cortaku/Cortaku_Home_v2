-- Draws the theme switcher's sprites: the paper lantern (unlit and lit), its tassel and the moon rabbit.
--
-- Run inside Aseprite with the global SPRITE_OUT_DIR set to public/sprites. Each sprite is ASCII rows
-- plus a colour legend ('.' is transparent); the page scales them up with pixelated rendering.

local pc = app.pixelColor
local OUT = SPRITE_OUT_DIR

local function rgba(h)
  return pc.rgba(tonumber(h:sub(2, 3), 16), tonumber(h:sub(4, 5), 16), tonumber(h:sub(6, 7), 16), 255)
end

-- Frames are drawn side by side into one strip.
local function strip(frames, legend, outline)
  local h, w = #frames[1], #frames[1][1]
  local img = Image(w * #frames, h, ColorMode.RGB)
  for f, rows in ipairs(frames) do
    local ox = (f - 1) * w
    for y, row in ipairs(rows) do
      assert(#row == w, 'row ' .. y .. ' of frame ' .. f .. ' is ' .. #row .. ' wide, not ' .. w)
      for x = 1, w do
        local ch = row:sub(x, x)
        if ch ~= '.' then img:drawPixel(ox + x - 1, y - 1, rgba(legend[ch])) end
      end
    end
    -- A 1 px outline on every empty pixel that touches the art, kept inside this frame.
    if outline then
      local edge = {}
      for y = 0, h - 1 do
        for x = 0, w - 1 do
          if pc.rgbaA(img:getPixel(ox + x, y)) == 0 then
            for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
              local nx, ny = x + d[1], y + d[2]
              if nx >= 0 and nx < w and ny >= 0 and ny < h and pc.rgbaA(img:getPixel(ox + nx, ny)) > 0 then
                edge[#edge + 1] = { ox + x, y }
                break
              end
            end
          end
        end
      end
      for _, p in ipairs(edge) do img:drawPixel(p[1], p[2], rgba(outline)) end
    end
  end
  return img
end

-- ---------- Lantern ----------
-- A ribbed paper chochin with a sakura crest. K caps, r ribs, R paper, H lit edge, D shadow side.

local LANTERN = {
  '....KKKKKK....',
  '...KKKKKKKK...',
  '..rrrrrrrrrr..',
  '.RHRRRRRRRRRD.',
  '.RHRRRRRRRRRD.',
  'rrrrrrrrrrrrrr',
  'RHRRRWWWWRRRDD',
  'RHRRWWPPWWRRDD',
  'rrrrWPYYPWrrrr',
  'RHRRWPYYPWRRDD',
  'RHRRWWPPWWRRDD',
  'rrrrrWWWWrrrrr',
  'RHRRRRRRRRRRDD',
  'RHRRRRRRRRRRDD',
  'rrrrrrrrrrrrrr',
  '.RHRRRRRRRRRD.',
  '.RHRRRRRRRRRD.',
  '..rrrrrrrrrr..',
  '...KKKKKKKK...',
  '....KKKKKK....',
}

local UNLIT = { K = '#2b2140', r = '#a8324a', R = '#d8455a', H = '#f07a8a', D = '#b83a50', W = '#f6efe6', P = '#ff9fc0', Y = '#ffd84d' }
local LIT = { K = '#2b2140', r = '#e0782e', R = '#ffb347', H = '#ffe39a', D = '#f0963a', W = '#fff6d8', P = '#ff7aa5', Y = '#d8455a' }

local TASSEL = {
  '.GG.',
  'GGGG',
  '.GG.',
  'RRRR',
  'RrRr',
  'RrRr',
  'RrRr',
  'R.R.',
}

-- ---------- Moon rabbit ----------
-- Facing left, ears laid back. Frame 1 is crouched on the ground, frame 2 is mid-hop.
-- W fur, S shade, P pink, E eye; the outline is added in code.

local RABBIT = {
  {
    '.......................',
    '...........WWW.........',
    '.........WWPPW.........',
    '........WPPWW..........',
    '...WWWWWWWW............',
    '..WWWWWWWWWW...........',
    '..WWWEWWWWWWWWWW.......',
    '.PWWWEWWWWWWWWWWWW.....',
    '..WWWWWWWWWWWWWWWWWW...',
    '...WWPWWWWWWWWWWWWWWW..',
    '....SWWWWWWWWWWWWWWS...',
    '.....SSSWWWWWWWWSSS....',
    '......WWW.....WWWW.....',
    '.......................',
  },
  {
    '.......................',
    '.............WWWW......',
    '...........WWPPPW......',
    '.........WWPPWW........',
    '....WWWWWWWW...........',
    '...WWWWWWWWWW..........',
    '...WWWEWWWWWWWWWW......',
    '..PWWWEWWWWWWWWWWWW....',
    '...WWWWWWWWWWWWWWWWWW..',
    '....WWPWWWWWWWWWWWWWS..',
    '...WWWSSWWWWWWWWWSSWW..',
    '..WW.......SSSS....WWW.',
    '.WW.................WW.',
    '.......................',
  },
}

local FUR = { W = '#ffffff', S = '#d9d3ea', P = '#ff9fc0', E = '#2b2140' }

strip({ LANTERN }, UNLIT):saveAs(OUT .. '/lantern-off.png')
strip({ LANTERN }, LIT):saveAs(OUT .. '/lantern-on.png')
strip({ TASSEL }, { G = '#ffd84d', R = '#d8455a', r = '#a8324a' }):saveAs(OUT .. '/tassel.png')
strip(RABBIT, FUR, '#2b2140'):saveAs(OUT .. '/rabbit.png')
print('wrote 4 sprites to ' .. OUT)
