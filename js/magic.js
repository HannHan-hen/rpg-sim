/* magic.js — the spellcraft sandbox. A spell is a NAME plus a list of EFFECTS,
   each with magnitude (and duration, for timed buffs). Self-made spells pay a
   "freedom tax"; curated/vendor spells are hand-tuned bargains. Cost gates power;
   the governing school's skill gates reliability. Enchanting binds an effect onto
   a weapon, paid in "vis" harvested from the slain. */

(function (RPG) {
  "use strict";
  const Data = RPG.Data;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // The "weight" of one effect — drives both cost and which school governs.
  function effWeight(spec) {
    const e = Data.effects[spec.effect];
    const dur = e.timed ? (1 + (spec.duration || 0) / 8) : 1;
    return e.costPer * spec.magnitude * dur;
  }

  const Magic = {
    // Magicka cost of a list of effect specs. Custom spells cost extra.
    spellCost: function (effects, custom) {
      let c = Data.magic.baseCost;
      for (const s of effects) c += effWeight(s);
      if (custom) c *= Data.magic.freedomTax;
      return Math.max(1, Math.round(c));
    },

    // The school whose skill governs casting — the heaviest effect's school.
    governingSchool: function (effects) {
      let best = effects[0], bestW = -1;
      for (const s of effects) { const w = effWeight(s); if (w > bestW) { bestW = w; best = s; } }
      return Data.effects[best.effect].school;
    },

    // Build a spell from parts. opts: { custom, cost (override), minSkill }.
    compose: function (name, effects, opts) {
      opts = opts || {};
      effects = effects.map(function (s) {
        const e = Data.effects[s.effect];
        return { effect: s.effect, magnitude: clamp(Math.round(s.magnitude), 1, 100),
          duration: e.timed ? clamp(Math.round(s.duration || 1), 1, 60) : 0 };
      });
      const cost = (opts.cost != null) ? opts.cost : this.spellCost(effects, opts.custom);
      return { name: name, effects: effects, cost: cost, school: this.governingSchool(effects),
        custom: !!opts.custom, minSkill: opts.minSkill || 0 };
    },

    // Convenience for the single-effect spells the spellmaking UI creates.
    custom: function (name, effectId, magnitude, duration) {
      return this.compose(name, [{ effect: effectId, magnitude: magnitude, duration: duration }], { custom: true });
    },

    // Cast a spell instance. Returns true if it was attempted.
    cast: function (game, spell) {
      const p = game.player;
      if (p.dead || !spell) return false;
      if (p.magicka < spell.cost) { game.ui.log("Not enough magicka.", "miss"); return false; }
      p.magicka -= spell.cost;

      const skill = p.skills[spell.school] ? p.skills[spell.school].level : 5;
      const firstColor = Data.effects[spell.effects[0].effect].color;
      game.fx.spark(p.x, p.y, p.facing, firstColor);

      // Bigger spells are harder; skill tames them. Being below a taught spell's
      // recommended skill stings a little extra.
      const penalty = spell.minSkill && skill < spell.minSkill ? (spell.minSkill - skill) : 0;
      const chance = clamp(Math.round(25 + skill * 1.2 - spell.cost * 0.3 - penalty), 8, 98);
      const roll = RPG.RNG.d100();
      if (roll > chance) {
        game.ui.log(`${spell.name} sputters and fails. <span class="roll">(${roll}/${chance})</span>`, "miss");
        p.trainSkill(spell.school, 0.8, game.ui);
        return true;
      }

      // Resolve each effect. Damage effects share one target (the nearest foe).
      const hasDamage = spell.effects.some(function (s) { return Data.effects[s.effect].kind === "damage"; });
      const target = hasDamage ? this._nearest(game, p, Data.magic.castRange) : null;
      const parts = [];
      for (const s of spell.effects) {
        const e = Data.effects[s.effect];
        if (e.kind === "damage") {
          if (target) {
            target.damage(s.magnitude);
            game.fx.blood(target.x, target.y, e.color);
            parts.push(`${s.magnitude} ${e.name.split(" ")[0].toLowerCase()}`);
          }
        } else if (e.kind === "heal") {
          const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + s.magnitude);
          parts.push(`+${Math.round(p.hp - before)} health`);
        } else if (e.kind === "buff") {
          p.addEffect(e.stat, s.magnitude, s.duration, e);
          parts.push(`${e.name} ${s.magnitude} (${s.duration}s)`);
        }
      }

      if (hasDamage && !target) game.ui.log(`${spell.name} crackles into the dark.`, "miss");
      else game.ui.log(`${spell.name}: ${parts.join(", ")}. <span class="roll">(${roll}/${chance})</span>`, "good");
      if (target && target.dead) game.onEnemyDefeated(target);

      p.trainSkill(spell.school, 2.0, game.ui);
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
      w.enchant = { effect: effectId, magnitude: magnitude };
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
