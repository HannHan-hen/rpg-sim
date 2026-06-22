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
      Restoration:{ attr: "Willpower",desc: "Mending wounds." }
    },

    // XP needed to advance a skill by one level scales with current level.
    skillXpFor: function (level) { return 8 + level * 4; },

    weapons: {
      rusty_dagger: { name: "Rusty Dagger", skill: "Blade", min: 2, max: 6,  reach: 26, speed: 0.42 },
      iron_sword:   { name: "Iron Sword",   skill: "Blade", min: 4, max: 11, reach: 32, speed: 0.55 }
    },

    spells: {
      firebite: { name: "Firebite", skill: "Destruction", cost: 8, min: 6, max: 12, range: 150 },
      mend:     { name: "Mend",     skill: "Restoration", cost: 10, heal: [10, 18] }
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
