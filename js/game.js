/* game.js — the conductor. Owns the persistent player, the active zone, travel
   between zones, enemy AI, interaction, and save/load. Zones come and go; the
   player and the per-zone state persist. */

(function (RPG) {
  "use strict";

  function Game() {
    this.canvas = document.getElementById("screen");
    this.renderer = new RPG.Renderer(this.canvas);
    this.ui = new RPG.UI();
    this.fx = new RPG.FX();
    this.overlayUp = true;
    this.last = 0;

    this.player = new RPG.Player(0, 0);   // persists across zones
    this.zoneState = {};                  // zoneId -> saved enemy states
    this.currentZone = null;
    this._portalLock = false;             // prevents instant re-trigger on arrival

    this.input = new RPG.Input(this);
    this._bindOverlay();
    this.newGame();

    requestAnimationFrame((t) => this._frame(t));
  }

  // Start a fresh run at the landing.
  Game.prototype.newGame = function () {
    RPG.RNG.reseed((Math.random() * 1e9) | 0);
    this.player = new RPG.Player(0, 0);
    this.zoneState = {};
    this.loadZone("port_landing", "start");
  };

  Game.prototype._makeNpc = function (def, x, y) {
    return { name: def.name, x, y, radius: 10, isNpc: true,
      dialogue: def.dialogue, greetingKey: def.greetingKey };
  };

  // Capture the current zone's mutable state so it persists if we return.
  Game.prototype._stashZone = function () {
    if (!this.currentZone) return;
    this.zoneState[this.currentZone] = {
      enemies: this.enemies.map((e) => ({ hp: e.hp, dead: e.dead, x: e.x, y: e.y, aggro: e.aggro })),
      containers: this.containers.map((c) => c.opened)
    };
  };

  // Build a zone and drop the player at the named entry.
  Game.prototype.loadZone = function (id, entryName) {
    const def = RPG.Zones[id];
    if (!def) { this.ui.toast("That way leads nowhere yet."); return; }
    this.currentZone = id;
    this.world = new RPG.World(def);
    this.fx = new RPG.FX();

    const entry = this.world.entries[entryName] || this.world.entries.start ||
      { x: this.world.w / 2, y: this.world.h / 2 };
    this.player.x = entry.x; this.player.y = entry.y;

    // Spawn enemies, restoring saved state where we've been before.
    const saved = this.zoneState[id];
    this.enemies = this.world.spawns.enemies.map((s, i) => {
      const e = new RPG.Enemy(s.type, s.x, s.y);
      if (saved && saved.enemies && saved.enemies[i]) Object.assign(e, saved.enemies[i]);
      return e;
    });

    this.npcs = this.world.spawns.npcs.map((s) => this._makeNpc(RPG.Npcs[s.id], s.x, s.y));

    this.containers = this.world.spawns.containers.map((s, i) => ({
      x: s.x, y: s.y, label: s.label, items: s.items,
      opened: !!(saved && saved.containers && saved.containers[i])
    }));

    this._portalLock = true;   // don't bounce straight back through the door
    this.ui.toast(this.world.name);
    this.ui.log(`You arrive at ${this.world.name}.`, "good");
  };

  Game.prototype.travel = function (portal) {
    this._stashZone();
    this.loadZone(portal.to, portal.entry);
  };

  Game.prototype._bindOverlay = function () {
    const overlay = document.getElementById("overlay");
    const start = document.getElementById("btn-start");
    const load = document.getElementById("btn-load");
    start.onclick = () => { this.overlayUp = false; overlay.classList.add("hidden"); };
    load.onclick = () => {
      if (this.load()) { this.overlayUp = false; overlay.classList.add("hidden"); }
      else this.ui.toast("No save found.");
    };
    load.style.display = RPG.Save.has() ? "block" : "none";
  };

  Game.prototype._frame = function (t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    if (!this.overlayUp && !this.ui.anyPanelOpen()) this.update(dt);
    this.fx.update(dt);
    this.renderer.draw(this, dt);
    this.ui.updateHud(this.player);
    requestAnimationFrame((tt) => this._frame(tt));
  };

  Game.prototype.update = function (dt) {
    const p = this.player;
    const cam = this.renderer.cam;
    p.facing = Math.atan2(this.input.mouse.y + cam.y - p.y, this.input.mouse.x + cam.x - p.x);

    if (!p.dead) {
      const mv = this.input.moveVector();
      if (mv.dx || mv.dy) {
        const len = Math.hypot(mv.dx, mv.dy);
        // Fortify Speed makes you fleet; Levitate lets you float over water/trees.
        const speed = p.moveSpeed + p.effMag("speed") * 1.6;
        const step = speed * dt;
        const fly = p.effMag("levitate") > 0;
        const move = fly ? this.world.moveFly : this.world.moveCircle;
        move.call(this.world, p, (mv.dx / len) * step, (mv.dy / len) * step);
        p.fatigue = Math.max(0, p.fatigue - 4 * dt);
        p.trainSkill("Athletics", 0.25 * dt, this.ui);
      }
      this._checkPortals();
    }

    if (p.attackTimer > 0) p.attackTimer -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    p.tickEffects(dt);
    p.fatigue = Math.min(p.maxFatigue, p.fatigue + 9 * dt);
    p.magicka = Math.min(p.maxMagicka, p.magicka + 2.5 * dt);

    this._updateEnemies(dt);
  };

  // Reward for a kill: train was already given by the attack; grant vis (essence).
  Game.prototype.onEnemyDefeated = function (e) {
    this.ui.log(`The ${e.name} dies. <span class="roll">(+${e.def.xp} vis)</span>`, "good");
    this.player.vis += e.def.xp;
  };

  // Cast a spell from a spellbook slot (number keys) or the selected spell.
  Game.prototype.castSlot = function (i) {
    const sp = this.player.knownSpells[i];
    if (sp) { this.selectedSpell = i; RPG.Magic.cast(this, sp); }
  };
  Game.prototype.castSelected = function () {
    this.castSlot(this.selectedSpell || 0);
  };

  // Walking onto a portal tile travels through it (unlocked); locked ones warn.
  Game.prototype._checkPortals = function () {
    const p = this.player;
    const portal = this.world.portalAtTile(p.x, p.y);
    if (!portal) { this._portalLock = false; return; }
    if (this._portalLock) return;          // we just arrived here; wait until we step off
    if (portal.locked) {
      this.ui.toast(portal.label || "It's sealed.");
      this._portalLock = true;             // toast once until they leave the tile
    } else {
      this.travel(portal);
    }
  };

  Game.prototype._updateEnemies = function (dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;

      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.0001;

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
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) { e.wanderAngle = Math.random() * Math.PI * 2; e.wanderTimer = 1 + Math.random() * 2; }
        const step = e.def.speed * 0.35 * dt;
        this.world.moveCircle(e, Math.cos(e.wanderAngle) * step, Math.sin(e.wanderAngle) * step);
      }
    }
  };

  // E: talk to a nearby NPC, or step through / inspect a nearby portal.
  Game.prototype.tryInteract = function () {
    const p = this.player;
    let best = null, bestD = 42;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) { this.ui.openDialogue(best, this); return; }

    // Nearby unopened container?
    for (const c of this.containers) {
      if (!c.opened && Math.hypot(c.x - p.x, c.y - p.y) < 40) { this._openContainer(c); return; }
    }

    let portal = null, pd = 40;
    for (const pt of this.world.portals) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < pd) { pd = d; portal = pt; }
    }
    if (portal) {
      if (portal.locked) this.ui.toast(portal.label || "It's sealed.");
      else this.travel(portal);
      return;
    }
    this.ui.toast("Nothing to interact with here.");
  };

  Game.prototype._openContainer = function (c) {
    c.opened = true;
    if (!c.items || !c.items.length) { this.ui.log(`The ${c.label} is empty.`, "miss"); return; }
    c.items.forEach((defId) => {
      const item = RPG.Items.weapon(defId);
      if (item) { this.player.inventory.push(item); this.ui.log(`Found: ${item.name}.`, "good"); }
    });
    this.ui.toast(`Opened ${c.label}`);
  };

  // ---------- Save / load ----------
  Game.prototype.save = function () {
    this._stashZone();
    const p = this.player;
    const state = {
      currentZone: this.currentZone,
      zoneState: this.zoneState,
      player: {
        x: p.x, y: p.y, hp: p.hp, magicka: p.magicka, fatigue: p.fatigue,
        level: p.level, attributes: p.attributes, skills: p.skills,
        vis: p.vis, knownSpells: p.knownSpells,
        inventory: p.inventory.map((it) => ({ kind: it.kind, defId: it.defId, name: it.name, enchant: it.enchant })),
        equippedIndex: p.inventory.indexOf(p.equippedWeapon)
      }
    };
    this.ui.toast(RPG.Save.write(state) ? "Saved." : "Could not save (storage blocked).");
  };

  Game.prototype.load = function () {
    const s = RPG.Save.read();
    if (!s) return false;
    this.player = new RPG.Player(0, 0);
    this.zoneState = s.zoneState || {};
    this.loadZone(s.currentZone || "port_landing", "start");

    const p = this.player, sp = s.player;
    Object.assign(p, {
      x: sp.x, y: sp.y, hp: sp.hp, magicka: sp.magicka, fatigue: sp.fatigue,
      level: sp.level, attributes: sp.attributes, skills: sp.skills, dead: false
    });
    if (typeof sp.vis === "number") p.vis = sp.vis;
    if (sp.knownSpells) p.knownSpells = sp.knownSpells;
    if (sp.inventory) {
      p.inventory = sp.inventory.map((it) => RPG.Items.fromSave(it)).filter(Boolean);
      p.equippedWeapon = p.inventory[sp.equippedIndex] || p.inventory[0];
    }
    p.recalc();
    this.ui.toast("Loaded.");
    this.ui.log("You resume your delve.", "good");
    return true;
  };

  window.addEventListener("DOMContentLoaded", function () { RPG.game = new Game(); });
})(window.RPG = window.RPG || {});
