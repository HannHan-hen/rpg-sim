/* guilds.js — factions you can join and climb. Each city hosts one (data in
   data.js). Rank is advanced by completing the guild's quests. Built on the
   same disposition/quest plumbing so the pattern stamps across the island. */

(function (RPG) {
  "use strict";
  const Data = RPG.Data;

  const Guilds = {
    isMember: function (game, id) { return !!game.player.guilds[id]; },

    join: function (game, id) {
      const g = Data.guilds[id];
      if (!g || this.isMember(game, id)) return;
      game.player.guilds[id] = { rank: 0, rep: 0 };
      game.ui.log(`You join ${g.name}. Rank: ${g.ranks[0]}.`, "good");
      game.ui.toast("Joined " + g.name);
    },

    // Promote to at least `rank` (never demote). Called from quest rewards.
    setRank: function (game, id, rank) {
      const g = Data.guilds[id], m = game.player.guilds[id];
      if (!g || !m) return;
      if (rank > m.rank) {
        m.rank = rank;
        game.ui.log(`The ${g.name} promote you to ${g.ranks[rank]}.`, "good");
        game.ui.toast("Promoted: " + g.ranks[rank]);
      }
    },

    rankName: function (game, id) {
      const g = Data.guilds[id], m = game.player.guilds[id];
      return (g && m) ? g.ranks[m.rank] : null;
    }
  };

  RPG.Guilds = Guilds;
})(window.RPG = window.RPG || {});
