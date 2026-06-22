/* zones.js — the world as DATA. Each zone is a small map (a text grid) plus
   its connections, inhabitants, and mood. New places = new entries here, no
   engine changes. This is how the island scales to Morrowind size.

   Map legend:
     #  stone wall      .  floor          ,  rubble (cosmetic floor)
     ~  water (block)   %  tree (block)   o  rock/pillar (block)
     t  wall torch      P  default spawn ("start" entry)
     1-9 portals        -> defined per-zone in `portals`

   Coordinates in `entries`, `npcs`, `enemies` are [column, row] tile indices.
   Ground/darkness/light per zone give outdoor daylight vs. cave gloom. */

(function (RPG) {
  "use strict";

  // ---- NPC definitions (shared; placed into zones by id) ----
  RPG.Npcs = {
    telvi: {
      name: "Telvi, Warden of the Landing",
      dialogue: {
        greeting: {
          text: "\"Another one off the boat. Welcome to the only shore you'll ever leave by — which is to say, never. Breathe. Then make yourself useful.\"",
          topics: [
            { label: "Where am I?", goto: "where" },
            { label: "Where can I go?", goto: "directions" },
            { label: "Can I get off the island?", goto: "escape" },
            { label: "Farewell.", action: (g, n, ui) => ui.closeDialogue() }
          ]
        },
        where: {
          text: "\"The Pit, the old hands call it. A prison with no walls but the sea. We made a life of it — towns, trade, a King down the coast who'd argue he's more than a convict in a crown.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        },
        directions: {
          text: "\"East gate takes you up to Harbor Town — good folk, the ones who never wandered. Beyond, the Coast Road. Mind the road south to the Capital; it's grander and meaner the farther you walk.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        },
        escape: {
          text: "\"Ha! No ship will carry a branded prisoner. The docks are a place to stare at the horizon and curse. Better to get strong and carve out something worth keeping.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        }
      }
    },

    maeve: {
      name: "Maeve, the Innkeeper",
      dialogue: {
        greeting: {
          text: "\"Fresh off the boat and still standing — good. Sit a while if you need. I keep this place for the folk who'd rather mend nets than swing swords.\"",
          topics: [
            { label: "Let me rest. (restore fatigue, heal)", action: (g, n, ui) => {
                g.player.fatigue = g.player.maxFatigue;
                g.player.hp = Math.min(g.player.maxHp, g.player.hp + 20);
                ui.log("You rest at the inn. (Fatigue restored, +20 health.)", "good");
                ui.showTopic(n, "greeting", g);
              } },
            { label: "Tell me about this place.", goto: "town" },
            { label: "What's down the coast?", goto: "capital" },
            { label: "Is there trouble I could help with?", goto: "quest" },
            { label: "[Friend] You've been kind to me.", req: { disp: 60 }, action: (g, n, ui) => {
                g.player.vis += 15; ui.log("Maeve presses a pouch of vis into your hand. (+15 vis)", "good");
                ui.showTopic(n, "greeting", g);
              } },
            { label: "Farewell.", action: (g, n, ui) => ui.closeDialogue() }
          ]
        },
        quest: {
          text: "\"Since you ask... something's been moving in the old Sunken Cave off the Coast Road. A walking heap of bones, by the screams. Put it down and I'll see you well rewarded.\"",
          topics: [
            { label: "I'll deal with it.", action: (g, n, ui) => { RPG.Quests.start(g, "clear_cave"); ui.showTopic(n, "greeting", g); } },
            { label: "Maybe later.", goto: "greeting" }
          ]
        },
        town: {
          text: "\"Harbor Town. We fish, we trade, we mind our own. The wilder sorts pass through on their way to somewhere they'll regret. Stay as long as you like — it's safe here, mostly.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        },
        capital: {
          text: "\"South, past the Coast Road, sits the Capital — towers and a palace and a King who fancies himself one. Grand, they say. I'll never see it. Grand and dangerous tend to travel together.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        }
      }
    },

    corin: {
      name: "Corin, Town Guard",
      dialogue: {
        greeting: {
          text: "\"Keep your blade sheathed in my town and we'll get along. You've the look of someone who'll wander. Everyone does, eventually.\"",
          topics: [
            { label: "Who's out there?", goto: "factions" },
            { label: "Any advice?", goto: "advice" },
            { label: "Farewell.", action: (g, n, ui) => ui.closeDialogue() }
          ]
        },
        factions: {
          text: "\"North, the Wilds — outlaws who want no part of any society. West, the Mages' Enclave, where they bend the world for sport. East, past the ash, the nomads camp by the volcanoes. And south, the King. Pick your friends carefully.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        },
        advice: {
          text: "\"The Coast Road east of town has rats and worse. Good place to learn which end of a sword to hold. There's an old cave off it too — folk go in for treasure, fewer come out.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        }
      }
    },

    spellmonger: {
      name: "Yrva, the Wandering Adept",
      dialogue: {
        greeting: {
          text: "\"Spells, traveller? I deal in workings already woven — cleaner and cheaper to cast than anything you'd cobble together yourself. Payment in vis. Be friendly and I'll knock the price down.\"",
          topics: [
            { label: "Hare's Haste — 18 vis", action: (g, n, ui) => { g.learnVendorSpell("hares_haste", n); ui.showTopic(n, "greeting", g); } },
            { label: "Guardian's Fury — 26 vis", action: (g, n, ui) => { g.learnVendorSpell("guardians_fury", n); ui.showTopic(n, "greeting", g); } },
            { label: "Emberlash — 14 vis", action: (g, n, ui) => { g.learnVendorSpell("emberlash", n); ui.showTopic(n, "greeting", g); } },
            { label: "Saint's Mending — 20 vis", action: (g, n, ui) => { g.learnVendorSpell("saints_mending", n); ui.showTopic(n, "greeting", g); } },
            { label: "Silver Tongue — 16 vis", action: (g, n, ui) => { g.learnVendorSpell("silver_tongue", n); ui.showTopic(n, "greeting", g); } },
            { label: "Kindle Ally — 24 vis", action: (g, n, ui) => { g.learnVendorSpell("kindle_ally", n); ui.showTopic(n, "greeting", g); } },
            { label: "Soothe — 14 vis", action: (g, n, ui) => { g.learnVendorSpell("soothe", n); ui.showTopic(n, "greeting", g); } },
            { label: "[Friend] Anything special for me?", req: { disp: 65 }, goto: "secret" },
            { label: "What is vis?", goto: "vis" },
            { label: "Farewell.", action: (g, n, ui) => ui.closeDialogue() }
          ]
        },
        secret: {
          text: "\"For a friend... take this one freely. A wisp of the astral, to fight at your side and light your way. Tell no one I give my art away.\"",
          topics: [
            { label: "Accept the gift.", action: (g, n, ui) => {
                if (g.player.knownSpells.some((s) => s.name === "Summon Wisp")) { ui.toast("You already have it."); }
                else { g.player.knownSpells.push(RPG.Magic.compose("Summon Wisp", [{ effect: "summon_wisp", magnitude: 10, duration: 30 }], { cost: 12, minSkill: 8 })); ui.log("Yrva teaches you Summon Wisp, freely.", "good"); }
                ui.showTopic(n, "greeting", g);
              } }
          ]
        },
        vis: {
          text: "\"Essence. It bleeds from things as they die and clings to those who do the killing. I weave it into spells; the enchanters bind it into steel. Go and make some more, hm?\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        }
      }
    }
  };

  // ---- Zone definitions ----
  RPG.Zones = {
    port_landing: {
      id: "port_landing",
      name: "Port Landing",
      ambient: { darkness: 0.16, ground: [74, 66, 50], light: 180 },
      rows: [
        "%%%%%%%%%%%%%%%%%%%%%%%%",
        "%......................%",
        "%...t..............t...%",
        "%......................%",
        "2.........P..........1.%",
        "%......................%",
        "%.......o......o.......%",
        "%......................%",
        "%......................%",
        "%...........2..........%",
        "%~~~~~~~~~~~~~~~~~~~~~~%",
        "%~~~~~~~~~~~~~~~~~~~~~~%",
        "%~~~~~~~~~~~~~~~~~~~~~~%",
        "%%%%%%%%%%%%%%%%%%%%%%%%"
      ],
      entries: { start: [10, 4], from_town: [19, 4] },
      portals: {
        "1": { to: "harbor_town", entry: "from_port" },
        "2": { locked: true, label: "The docks. No ship will carry a prisoner home." }
      },
      npcs: [{ at: [11, 8], id: "telvi" }],
      enemies: []
    },

    harbor_town: {
      id: "harbor_town",
      name: "Harbor Town",
      ambient: { darkness: 0.18, ground: [48, 66, 42], light: 180 },
      rows: [
        "%%%%%%%%%%%%%%%%%%%%%%%%",
        "%......................%",
        "%..####......####......%",
        "%..####......####......%",
        "%......................%",
        "%..t..............t....%",
        "%......................%",
        "1......................2",
        "%......................%",
        "%......................%",
        "%......................%",
        "%........####..........%",
        "%........####..........%",
        "%......................%",
        "%%%%%%%%%%%%%%%%%%%%%%%%"
      ],
      entries: { from_port: [3, 7], from_road: [20, 7] },
      portals: {
        "1": { to: "port_landing", entry: "from_town" },
        "2": { to: "coast_road", entry: "from_town" }
      },
      npcs: [{ at: [11, 9], id: "maeve" }, { at: [18, 7], id: "corin" }, { at: [13, 4], id: "spellmonger" }],
      enemies: [],
      containers: [{ at: [4, 9], label: "Supply Crate", items: ["glass_dagger"] }]
    },

    coast_road: {
      id: "coast_road",
      name: "The Coast Road",
      ambient: { darkness: 0.22, ground: [44, 60, 38], light: 170 },
      rows: [
        "%%%%%%%%%%%%%%%%%%%%%%%%",
        "%......................%",
        "%..%...%.....%....%....%",
        "%......................%",
        "%......................%",
        "%......................%",
        "%......o........o......%",
        "1..................2...%",
        "%......................%",
        "%......................%",
        "%...........3..........%",
        "%......................%",
        "%..%.......%......%....%",
        "%%%%%%%%%%%%%%%%%%%%%%%%"
      ],
      entries: { from_town: [3, 7], from_cave: [17, 7] },
      portals: {
        "1": { to: "harbor_town", entry: "from_road" },
        "2": { to: "sunken_cave", entry: "mouth" },
        "3": { locked: true, label: "The King's road south, toward the Capital. (Not yet — coming soon.)" }
      },
      npcs: [],
      enemies: [{ type: "rat", at: [8, 5] }, { type: "scrib", at: [15, 8] }]
    },

    sunken_cave: {
      id: "sunken_cave",
      name: "The Sunken Cave",
      ambient: { darkness: 0.84, ground: [34, 30, 24], light: 150 },
      rows: [
        "########################",
        "#......................#",
        "#..t................t..#",
        "#......................#",
        "1......................#",
        "#......................#",
        "#.....####.....####....#",
        "#......................#",
        "#..t................t..#",
        "#......................#",
        "#.........,,,..........#",
        "#......................#",
        "#..t................t..#",
        "########################"
      ],
      entries: { mouth: [2, 4] },
      portals: { "1": { to: "coast_road", entry: "from_cave" } },
      npcs: [],
      enemies: [{ type: "skeleton", at: [16, 8] }, { type: "rat", at: [6, 10] }],
      containers: [{ at: [11, 6], label: "Ancient Reliquary", items: ["ashbrand"] }]
    }
  };
})(window.RPG = window.RPG || {});
