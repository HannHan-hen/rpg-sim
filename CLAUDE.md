# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo.

## What this is

**Banished** is a dice-driven, browser-based RPG set on the prison island of
**Ashfall**. You pick the crime that got you banished, step off the barge, and
carve out a life among the island's factions. It is inspired by Morrowind: you
click to attack but the dice decide, skills improve through use, and magic is a
freeform sandbox of composable effects.

The whole game is **drawn in code** — no image files, no audio, no libraries, no
build step. If a browser can open a web page, it can run this.

- `README.md` — player-facing intro and how to run/deploy.
- `DESIGN.md` — the vision, world geography, and phased build roadmap.
- `WORLDBOOK.md` / `GRIMOIRE.md` — lore and the magic system in prose.

## Running it

There is no build and no dependencies. Either:

- Open `index.html` directly in a browser (works offline, file://), or
- Serve the folder statically (e.g. `python3 -m http.server`) and open it.

Deployed via GitHub Pages (`.github/workflows/pages.yml`) on push.

There is no automated test suite. Verify changes by playing in a browser. For a
quick syntax sanity check on the scripts: `node --check js/<file>.js`.

## Architecture

Plain ES5-style scripts (no modules/bundler). Every file is an IIFE that hangs
its exports off a single global `window.RPG` namespace, e.g.
`RPG.Renderer`, `RPG.World`, `RPG.Data`. Load order is fixed by the `<script>`
tags at the bottom of `index.html` — if you add a file, add it there, and after
anything it depends on.

The core pattern is **data-driven content**: zones, NPCs, dialogue, items,
spells, and factions are declarative data, not engine code. New content = new
data, not new systems.

### File map (`js/`)

| File | Responsibility |
|---|---|
| `rng.js` | Seedable RNG — the "dice" (`d100`, `int`, `range`). |
| `data.js` | All the numbers: attributes, skills, weapons, spells, monsters, backgrounds, magic effects. |
| `zones.js` | Every map as a text-grid (ASCII) plus its spawns, portals, ambient. **Add new areas here.** |
| `world.js` | Turns a zone definition into a live map: collision grid, terrain, torches, portals, entries, spawns. |
| `entities.js` | Player and enemies; use-based skills that level up. |
| `items.js` | Weapons, item construction, save/restore. |
| `magic.js` | Spell composition, casting, cost, enchanting. |
| `social.js` | Persuasion / disposition mechanics. |
| `quests.js` | Quest state, objectives, the "Sight" (fast-travel gate). |
| `guilds.js` | Joinable factions. |
| `combat.js` | Morrowind-style hit resolution (skill + agility + luck vs evasion, scaled by fatigue). |
| `save.js` | localStorage save/load. |
| `render.js` | All graphics + the particle/FX system, drawn in code. |
| `ui.js` | The HTML overlay: HUD, log, character sheet, dialogue, inventory, arcane & journal panels. |
| `input.js` | Keyboard/mouse handling. |
| `game.js` | The conductor: main loop, persistent player, zone loading/travel, enemy AI, save/load. |

### The frame loop

`game.js` `_frame` runs via `requestAnimationFrame`: `update(dt)` (skipped when a
modal panel is open or the title overlay is up) → `fx.update` →
`renderer.draw` → `ui.updateHud`. `dt` is clamped to 0.05s.

## Performance conventions

This game is meant to run on **old, slow PCs**, so the render path is kept cheap.
Two patterns matter when touching `render.js`:

- **Static terrain is baked once per zone** to an offscreen canvas
  (`_bakeTerrain`) and blitted each frame; only animated terrain (water shimmer)
  is drawn live. Tile-drawing helpers (`_floorTile`, `_wallTile`, etc.) work in
  **world coordinates** (no camera offset) because they only run during the bake.
  If you add a static terrain type, draw it in the bake; don't add per-frame
  per-tile work.
- **Lighting uses cached radial sprites** (`_carveSprite`, `_glowSprite`) blitted
  with `drawImage` rather than building gradients every frame. Reuse them; avoid
  `createRadialGradient` inside the frame loop.
- `ui.updateHud` runs every frame, so it **diffs against the last written values**
  and only touches the DOM when something changed. Keep that pattern — DOM writes
  in the loop are the expensive part.

When in doubt: do work once (on zone load) rather than once per frame.

## Conventions

- Keep it dependency-free and build-free. No npm packages, no frameworks.
- Match the existing ES5 / IIFE / `RPG.*` style; no `import`/`export`.
- Comments in this codebase are flavorful and explain *why*; match that tone and
  density rather than over-commenting.
- New content (zones, items, spells, NPCs) goes in the data files, not the engine.
- Update `DESIGN.md`'s roadmap/zone glossary when you add a region or system.
