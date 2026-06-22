/* data.js — static game data: attributes, skills, items, enemies, NPCs.
   Kept declarative so the world is easy to expand later. */

(function (RPG) {
  "use strict";

  RPG.Data = {
    // Core attributes (Morrowind-flavored, trimmed set).
    attributes: ["Strength", "Agility", "Endurance", "Speed", "Willpower", "Luck"],

    // Skills that improve through use.
    skills: {
      Blade:      { attr: "Strength", desc: "Swords and daggers." },
      Block:      { attr: "Agility",  desc: "Turning blows aside." },
      Athletics:  { attr: "Speed",    desc: "Running and moving." },
      Destruction:{ attr: "Willpower",desc: "Offensive magicka." },
      Restoration:{ attr: "Willpower",desc: "Mending wounds." },
      Alteration: { attr: "Willpower",desc: "Bending the world: shields, speed, levitation." }
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
      fire:     { name: "Fire Damage",      school: "Destruction", kind: "damage", color: "#ff8a2c", costPer: 0.5 },
      frost:    { name: "Frost Damage",     school: "Destruction", kind: "damage", color: "#7fd0ff", costPer: 0.5 },
      heal:     { name: "Restore Health",   school: "Restoration", kind: "heal",   color: "#7fd08c", costPer: 0.6 },
      shield:   { name: "Shield",           school: "Alteration",  kind: "buff", stat: "shield",   color: "#9ab8e0", costPer: 0.4, timed: true },
      swift:    { name: "Fortify Speed",    school: "Alteration",  kind: "buff", stat: "speed",    color: "#bfe6a0", costPer: 0.3, timed: true },
      might:    { name: "Fortify Strength", school: "Alteration",  kind: "buff", stat: "strength", color: "#f2c878", costPer: 0.35, timed: true },
      levitate: { name: "Levitate",         school: "Alteration",  kind: "buff", stat: "levitate", color: "#cdd8ff", costPer: 0.2, timed: true }
    },

    // Tuning knobs for the spell/enchant economy.
    magic: {
      castRange: 170,       // how far damage spells reach
      visPerMagnitude: 3,   // enchanting cost in "vis" (essence from kills) per magnitude point
      baseCost: 4           // flat magicka added to every spell
    },

    // Spells the player knows from the start (slots 1 and 2).
    startingSpells: [
      { name: "Firebite",   effect: "fire", magnitude: 8, duration: 0 },
      { name: "Lesser Mend", effect: "heal", magnitude: 14, duration: 0 }
    ],

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
