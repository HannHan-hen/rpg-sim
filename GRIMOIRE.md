# The Arts — Ashfall's Magic & Crafting Design

> Companion to DESIGN.md. This is the magic bible: the disciplines, the
> principles that make them fun, and — most importantly — the rule that keeps
> them *implementable*. Names are deliberately our own, not Morrowind's.

---

## Five guiding principles

These are the soul of it. Every decision below serves them.

1. **Effects are atoms.** A spell is one or more effects, each with a magnitude
   and (if timed) a duration. Cost scales with magnitude × duration; **success
   scales with skill**. This is the engine; everything else is content.

2. **Custom spells pay a "freedom tax."** Self-made spells are flexible but ~30%
   pricier and a touch harder than an equivalent crafted spell. So creating your
   own is powerful and creative — but **finding or buying a hand-tuned named spell
   is its own reward**, never obsolete. Discovery stays valuable.

3. **Named spells are treasures.** Unique NPCs sell/teach curated, multi-effect
   spells with whimsical names — cheaper and easier to cast than you could make,
   sometimes using effects you can't yet compose. *Guardian's Fury* (Bound Mace +
   Fortify Might), *Hare's Haste* (Quickening + Featherfall), *Silver Tongue*
   (Fortify Presence). The thrill is hunting them down.

4. **Deliberate cost-asymmetries → earned, emergent power.** Some effects are
   intentionally absurd value for their cost — *especially short-duration
   self-buffs* (Fortify Presence 50 for 2s to win any conversation; a 3-second
   leap). We do **not** hide or nerf these. The fun is the player *realizing* it.
   The ceiling is broken-but-earned: it still wants skill, mana, and understanding.

5. **No effect without a mechanic (the Morrowind lesson).** An effect only exists
   if it touches something the game actually simulates. This is the discipline
   that prevents "complexity for complexity's sake" and keeps us honest about what
   we can ship. Every effect below is tagged with the mechanic it needs and whether
   that mechanic exists yet.

---

## The five disciplines

Renamed and re-themed so we're not cloning the source. Each discipline gets its
own **summon** (see below), so summoning has variety instead of being one thin school.

| Discipline | Theme | (loose analog) | Sample effects | Summons |
|---|---|---|---|---|
| **Elementalism** | Raw elemental force | Destruction | Fire / Frost / Shock damage, walls, bursts | Elementals |
| **Sanctity** | Healing & blessing; light vs. the unclean | Restoration + holy | Heal, Ward (shield), Blessing of Might, Holy Smite (bonus vs. undead/demons) | Guardian spirit |
| **Astromancy** | Motion, space, perception | Mysticism + Alteration | Levitate, Featherfall, Quickening, Telekinesis, Clairvoyance, Recall/Teleport | Astral wisps |
| **Umbramancy** | Death, drain, corruption | Necromancy | Drain Life/Attribute, Curse (direct health damage), Fear, Reanimate | Undead / demons |
| **Veilcraft** | Illusion of the senses & mind | Illusion | Charm, Calm, Frenzy, Invisibility, Light, Fortify Presence | Phantasms / mirror-images |

### Effect → mechanic ledger (what's real vs. what's pending)

| Effect | Needs mechanic | Status |
|---|---|---|
| Fire/Frost/Shock damage | combat | ✅ have |
| Heal | combat/vitals | ✅ have |
| Ward (shield) | damage mitigation | ✅ have |
| Blessing of Might (fortify Strength) | melee damage | ✅ have |
| Quickening (fortify Speed) | movement | ✅ have |
| Levitate | movement vs. terrain | ✅ have (float over water) |
| Featherfall / Waterwalk | movement | ✅ trivial variants |
| Holy Smite (vs. undead/demons) | enemy "type" tags | 🔜 small add |
| Drain Life | combat + lifesteal | 🔜 small add |
| **Summon (any)** | allied-creature AI | ✅ **done** — allies reuse enemy AI with the target flipped; fade on a timer |
| **Calm** | aggro system | ✅ done (pacifies a foe for a duration) |
| Charm / Frenzy | NPC disposition | 🔜 disposition exists now; charm-on-NPC pending |
| **Fortify Presence** (win talks) | persuasion + barter | ✅ **done** — persuasion contest + disposition; Presence buffs it and discounts vendors |
| Clairvoyance | quest/map | ✅ done (skill-gated: quest markers + fast travel once you major in Astromancy) |
| Telekinesis | physics/pickup of distant items | ⛔ needs item-on-ground physics |
| Recall / Teleport | fast-travel network | ⛔ needs map system |

The right-hand column **is the build plan**: the schools light up as their
underlying systems land. We never add a spell that does nothing.

---

## Summoning — a cross-school art, not a school

Each discipline can summon its themed ally for a duration. This is far more
tractable than it sounds: **our enemies already have chase/attack AI.** A summon
is just a creature whose AI targets *enemies* instead of the player and despawns
when its timer ends. One AI, reused. That single insight gives every school a
summon without a "summoning school" that'd feel hollow.

---

## The crafting arts (item-based, non-combat)

- **Artifice (Enchanting).** Bind effects onto gear, paid in *vis* (essence from
  kills). ✅ basic version exists (weapon on-hit). Next: constant-effect apparel,
  soul-tiers limiting magnitude.
- **Spagyrics (Alchemy).** Brew potions **and pills** (wuxia) — and a Witcher-ish
  **toxicity** budget so you can't chug infinitely (self-limiting, gives identity).
  Elegant reuse: **a potion is a spell-in-a-bottle** — same effect atoms, no new
  effect code.
- **Herbalism.** Gather reagents from nodes in the world (plants, beast parts).
  Feeds Spagyrics. Implementable as harvest points in zones → reagents → recipes.

---

## Parked (honestly): Hearthcraft — the "practical" school

Cleaning, growing, cooking, transmuting ore, conjuring bricks. It's lovely, but it
only becomes *gameplay* if there's a base/survival sim for it to act on. So it's
deliberately tied to **Phase 5 (Base building)**: cooking → buffs, transmutation →
construction materials, growing → home-grown alchemy reagents. Building it before
the base exists would be charm with nothing to push against.

---

## Other ideas worth banking

- **Spell scrolls:** one-shot casts that ignore skill — let low-level players taste
  high-tier effects, and make superb loot. Tie to a "scribing" use of Artifice.
- **Discovery channels:** learn effects by reading tomes, buying from masters, or
  *witnessing* an NPC cast them. Reinforces the exploration pillar.
- **Ritual magic:** slow, out-of-combat, very powerful (teleport networks, a
  permanent minion) — keeps the broken stuff special and deliberate.
- **Identity via drawback:** Umbramancy is cheap but faction-hated/corrupting;
  Sanctity strong vs. undead, weaker on the living; Alchemy gated by toxicity.

---

## Build order for the Arts

1. ✅ **Done:** renamed schools; multi-effect spells; the freedom tax; a
   **spell-vendor NPC** selling named bargain spells.
2. ✅ **Done:** **Summoning** (friendly-AI creatures, one per school), **Calm**,
   a **persuasion/disposition** layer (Veilcraft + Fortify Presence + vendor
   discounts), and a **quest/map** layer (journal, world map, Astromancy-gated
   Clairvoyance & fast travel). First quest live: *The Thing in the Cave*.
3. **Soon (small adds on existing mechanics):** Shock (have it), Drain Life,
   Holy Smite + enemy type tags, Featherfall/Waterwalk, spell scrolls as loot,
   charm-on-NPC, more quests.
4. **Unlocked next:** **gathering + consumables** → Herbalism & Spagyrics;
   factions & reputation (Phase 3) building on disposition.
5. **Phase 5:** Hearthcraft with the base.
