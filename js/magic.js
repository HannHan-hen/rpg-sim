/* magic.js — the spellcraft sandbox. Spells are composed from EFFECTS (see
   data.js) with a chosen magnitude (and duration, for buffs). Cost and success
   scale so that mastery — not gear — is the path to absurd power. Enchanting
   binds an effect onto a weapon, paid for in "vis" harvested from the slain. */

(function (RPG) {
  "use strict";
  const Data = RPG.Data;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  const Magic = {
    // Magicka cost of a composed spell.
    spellCost: function (effectId, magnitude, duration) {
      const e = Data.effects[effectId];
      const dur = e.timed ? (1 + (duration || 0) / 8) : 1;
      return Math.max(1, Math.round(Data.magic.baseCost + e.costPer * magnitude * dur));
    },

    // Build a spell instance from parts.
    makeSpell: function (name, effectId, magnitude, duration) {
      const e = Data.effects[effectId];
      magnitude = clamp(Math.round(magnitude), 1, 100);
      duration = e.timed ? clamp(Math.round(duration || 1), 1, 60) : 0;
      return { name: name || e.name, effect: effectId, magnitude, duration,
        school: e.school, cost: this.spellCost(effectId, magnitude, duration) };
    },

    // Cast a spell instance. Returns true if it was attempted.
    cast: function (game, spell) {
      const p = game.player;
      if (p.dead || !spell) return false;
      const e = Data.effects[spell.effect];
      if (p.magicka < spell.cost) { game.ui.log("Not enough magicka.", "miss"); return false; }
      p.magicka -= spell.cost;
      game.fx.spark(p.x, p.y, p.facing, e.color);

      // Bigger, longer spells are harder; skill is what tames them.
      const chance = clamp(Math.round(25 + p.skills[e.school].level * 1.2 - spell.cost * 0.3), 10, 98);
      const roll = RPG.RNG.d100();
      if (roll > chance) {
        game.ui.log(`${spell.name} sputters and fails. <span class="roll">(${roll}/${chance})</span>`, "miss");
        p.trainSkill(e.school, 0.8, game.ui);
        return true;
      }

      if (e.kind === "damage") {
        const target = this._nearest(game, p, Data.magic.castRange);
        if (!target) { game.ui.log(`${spell.name} crackles into the dark.`, "miss"); }
        else {
          target.damage(spell.magnitude);
          game.fx.blood(target.x, target.y, e.color);
          game.ui.log(`${spell.name} hits the ${target.name} for ${spell.magnitude}. <span class="roll">(${roll}/${chance})</span>`, "hit");
          if (target.dead) { game.onEnemyDefeated(target); }
        }
      } else if (e.kind === "heal") {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + spell.magnitude);
        game.fx.spark(p.x, p.y, p.facing, e.color);
        game.ui.log(`${spell.name} mends ${Math.round(p.hp - before)} health.`, "good");
      } else if (e.kind === "buff") {
        p.addEffect(e.stat, spell.magnitude, spell.duration, e);
        game.ui.log(`${spell.name}: ${e.name} ${spell.magnitude} for ${spell.duration}s.`, "good");
      }

      p.trainSkill(e.school, 2.0, game.ui);
      return true;
    },

    // Bind an effect onto the equipped weapon. Costs vis (essence from kills).
    enchantWeapon: function (game, effectId, magnitude) {
      const p = game.player;
      const w = p.equippedWeapon;
      if (!w) { game.ui.toast("Nothing equipped to enchant."); return false; }
      magnitude = clamp(Math.round(magnitude), 1, 50);
      const cost = magnitude * Data.magic.visPerMagnitude;
      if (p.vis < cost) { game.ui.toast(`Need ${cost} vis (have ${Math.floor(p.vis)}).`); return false; }
      p.vis -= cost;
      w.enchant = { effect: effectId, magnitude };
      const e = Data.effects[effectId];
      w.name = w.baseName + ` [${e.name.split(" ")[0]} ${magnitude}]`;
      game.ui.log(`You bind ${e.name} (${magnitude}) into your ${w.baseName}.`, "good");
      return true;
    },

    _nearest: function (game, p, range) {
      let best = null, bestD = range;
      for (const en of game.enemies) {
        if (en.dead) continue;
        const d = Math.hypot(en.x - p.x, en.y - p.y);
        if (d < bestD) { bestD = d; best = en; }
      }
      return best;
    }
  };

  RPG.Magic = Magic;
})(window.RPG = window.RPG || {});
