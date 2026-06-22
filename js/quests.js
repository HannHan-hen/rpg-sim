/* quests.js — a small, data-driven quest tracker. Quests live in data.js;
   their objectives are matched against game events (kills, zone entry). The
   manager holds no content of its own — just the rules for advancing. */

(function (RPG) {
  "use strict";
  const Data = RPG.Data;

  const Quests = {
    start: function (game, id) {
      const q = Data.quests[id];
      if (!q || game.player.quests[id]) return;
      game.player.quests[id] = { stage: 0, progress: 0, done: false };
      game.ui.log(`New quest: ${q.name}.`, "good");
      game.ui.toast("Quest added: " + q.name);
    },

    has: function (game, id) { return !!game.player.quests[id]; },
    isDone: function (game, id) { return game.player.quests[id] && game.player.quests[id].done; },

    currentObjective: function (game, id) {
      const q = Data.quests[id], st = game.player.quests[id];
      if (!q || !st || st.done) return null;
      return q.stages[st.stage].objective;
    },

    onEnemyDefeated: function (game, enemy) {
      for (const id in game.player.quests) {
        const obj = this.currentObjective(game, id);
        if (!obj || obj.type !== "kill") continue;
        if (obj.target !== enemy.type) continue;
        if (obj.zone && obj.zone !== game.currentZone) continue;
        const st = game.player.quests[id];
        st.progress++;
        if (st.progress >= (obj.count || 1)) this._advance(game, id);
      }
    },

    onEnterZone: function (game, zoneId) {
      for (const id in game.player.quests) {
        const obj = this.currentObjective(game, id);
        if (obj && obj.type === "reach" && obj.zone === zoneId) this._advance(game, id);
      }
    },

    _advance: function (game, id) {
      const q = Data.quests[id], st = game.player.quests[id];
      st.stage++; st.progress = 0;
      if (st.stage >= q.stages.length) this._complete(game, id);
      else game.ui.log(`${q.name}: ${q.stages[st.stage].desc}`, "good");
    },

    _complete: function (game, id) {
      const q = Data.quests[id], st = game.player.quests[id];
      st.done = true;
      game.ui.log(`Quest complete: ${q.name}!`, "good");
      const r = q.reward || {};
      if (r.vis) { game.player.vis += r.vis; game.ui.log(`Reward: ${r.vis} vis.`, "good"); }
      if (r.guild) RPG.Guilds.setRank(game, r.guild.id, r.guild.rank);
      if (r.spell) {
        const v = Data.vendorSpells[r.spell];
        if (v && !game.player.knownSpells.some((s) => s.name === v.name)) {
          game.player.knownSpells.push(RPG.Magic.compose(v.name, v.effects, { cost: v.cost, minSkill: v.minSkill }));
          game.ui.log(`Reward: you learn ${v.name}!`, "good");
        }
      }
    },

    // Player has "the Sight" (quest markers + fast travel) once they major in Astromancy.
    clairvoyant: function (game) { return game.player.skills.Astromancy.level >= 20; }
  };

  RPG.Quests = Quests;
})(window.RPG = window.RPG || {});
