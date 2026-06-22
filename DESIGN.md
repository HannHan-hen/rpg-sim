# Ashfall — Design Blueprint

> A living document. This is the shared map between the human (Hann) and the AI
> builders. It records the vision, the world, the mechanics, and — crucially —
> the **order** we build them in so the game is always playable.

---

## 1. The pitch

You are a **prisoner**, banished by ship to a remote prison island with no way
home. The island is riddled with caves and ruins, and over generations the exiles
built a society inside and atop them — rough, lawless in places, but it *works*.

There is no main quest forcing your hand. The fun is **exploration, growing
powerful, and carving out your place**: join a faction, master absurd magic,
gather companions, build a base, and collect strange swords.

Tone & influences:
- **Exile / Escape from the Pit** — a prison-island society in the caves; survival and discovery.
- **Morrowind** — go anywhere, dense weird lore, use-based skills, *ridiculous* spellcrafting & enchanting.
- **Lufia** — warmth, charm, puzzle-flavored dungeons.
- **Dragon Age** — companions with their own voices; factions you can court or betray.

---

## 2. The island (world geography)

The world is a connected graph of zones. Difficulty and strangeness rise as you
travel away from the port where every prisoner first lands.

```
                              [ NORTH: The Wilds ]
                         outlaws, the lawless, brigand camps
                                      |
   [ WEST: The Mages' Enclave ]       |        [ EAST: Ashlands ]
   wizard towers, forbidden            \       nomads, volcanoes,
   alteration & enchanting        ------+------  ash-ghouls, strange
            \                           |        relics
             \                          |
              [ CENTRAL COAST ]  <-- you start here
              Port Landing -> Harbor Town -> Coast Road
              peaceful, low threat, the people who never left the docks
                                      |
                              [ SOUTH: The Capital ]
                       grand walled city, a palace, a King,
                       ambition, intrigue, the seat of power
```

**Starting region (built first):** the calm central coast — Port Landing (arrival),
Harbor Town (first village), the Coast Road, and a Sunken Cave. Low monsters, the
most peace-loving exiles, signposts toward everything bigger.

**Later regions:** The Capital (south), The Mages' Enclave (west), The Wilds
(north), The Ashlands (east). Each is a cluster of zones with its own faction,
look, threats, and rewards.

---

## 3. Design pillars (what the game is *about*)

1. **Exploration is the reward.** Every direction leads somewhere with its own
   flavor, secrets, and danger curve. The map is the content.
2. **Power fantasy through mastery.** Use-based skills (Morrowind). You get strong
   by *doing*, and the absurd ceiling of magic/enchanting is the payoff.
3. **Belonging & choice.** Factions to court or betray; companions who travel with
   you; a base you make your own.
4. **Strange treasure.** Weird, named, enchanted gear worth hunting for.

---

## 4. Mechanics roadmap (build order)

Each phase keeps the game fully playable. We don't move on until the current
phase is fun.

- **Phase 0 — Vertical slice** ✅ *(done)*
  Movement, dice combat, use-based skills, fatigue, lighting, save/load, one hall.

- **Phase 1 — The world becomes a place** ⏳ *(in progress)*
  Data-driven **zone system**: many small maps connected by doors/edges. Persistent
  player across zones. Travel + per-zone state in saves. The peaceful starting
  region (Port Landing → Harbor Town → Coast Road → Sunken Cave), populated with
  NPCs who hint at the wider island. Outdoor vs cave ambience (light, ground, water).

- **Phase 2 — Loot & the magic dream** 🔮 *(next; Hann's priority)*
  Inventory & equipment. Found/named weapons ("weird swords"). Then the big one:
  **spellmaking & enchanting** — combine effects (fire, frost, *alteration*:
  levitate, open lock, jump, fortify), pick magnitude/duration/area, and pay for it
  in magicka. Bind effects to gear via enchanting. The intentionally-broken
  Morrowind sandbox.

- **Phase 3 — Factions & reputation**
  Join the King's men, the Mages' Enclave, the northern outlaws, the eastern
  nomads. Reputation, faction quests, gear, and consequences.

- **Phase 4 — Companions**
  Recruitable allies who fight beside you, comment on the world, and have arcs
  (Dragon Age flavored). *(Hann flagged this as a later thing.)*

- **Phase 5 — Base building**
  Claim and furnish a home — storage, a workshop for enchanting, eventually
  followers who live there.

- **Ongoing — Content & polish**
  More zones, quests, enemies, lore books, sound, and procedural fill so the
  island keeps growing.

---

## 5. Technical foundation (how AI keeps this scalable)

- **Zero dependencies, runs in any browser, no install.** Pure HTML/CSS/JS canvas.
  Deployed to GitHub Pages; also works by opening `index.html`.
- **Everything is data.** Zones, NPCs, dialogue, items, spells, factions live in
  declarative data files (`js/zones.js`, `js/data.js`, ...). New content = new data,
  not new engine code. This is what lets an AI author breadth quickly.
- **Procedural where it scales.** Floor/terrain detail, lighting, and (later) some
  zone interiors are generated, not hand-pixeled.
- **Always playable.** Each phase ships working; saves carry forward.

---

## 6. Glossary of zones (grows over time)

| id             | region        | mood           | notes                              |
|----------------|---------------|----------------|------------------------------------|
| port_landing   | Central Coast | calm, outdoor  | where you arrive; no monsters      |
| harbor_town    | Central Coast | calm, outdoor  | first village; vendor, guard, lore |
| coast_road     | Central Coast | mild, outdoor  | a few weak monsters; branches      |
| sunken_cave    | Central Coast | dark, cave     | the original hall; optional delve  |
| *(more to come: the Capital, Enclave, Wilds, Ashlands...)*               |
