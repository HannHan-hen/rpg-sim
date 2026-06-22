/* combat.js — Morrowind-style resolution. You click; the dice decide.
   Hit chance is built from weapon skill + agility + luck, scaled by how
   winded you are (fatigue), then weighed against the target's evasion. */

(function (RPG) {
  "use strict";

  const Data = RPG.Data;
  const SWING_FATIGUE_COST = 8;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Player evasion — also used as the number enemies roll against.
  function playerEvasion(p) {
    return p.attributes.Agility * 0.2 + p.skills.Block.level * 0.2 + p.attributes.Luck * 0.1;
  }

  const Combat = {
    // Called when the player clicks. Returns true if a swing happened.
    playerSwing: function (game) {
      const p = game.player;
      if (p.dead || p.attackTimer > 0) return false;

      const w = p.weapon();
      p.attackTimer = w.speed;
      p.fatigue = Math.max(0, p.fatigue - SWING_FATIGUE_COST);
      game.fx.swing(p.x, p.y, p.facing, w.reach);

      // Find the best target inside the weapon's reach and a forward arc.
      const target = this._targetInArc(game, p, w.reach + p.radius, Math.PI * 0.6);

      // Training: you learn a little from every swing, more from a connect.
      if (!target) {
        game.ui.log("You swing at empty air.", "miss");
        p.trainSkill(w.skill, 0.4, game.ui);
        return true;
      }

      const attack = (p.skills[w.skill].level + p.attributes.Agility * 0.2 + p.attributes.Luck * 0.1) * p.fatigueFactor();
      const chance = clamp(Math.round(attack - target.def.evasion + 35), 5, 95);
      const roll = RPG.RNG.d100();

      if (roll <= chance) {
        const str = p.attributes.Strength + p.effMag("strength");   // Fortify Strength counts
        let dmg = RPG.RNG.int(w.min, w.max) + Math.floor(str / 15);
        target.damage(dmg);
        game.fx.blood(target.x, target.y);
        game.ui.log(`You hit the ${target.name} for ${dmg}. <span class="roll">(${roll}/${chance})</span>`, "hit");

        // Enchanted weapons deliver a second, elemental bite.
        if (w.enchant) {
          const e = Data.effects[w.enchant.effect];
          target.damage(w.enchant.magnitude);
          game.fx.blood(target.x, target.y, e.color);
          game.ui.log(`${w.name.split(" [")[0]} sears for +${w.enchant.magnitude} ${e.name.split(" ")[0]}.`, "hit");
        }

        p.trainSkill(w.skill, 1.4, game.ui);
        if (target.dead) game.onEnemyDefeated(target);
      } else {
        game.ui.log(`You miss the ${target.name}. <span class="roll">(${roll}/${chance})</span>`, "miss");
        p.trainSkill(w.skill, 0.6, game.ui);
      }
      return true;
    },

    // Enemy tries to hit the player if in reach and off cooldown.
    enemyAttack: function (game, e) {
      const p = game.player;
      e.attackTimer = e.def.attackCooldown;
      const chance = clamp(Math.round(e.def.attackSkill - playerEvasion(p) + 25), 5, 95);
      const roll = RPG.RNG.d100();
      if (roll <= chance) {
        let dmg = RPG.RNG.int(e.def.damage[0], e.def.damage[1]);
        // Shield (Alteration) soaks a percentage of the blow.
        const sh = p.effMag("shield");
        if (sh > 0) dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.8, sh / 100))));
        p.damage(dmg, game.ui);
        game.fx.blood(p.x, p.y);
        game.ui.log(`The ${e.name} hits you for ${dmg}. <span class="roll">(${roll}/${chance})</span>`, "hurt");
      } else {
        game.ui.log(`The ${e.name} misses. <span class="roll">(${roll}/${chance})</span>`, "miss");
        // Dodging trains Block a little.
        p.trainSkill("Block", 0.5, game.ui);
      }
    },

    _targetInArc: function (game, p, reach, arc) {
      let best = null, bestD = Infinity;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > reach + e.radius) continue;
        let da = Math.atan2(dy, dx) - p.facing;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > arc) continue;
        if (dist < bestD) { bestD = dist; best = e; }
      }
      return best;
    },

    _nearestEnemy: function (game, p, range) {
      let best = null, bestD = range;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }
  };

  RPG.Combat = Combat;
})(window.RPG = window.RPG || {});
