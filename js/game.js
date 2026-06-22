/* game.js — wires everything together: world, player, enemies, NPCs, the
   render loop, enemy AI, interaction, and save/load. This is the conductor;
   the systems it calls live in the other files. */

(function (RPG) {
  "use strict";

  function Game() {
    this.canvas = document.getElementById("screen");
    this.renderer = new RPG.Renderer(this.canvas);
    this.ui = new RPG.UI();
    this.fx = new RPG.FX();
    this.overlayUp = true;
    this.last = 0;

    this.input = new RPG.Input(this);
    this._bindOverlay();
    this.reset();

    // Render loop runs continuously; the world only ticks once you've entered.
    requestAnimationFrame((t) => this._frame(t));
  }

  // Build a fresh world + actors.
  Game.prototype.reset = function () {
    RPG.RNG.reseed((Math.random() * 1e9) | 0);
    this.world = new RPG.World();
    const sp = this.world.spawns;
    this.player = new RPG.Player(sp.player.x, sp.player.y);
    this.enemies = sp.enemies.map((e) => new RPG.Enemy(e.type, e.x, e.y));
    this.npcs = sp.npcs.map((n) => this._makeNpc(n.x, n.y));
    this.fx = new RPG.FX();
  };

  Game.prototype._makeNpc = function (x, y) {
    const npc = {
      name: "Telvi the Watcher", x, y, radius: 10, isNpc: true,
      dialogue: {
        greeting: {
          text: "\"You woke at last. The ash took your name but not your sword-arm. Speak, if you've breath.\"",
          topics: [
            { label: "Where am I?", goto: "where" },
            { label: "Any advice for a fight?", goto: "advice" },
            { label: "Let me rest a moment.", action: (g, n, ui) => {
                g.player.fatigue = g.player.maxFatigue;
                g.player.hp = Math.min(g.player.maxHp, g.player.hp + 10);
                ui.log("You catch your breath. (Fatigue restored, +10 health.)", "good");
                ui.showTopic(n, "greeting", g);
              } },
            { label: "Farewell.", action: (g, n, ui) => ui.closeDialogue() }
          ]
        },
        where: {
          text: "\"The Sunken Hall, beneath Ashfall. Things crawl here now. The eastern door leads deeper — mind the bones.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        },
        advice: {
          text: "\"Your blade decides nothing — the dice do. Tire yourself out and you'll swing at shadows. Watch your fatigue, and you'll land true.\"",
          topics: [{ label: "Back.", goto: "greeting" }]
        }
      }
    };
    return npc;
  };

  Game.prototype._bindOverlay = function () {
    const overlay = document.getElementById("overlay");
    const start = document.getElementById("btn-start");
    const load = document.getElementById("btn-load");
    start.onclick = () => { this.overlayUp = false; overlay.classList.add("hidden"); this.ui.log("You enter the Sunken Hall.", "good"); };
    load.onclick = () => {
      if (this.load()) { this.overlayUp = false; overlay.classList.add("hidden"); }
      else this.ui.toast("No save found.");
    };
    load.style.display = RPG.Save.has() ? "block" : "none";
  };

  Game.prototype._frame = function (t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    if (!this.overlayUp && !this.ui.dialogueOpen) this.update(dt);
    this.fx.update(dt);
    this.renderer.draw(this, dt);
    this.ui.updateHud(this.player);
    requestAnimationFrame((tt) => this._frame(tt));
  };

  Game.prototype.update = function (dt) {
    const p = this.player;

    // Face the cursor.
    const cam = this.renderer.cam;
    p.facing = Math.atan2(this.input.mouse.y + cam.y - p.y, this.input.mouse.x + cam.x - p.x);

    // Movement.
    if (!p.dead) {
      const mv = this.input.moveVector();
      if (mv.dx || mv.dy) {
        const len = Math.hypot(mv.dx, mv.dy);
        const step = p.moveSpeed * dt;
        this.world.moveCircle(p, (mv.dx / len) * step, (mv.dy / len) * step);
        p.fatigue = Math.max(0, p.fatigue - 4 * dt);     // moving tires you a little
        p.trainSkill("Athletics", 0.25 * dt, this.ui);   // and trains Athletics
      }
    }

    // Timers + regen.
    if (p.attackTimer > 0) p.attackTimer -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    p.fatigue = Math.min(p.maxFatigue, p.fatigue + 9 * dt);     // recover over time
    p.magicka = Math.min(p.maxMagicka, p.magicka + 2.5 * dt);

    this._updateEnemies(dt);
  };

  Game.prototype._updateEnemies = function (dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;

      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);

      if (!e.aggro && dist < e.def.aggroRange && !p.dead) e.aggro = true;

      if (e.aggro && !p.dead) {
        const reach = e.def.reach + p.radius;
        if (dist > reach * 0.8) {
          const step = e.def.speed * dt;
          this.world.moveCircle(e, (dx / dist) * step, (dy / dist) * step);
        } else if (e.attackTimer <= 0) {
          RPG.Combat.enemyAttack(this, e);
        }
      } else {
        // Idle wander.
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) { e.wanderAngle = Math.random() * Math.PI * 2; e.wanderTimer = 1 + Math.random() * 2; }
        const step = e.def.speed * 0.35 * dt;
        this.world.moveCircle(e, Math.cos(e.wanderAngle) * step, Math.sin(e.wanderAngle) * step);
      }
    }
  };

  // E key: talk to a nearby NPC, or step through the eastern door.
  Game.prototype.tryInteract = function () {
    const p = this.player;
    for (const n of this.npcs) {
      if (Math.hypot(n.x - p.x, n.y - p.y) < 42) { this.ui.openDialogue(n, this); return; }
    }
    const exit = this.world.spawns.exit;
    if (exit && Math.hypot(exit.x - p.x, exit.y - p.y) < 40) {
      this.ui.toast("The eastern door is sealed... for now. (More to come!)");
      return;
    }
    this.ui.toast("Nothing to interact with here.");
  };

  // ---------- Save / load ----------
  Game.prototype.save = function () {
    const p = this.player;
    const state = {
      seed: RPG.RNG.seed,
      player: {
        x: p.x, y: p.y, hp: p.hp, magicka: p.magicka, fatigue: p.fatigue,
        level: p.level, attributes: p.attributes, skills: p.skills, equipped: p.equipped
      },
      enemies: this.enemies.map((e) => ({ type: e.type, x: e.x, y: e.y, hp: e.hp, dead: e.dead }))
    };
    if (RPG.Save.write(state)) this.ui.toast("Saved.");
    else this.ui.toast("Could not save (storage blocked).");
  };

  Game.prototype.load = function () {
    const s = RPG.Save.read();
    if (!s) return false;
    this.reset();
    const p = this.player;
    Object.assign(p, {
      x: s.player.x, y: s.player.y, hp: s.player.hp, magicka: s.player.magicka,
      fatigue: s.player.fatigue, level: s.player.level, equipped: s.player.equipped,
      attributes: s.player.attributes, skills: s.player.skills, dead: false
    });
    p.recalc();
    // Restore enemy states by index/type where the layout matches.
    this.enemies.forEach((e, i) => {
      const se = s.enemies[i];
      if (se && se.type === e.type) { e.x = se.x; e.y = se.y; e.hp = se.hp; e.dead = se.dead; }
    });
    this.ui.toast("Loaded.");
    this.ui.log("You resume your delve.", "good");
    return true;
  };

  // Boot once the DOM and all scripts are ready.
  window.addEventListener("DOMContentLoaded", function () {
    RPG.game = new Game();
  });
})(window.RPG = window.RPG || {});
