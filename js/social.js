/* social.js — persuasion & disposition. Talking is a contest: your Personality
   (which Fortify Presence boosts!) plus Speechcraft, weighed against how the NPC
   already feels about you. Win and they warm to you, opening gated topics, gifts,
   and quests. This is the playground that makes Veilcraft's Fortify Presence the
   "become irresistible" trick. */

(function (RPG) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  const APPROACHES = {
    admire:    { label: "Admire",    win: 8,  lose: 3,  diff: 0,   cost: 0 },
    joke:      { label: "Joke",      win: 7,  lose: 4,  diff: 5,   cost: 0 },
    intimidate:{ label: "Intimidate",win: 14, lose: 12, diff: 10,  cost: 0 },
    bribe:     { label: "Bribe (10 vis)", win: 12, lose: 0, diff: -100, cost: 10 }
  };

  const Social = {
    approaches: APPROACHES,

    chance: function (game, npc, kind) {
      const a = APPROACHES[kind], p = game.player;
      const presence = p.attributes.Personality + p.effMag("presence");
      const skill = p.skills.Speechcraft.level;
      return clamp(Math.round(30 + (presence - 40) * 0.7 + skill * 0.8 + (npc.disposition - 50) * 0.2 - a.diff), 3, 97);
    },

    attempt: function (game, npc, kind) {
      const a = APPROACHES[kind], p = game.player;
      if (a.cost && p.vis < a.cost) { game.ui.toast(`Need ${a.cost} vis to bribe.`); return; }
      if (a.cost) p.vis -= a.cost;

      if (kind === "bribe") {
        npc.disposition = clamp(npc.disposition + a.win, 0, 100);
        game.setDisposition(npc, npc.disposition);
        game.ui.log(`${npc.name} pockets your offering. (Disposition ${npc.disposition})`, "good");
        return;
      }

      const c = this.chance(game, npc, kind);
      const roll = RPG.RNG.d100();
      p.trainSkill("Speechcraft", 1.0, game.ui);
      if (roll <= c) {
        npc.disposition = clamp(npc.disposition + a.win, 0, 100);
        game.ui.log(`${a.label} succeeds. ${npc.name} warms to you. (Disposition ${npc.disposition}) <span class="roll">(${roll}/${c})</span>`, "good");
      } else {
        npc.disposition = clamp(npc.disposition - a.lose, 0, 100);
        game.ui.log(`${a.label} falls flat. (Disposition ${npc.disposition}) <span class="roll">(${roll}/${c})</span>`, "miss");
      }
      game.setDisposition(npc, npc.disposition);
    }
  };

  RPG.Social = Social;
})(window.RPG = window.RPG || {});
