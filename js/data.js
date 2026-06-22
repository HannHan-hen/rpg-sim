/* data.js — static game data: attributes, skills, items, enemies, NPCs.
   Kept declarative so the world is easy to expand later. */

(function (RPG) {
  "use strict";

  RPG.Data = {
    // Core attributes (Morrowind-flavored, trimmed set).
    attributes: ["Strength", "Agility", "Endurance", "Speed", "Willpower", "Personality", "Luck"],

    // Skills that improve through use.
    skills: {
      Blade:        { attr: "Strength", desc: "Swords and daggers." },
      Block:        { attr: "Agility",  desc: "Turning blows aside." },
      Athletics:    { attr: "Speed",    desc: "Running and moving." },
      Elementalism: { attr: "Willpower",desc: "Raw elemental force — fire, frost, shock." },
      Sanctity:     { attr: "Willpower",desc: "Healing, wards, and blessings; light against the unclean." },
      Astromancy:   { attr: "Willpower",desc: "Motion and space — swiftness, levitation, the astral, sight." },
      Veilcraft:    { attr: "Personality",desc: "Illusions of sense and mind — presence, calm." },
      Speechcraft:  { attr: "Personality",desc: "Swaying others in conversation." }
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
      levitate: { name: "Levitate",         school: "Astromancy",   kind: "buff", stat: "levitate", color: "#cdd8ff", costPer: 0.2, timed: true },
      presence: { name: "Fortify Presence", school: "Veilcraft",    kind: "buff", stat: "presence", color: "#e8a0d0", costPer: 0.5, timed: true },
      calm:     { name: "Calm",             school: "Veilcraft",    kind: "calm",                    color: "#a6c4ec", costPer: 0.6, timed: true },
      summon_flame:    { name: "Summon Flame Spirit", school: "Elementalism", kind: "summon", creature: "flame_spirit", color: "#ff8a2c", costPer: 0.55, timed: true },
      summon_guardian: { name: "Summon Guardian",     school: "Sanctity",     kind: "summon", creature: "guardian",     color: "#ffe0a0", costPer: 0.6,  timed: true },
      summon_wisp:     { name: "Summon Wisp",         school: "Astromancy",   kind: "summon", creature: "wisp",         color: "#cdd8ff", costPer: 0.5,  timed: true }
    },

    // Summonable allies. Their AI is the enemy AI with its target flipped to foes.
    // Magnitude scales the summon's vitality and bite.
    summons: {
      flame_spirit: { name: "Flame Spirit",   color: "#ff7a2c", speed: 72, reach: 24, attackCooldown: 0.9, attackSkill: 45, damage: [2, 4], radius: 9,  baseHp: 10 },
      guardian:     { name: "Guardian Spirit", color: "#ffe6b0", speed: 60, reach: 26, attackCooldown: 1.0, attackSkill: 55, damage: [3, 6], radius: 10, baseHp: 18 },
      wisp:         { name: "Astral Wisp",     color: "#cdd8ff", speed: 96, reach: 20, attackCooldown: 0.7, attackSkill: 50, damage: [1, 3], radius: 7,  baseHp: 8 }
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
      },
      silver_tongue: {
        name: "Silver Tongue", price: 16, minSkill: 8,
        effects: [{ effect: "presence", magnitude: 40, duration: 6 }],
        cost: 12, blurb: "Six golden seconds in which no one can refuse you."
      },
      kindle_ally: {
        name: "Kindle Ally", price: 24, minSkill: 12,
        effects: [{ effect: "summon_flame", magnitude: 12, duration: 25 }],
        cost: 16, blurb: "A flame spirit to fight at your side."
      },
      soothe: {
        name: "Soothe", price: 14, minSkill: 8,
        effects: [{ effect: "calm", magnitude: 10, duration: 8 }],
        cost: 10, blurb: "Still the fury of a single foe."
      }
    },

    // Quests. Objectives are checked against game events (kills, zone entry).
    quests: {
      clear_cave: {
        name: "The Thing in the Cave",
        giver: "maeve",
        summary: "Maeve asked you to deal with whatever stalks the Sunken Cave.",
        stages: [
          { desc: "Slay the Bonewalker in the Sunken Cave.", objective: { type: "kill", target: "skeleton", zone: "sunken_cave", count: 1 } }
        ],
        reward: { vis: 25, spell: "saints_mending" }
      },
      gw_wolves: {
        name: "Wolves on the Reach Road",
        giver: "steward", guild: "wardens",
        summary: "The Wardens' Concord asked you to cull the wolves harrying the Reach Road.",
        stages: [
          { desc: "Cull 3 Ashen Wolves on the Reach Road.", objective: { type: "kill", target: "wolf", zone: "reach_road", count: 3 } }
        ],
        reward: { vis: 20, guild: { id: "wardens", rank: 1 } }
      },
      gw_toll: {
        name: "The Bandit Toll",
        giver: "steward", guild: "wardens",
        summary: "Bandits are taxing the road south. The Concord wants their chief dealt with.",
        stages: [
          { desc: "Slay the Bandit Chief at the camp east of Greenhollow.", objective: { type: "kill", target: "bandit_chief", zone: "bandit_camp", count: 1 } }
        ],
        reward: { vis: 40, spell: "guardians_fury", guild: { id: "wardens", rank: 2 } }
      }
    },

    // Guilds: a faction per city, with ranks you climb through their questline.
    guilds: {
      wardens: {
        name: "the Wardens' Concord", town: "Greenhollow",
        blurb: "Lawful protectors of the Tilled Reaches — they keep roads safe and ledgers honest.",
        ranks: ["Associate", "Hand", "Warden", "Marshal"]
      }
    },


    // Character creation: the crime that got you banished shapes your build.
    backgrounds: {
      sedition: {
        name: "Sedition", crime: "You spoke against the Ordinate.",
        blurb: "A sharp tongue and sharper ideas. The state has no humour.",
        attrs: { Personality: 10, Willpower: 5 }, skills: { Speechcraft: 10, Astromancy: 8 },
        spell: "silver_tongue", vis: 0
      },
      smuggling: {
        name: "Smuggling", crime: "You moved what the Ordinate forbade.",
        blurb: "Quick feet, quick hands, no questions asked.",
        attrs: { Speed: 10, Agility: 5 }, skills: { Blade: 8, Athletics: 10 },
        item: "glass_dagger", vis: 10
      },
      forbidden_magic: {
        name: "Forbidden Magic", crime: "You practiced proscribed arts.",
        blurb: "You learned what they burned the books to hide.",
        attrs: { Willpower: 12 }, skills: { Elementalism: 10, Veilcraft: 6 },
        spell: "emberlash", vis: 0
      },
      debt: {
        name: "Ruinous Debt", crime: "You owed more than a life is worth.",
        blurb: "Down on your luck, but not yet out. You start with coin in hand.",
        attrs: { Luck: 10, Personality: 6 }, skills: { Block: 6, Athletics: 6 },
        vis: 30
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
      },
      wolf: {
        name: "Ashen Wolf", maxHp: 18, speed: 66, color: "#8a8276",
        attackSkill: 34, evasion: 20, damage: [2, 5], reach: 22,
        attackCooldown: 0.9, xp: 8, radius: 10, aggroRange: 210
      },
      bandit: {
        name: "Bandit", maxHp: 26, speed: 50, color: "#9a6b4a",
        attackSkill: 40, evasion: 18, damage: [3, 7], reach: 26,
        attackCooldown: 1.1, xp: 12, radius: 10, aggroRange: 190
      },
      bandit_chief: {
        name: "Bandit Chief", maxHp: 60, speed: 52, color: "#b5482f",
        attackSkill: 55, evasion: 24, damage: [6, 12], reach: 30,
        attackCooldown: 1.1, xp: 35, radius: 12, aggroRange: 250
      }
    }
  };
})(window.RPG = window.RPG || {});
