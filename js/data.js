/* data.js — static game data: attributes, skills, items, enemies, NPCs.
   Kept declarative so the world is easy to expand later. */

(function (RPG) {
  "use strict";

  RPG.Data = {
    // Core attributes (Morrowind-flavored, trimmed set).
    attributes: ["Strength", "Agility", "Endurance", "Speed", "Willpower", "Luck"],

    // Skills that improve through use.
    skills: {
      Blade:        { attr: "Strength", desc: "Swords and daggers." },
      Block:        { attr: "Agility",  desc: "Turning blows aside." },
      Athletics:    { attr: "Speed",    desc: "Running and moving." },
      Elementalism: { attr: "Willpower",desc: "Raw elemental force — fire, frost, shock." },
      Sanctity:     { attr: "Willpower",desc: "Healing, wards, and blessings; light against the unclean." },
      Astromancy:   { attr: "Willpower",desc: "Motion and space — swiftness, levitation, the astral." }
    },

    // XP needed to advance a skill by one level scales with current level.
    skillXpFor: function (level) { return 8 + level * 4; },

    weapons: {
      rusty_dagger: { name: "Rusty Dagger", skill: "Blade", min: 2, max: 6,  reach: 26, speed: 0.42 },
      iron_sword:   { name: "Iron Sword",   skill: "Blade", min: 4, max: 11, reach: 32, speed: 0.55 },
      glass_dagger: { name: "Glass Dagger", skill: "Blade", min: 5, max: 9,  reach: 26, speed: 0.34 },
      // A "weird sword" — found, named, already humming with a little fire.
      ashbrand:     { name: "Ashbrand", skill: "Blade", min: 6, max: 14, reach: 34, speed: 0.5,
                      innateEnchant: { effect: "fire", magnitude: 6 } }
    },

    // Magic effects you can compose into custom spells (and enchantments).
    // costPer is the magicka cost per point of magnitude.
    effects: {
      fire:     { name: "Fire Damage",      school: "Elementalism", kind: "damage", color: "#ff8a2c", costPer: 0.5 },
      frost:    { name: "Frost Damage",     school: "Elementalism", kind: "damage", color: "#7fd0ff", costPer: 0.5 },
      shock:    { name: "Shock Damage",     school: "Elementalism", kind: "damage", color: "#d6b3ff", costPer: 0.55 },
      heal:     { name: "Restore Health",   school: "Sanctity",     kind: "heal",   color: "#7fd08c", costPer: 0.6 },
      ward:     { name: "Ward",             school: "Sanctity",     kind: "buff", stat: "shield",   color: "#9ab8e0", costPer: 0.4, timed: true },
      might:    { name: "Blessing of Might",school: "Sanctity",     kind: "buff", stat: "strength", color: "#f2c878", costPer: 0.35, timed: true },
      quicken:  { name: "Quickening",       school: "Astromancy",   kind: "buff", stat: "speed",    color: "#bfe6a0", costPer: 0.3, timed: true },
      levitate: { name: "Levitate",         school: "Astromancy",   kind: "buff", stat: "levitate", color: "#cdd8ff", costPer: 0.2, timed: true }
    },

    // Tuning knobs for the spell/enchant economy.
    magic: {
      castRange: 170,       // how far damage spells reach
      visPerMagnitude: 3,   // enchanting cost in "vis" (essence from kills) per magnitude point
      baseCost: 4,          // flat magicka added to every spell
      freedomTax: 1.3       // custom (self-made) spells cost this multiple — named spells are bargains
    },

    // Spells the player knows from the start.
    startingSpells: [
      { name: "Emberbite",   effects: [{ effect: "fire", magnitude: 8 }] },
      { name: "Lesser Mend", effects: [{ effect: "heal", magnitude: 14 }] }
    ],

    // Curated, multi-effect "treasure" spells taught by unique NPCs. Hand-tuned
    // to be cheaper/easier than an equivalent self-made spell. Priced in vis.
    vendorSpells: {
      hares_haste: {
        name: "Hare's Haste", price: 18, minSkill: 10,
        effects: [{ effect: "quicken", magnitude: 30, duration: 8 }, { effect: "levitate", magnitude: 5, duration: 8 }],
        cost: 14, blurb: "Run like the wind and skim the very water."
      },
      guardians_fury: {
        name: "Guardian's Fury", price: 26, minSkill: 12,
        effects: [{ effect: "might", magnitude: 20, duration: 20 }, { effect: "ward", magnitude: 15, duration: 20 }],
        cost: 22, blurb: "The blessing of warriors: strong of arm, hard to fell."
      },
      emberlash: {
        name: "Emberlash", price: 14, minSkill: 8,
        effects: [{ effect: "fire", magnitude: 16 }],
        cost: 9, blurb: "A miser's firebolt — more burn for less breath."
      },
      saints_mending: {
        name: "Saint's Mending", price: 20, minSkill: 10,
        effects: [{ effect: "heal", magnitude: 28 }],
        cost: 14, blurb: "A deep, cheap healing the temples guard jealously."
      }
    },

    enemies: {
      rat: {
        name: "Diseased Rat", maxHp: 14, speed: 46, color: "#7a6a55",
        attackSkill: 28, evasion: 12, damage: [1, 4], reach: 22,
        attackCooldown: 1.1, xp: 6, radius: 9, aggroRange: 150
      },
      scrib: {
        name: "Scrib", maxHp: 22, speed: 38, color: "#cfd3a0",
        attackSkill: 35, evasion: 18, damage: [2, 6], reach: 24,
        attackCooldown: 1.4, xp: 11, radius: 11, aggroRange: 170
      },
      skeleton: {
        name: "Bonewalker", maxHp: 38, speed: 52, color: "#dad2c2",
        attackSkill: 45, evasion: 22, damage: [4, 9], reach: 28,
        attackCooldown: 1.2, xp: 20, radius: 11, aggroRange: 210
      }
    }
  };
})(window.RPG = window.RPG || {});
