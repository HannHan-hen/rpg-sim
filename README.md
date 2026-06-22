# Ashfall — a tiny dice-driven RPG

A small top-down RPG inspired by Morrowind's spirit: **you click to attack, but the dice decide.**
Your skills get better the more you *use* them, fatigue makes you swing wild, and the whole
thing is drawn in code — no image files, no downloads of art packs, nothing to install.

Built to run on an **old, slow PC**: it's plain HTML, CSS and JavaScript using the 2D canvas.
If your computer can open a web page, it can run this.

---

## How to play it (two ways)

### Option A — just click a link (easiest, nothing to download)
Once this repo has GitHub Pages turned on (see below), the game lives at a web address like:

```
https://hannhan-hen.github.io/rpg-sim/
```

Open that in any browser. Done. Nothing to install.

### Option B — run it from your own PC (works offline)
1. On the GitHub page, click the green **`Code`** button → **Download ZIP**.
2. Unzip it anywhere (e.g. your Desktop).
3. Open the folder and **double-click `index.html`**. It opens in your browser and plays.

That's it. No Python, no installers, no command line.

---

## Controls

| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` or the arrow keys |
| Attack (the dice decide!) | **Click** with the mouse |
| Talk / interact | `E` |
| Character sheet | `C` |
| Cast Firebite (fire) | `1` |
| Cast Mend (heal) | `2` |
| Save | `F5` |
| Load | `F9` |

Watch your **Fatigue** bar — the more winded you are, the more you'll swing and miss.
Talk to **Telvi the Watcher** to catch your breath.

---

## How it's built (for the curious)

- `index.html` — the page and the on-screen panels (HUD, log, character sheet, dialogue).
- `css/style.css` — the parchment-and-gold UI styling.
- `js/rng.js` — the dice (a small seedable random generator).
- `js/data.js` — all the numbers: attributes, skills, weapons, spells, monsters.
- `js/world.js` — the dungeon map (a readable text grid) and collision.
- `js/entities.js` — the player and monsters; skills that level up through use.
- `js/combat.js` — Morrowind-style hit resolution (skill + agility + luck vs evasion, scaled by fatigue).
- `js/render.js` — **all the graphics, drawn in code**: tinted flagstones, faux-depth walls, flickering torchlight carved out of darkness, and particles.
- `js/ui.js` / `js/input.js` / `js/game.js` — interface, controls, and the main loop.

No external libraries. No build step. No assets to ship.

---

## Turning on the free web link (GitHub Pages) — one-time, ~30 seconds

1. In this repo on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's all. Every push to the game branch auto-publishes the latest version to the link above.

---

## What's here so far (a "vertical slice")

This is the playable foundation: one explorable hall, real movement, the full dice-combat
loop, skills that grow by use, a character sheet, an NPC with topic-based dialogue, particles
and lighting, and save/load. It's meant to prove the feel on your machine before we build outward
(more areas, story, loot, the eastern door...).
