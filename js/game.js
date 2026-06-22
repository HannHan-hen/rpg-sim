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
    this.dispositions = {};               // "zone:id" -> NPC disposition
    this.visited = {};                    // zoneId -> true (for the map)
    this.summons = [];                    // temporary allies (current zone only)
    this.currentZone = null;
    this._portalLock = false;             // prevents instant re-trigger on arrival

    this.input = new RPG.Input(this);
    this._bindOverlay();
    this.newGame();

    requestAnimationFrame((t) => this._frame(t));
  }

  // Start a fresh run at the landing, optionally shaped by a crime/background.
  Game.prototype.newGame = function (backgroundId) {
    RPG.RNG.reseed((Math.random() * 1e9) | 0);
    this.player = new RPG.Player(0, 0);
    if (backgroundId) this._applyBackground(this.player, backgroundId);
    this.zoneState = {};
    this.dispositions = {};
    this.visited = {};
    this.loadZone("port_landing", "start");
  };

  // Apply a chosen crime: attribute/skill biases, a starting boon, some vis.
  Game.prototype._applyBackground = function (p, id) {
    const bg = RPG.Data.backgrounds[id];
    if (!bg) return;
    p.background = id; p.backgroundName = bg.name;
    for (const a in (bg.attrs || {})) p.attributes[a] = (p.attributes[a] || 0) + bg.attrs[a];
    for (const s in (bg.skills || {})) if (p.skills[s]) p.skills[s].level += bg.skills[s];
    if (bg.vis) p.vis += bg.vis;
    if (bg.item) { const it = RPG.Items.weapon(bg.item); if (it) { p.inventory.push(it); p.equip(it); } }
    if (bg.spell) {
      const v = RPG.Data.vendorSpells[bg.spell];
      if (v && !p.knownSpells.some((s) => s.name === v.name))
        p.knownSpells.push(RPG.Magic.compose(v.name, v.effects, { cost: v.cost, minSkill: v.minSkill }));
    }
    p.recalc();
    p.hp = p.maxHp; p.magicka = p.maxMagicka; p.fatigue = p.maxFatigue;
  };

  // Called when a crime is chosen on the title screen.
  Game.prototype.beginWithBackground = function (id) {
    this.newGame(id);
    const bg = RPG.Data.backgrounds[id];
    this.overlayUp = false;
    document.getElementById("overlay").classList.add("hidden");
    this.ui.log(`Banished for ${bg.name.toLowerCase()}: "${bg.crime}" You stagger off the Verdict onto Ashfall.`, "good");
    this.ui.toast("Find the Warden-Scribe (press E)");
  };

  Game.prototype._dispKey = function (id) { return this.currentZone + ":" + id; };

  Game.prototype._makeNpc = function (def, id, x, y) {
    const key = this.currentZone + ":" + id;
    const disp = (this.dispositions[key] != null) ? this.dispositions[key] : (def.disposition || 40);
    this.dispositions[key] = disp;
    return { name: def.name, id, x, y, radius: 10, isNpc: true,
      dialogue: def.dialogue, greetingKey: def.greetingKey, disposition: disp };
  };

  Game.prototype.setDisposition = function (npc, value) {
    npc.disposition = value;
    this.dispositions[this.currentZone + ":" + npc.id] = value;
  };

  // Spawn a temporary ally that fights enemies, then fades.
  Game.prototype.spawnSummon = function (creatureId, magnitude, duration) {
    const def = RPG.Data.summons[creatureId];
    if (!def) return;
    this.summons.push({
      def, name: def.name, color: def.color, radius: def.radius,
      x: this.player.x + RPG.RNG.range(-20, 20), y: this.player.y + RPG.RNG.range(-20, 20),
      hp: def.baseHp + magnitude, maxHp: def.baseHp + magnitude,
      bonus: Math.floor(magnitude / 8), life: duration, attackTimer: 0
    });
    this.ui.log(`A ${def.name} answers your call.`, "good");
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

    this.npcs = this.world.spawns.npcs.map((s) => this._makeNpc(RPG.Npcs[s.id], s.id, s.x, s.y));
    this.summons = [];   // allies don't follow you between zones

    this.containers = this.world.spawns.containers.map((s, i) => ({
      x: s.x, y: s.y, label: s.label, items: s.items,
      opened: !!(saved && saved.containers && saved.containers[i])
    }));

    this._portalLock = true;   // don't bounce straight back through the door
    this.visited[id] = true;
    RPG.Quests.onEnterZone(this, id);
    this.ui.toast(this.world.name);
    this.ui.log(`You arrive at ${this.world.name}.`, "good");
  };

  // Fast travel — only for those with the Sight (majored in Astromancy).
  Game.prototype.fastTravel = function (zoneId) {
    if (!RPG.Quests.clairvoyant(this)) { this.ui.toast("You lack the Sight to travel so. (Astromancy 20+)"); return; }
    if (!this.visited[zoneId]) { this.ui.toast("You can only recall to places you've seen."); return; }
    if (zoneId === this.currentZone) return;
    this._stashZone();
    this.loadZone(zoneId, "start");
    if (this.ui.journalOpen) this.ui.toggleJournal(this);
  };

  Game.prototype.travel = function (portal) {
    this._stashZone();
    this.loadZone(portal.to, portal.entry);
  };

  Game.prototype._bindOverlay = function () {
    const overlay = document.getElementById("overlay");
    const start = document.getElementById("btn-start");
    const load = document.getElementById("btn-load");
    const menu = document.getElementById("menu");
    const creation = document.getElementById("creation");

    // "Begin" reveals the choose-your-crime step.
    start.onclick = () => {
      menu.classList.add("hidden");
      creation.classList.remove("hidden");
      this._buildCrimeCards();
    };
    load.onclick = () => {
      if (this.load()) { this.overlayUp = false; overlay.classList.add("hidden"); }
      else this.ui.toast("No save found.");
    };
    load.style.display = RPG.Save.has() ? "block" : "none";
  };

  Game.prototype._buildCrimeCards = function () {
    const list = document.getElementById("crime-list");
    list.innerHTML = "";
    const bgs = RPG.Data.backgrounds;
    for (const id in bgs) {
      const bg = bgs[id];
      const skills = Object.keys(bg.skills || {}).map((s) => "+" + bg.skills[s] + " " + s).join(", ");
      const boon = bg.spell ? "spell: " + RPG.Data.vendorSpells[bg.spell].name
        : bg.item ? "gear: " + RPG.Data.weapons[bg.item].name
        : bg.vis ? bg.vis + " vis" : "";
      const card = document.createElement("button");
      card.className = "crime-card";
      card.innerHTML = `<b>${bg.name}</b><span class="crime-desc">"${bg.crime}"</span>` +
        `<span class="crime-blurb">${bg.blurb}</span><span class="crime-stats">${skills}${boon ? " · " + boon : ""}</span>`;
      card.onclick = () => this.beginWithBackground(id);
      list.appendChild(card);
    }
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
    this._updateSummons(dt);
  };

  // Allies: find the nearest foe, close in, and bite. Fade when their time ends.
  Game.prototype._updateSummons = function (dt) {
    for (let i = this.summons.length - 1; i >= 0; i--) {
      const s = this.summons[i];
      s.life -= dt;
      if (s.attackTimer > 0) s.attackTimer -= dt;
      if (s.life <= 0 || s.hp <= 0) { this.summons.splice(i, 1); continue; }

      let foe = null, fd = 1e9;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < fd) { fd = d; foe = e; }
      }
      if (!foe) { // drift near the player when idle
        this.world.moveCircle(s, (this.player.x - s.x) * 0.02, (this.player.y - s.y) * 0.02);
        continue;
      }
      const reach = s.def.reach + foe.radius;
      if (fd > reach * 0.8) {
        const step = s.def.speed * dt, dx = foe.x - s.x, dy = foe.y - s.y, dist = fd || 1;
        this.world.moveCircle(s, (dx / dist) * step, (dy / dist) * step);
      } else if (s.attackTimer <= 0) {
        s.attackTimer = s.def.attackCooldown;
        const chance = Math.max(5, Math.min(95, s.def.attackSkill - foe.def.evasion + 30));
        if (RPG.RNG.d100() <= chance) {
          const dmg = RPG.RNG.int(s.def.damage[0], s.def.damage[1]) + s.bonus;
          foe.damage(dmg);
          this.fx.blood(foe.x, foe.y, s.color);
          this.ui.log(`Your ${s.name} strikes the ${foe.name} for ${dmg}.`, "hit");
          if (foe.dead) this.onEnemyDefeated(foe);
        }
      }
    }
  };

  // Reward for a kill: train was already given by the attack; grant vis (essence).
  Game.prototype.onEnemyDefeated = function (e) {
    this.ui.log(`The ${e.name} dies. <span class="roll">(+${e.def.xp} vis)</span>`, "good");
    this.player.vis += e.def.xp;
    RPG.Quests.onEnemyDefeated(this, e);
  };

  // Learn a curated spell from a vendor NPC, paid in vis. A well-disposed
  // merchant gives up to 30% off — so persuasion (and Fortify Presence) pays.
  Game.prototype.learnVendorSpell = function (key, npc) {
    const v = RPG.Data.vendorSpells[key];
    if (!v) return;
    const p = this.player;
    const disp = npc ? npc.disposition : 50;
    const discount = Math.max(0, Math.min(0.3, (disp - 50) * 0.006));
    const price = Math.round(v.price * (1 - discount));
    if (p.knownSpells.some((s) => s.name === v.name)) { this.ui.toast(`You already know ${v.name}.`); return; }
    if (p.vis < price) { this.ui.toast(`Need ${price} vis (have ${Math.floor(p.vis)}).`); return; }
    p.vis -= price;
    p.knownSpells.push(RPG.Magic.compose(v.name, v.effects, { cost: v.cost, minSkill: v.minSkill }));
    const saved = v.price - price;
    this.ui.log(`You learn ${v.name}! (${v.cost} mp; paid ${price} vis${saved > 0 ? ", " + saved + " off for friendship" : ""}.)`, "good");
  };

  Game.prototype.joinGuild = function (id) { RPG.Guilds.join(this, id); };

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

      // Calmed foes (Veilcraft) stand down until the spell wears off.
      if (e.calmedFor > 0) { e.calmedFor -= dt; e.aggro = false; continue; }

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
      dispositions: this.dispositions,
      visited: this.visited,
      player: {
        x: p.x, y: p.y, hp: p.hp, magicka: p.magicka, fatigue: p.fatigue,
        level: p.level, attributes: p.attributes, skills: p.skills,
        vis: p.vis, knownSpells: p.knownSpells, quests: p.quests, guilds: p.guilds,
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
    this.dispositions = s.dispositions || {};
    this.visited = s.visited || {};
    this.loadZone(s.currentZone || "port_landing", "start");

    const p = this.player, sp = s.player;
    Object.assign(p, {
      x: sp.x, y: sp.y, hp: sp.hp, magicka: sp.magicka, fatigue: sp.fatigue,
      level: sp.level, attributes: sp.attributes, skills: sp.skills, dead: false
    });
    if (typeof sp.vis === "number") p.vis = sp.vis;
    if (sp.knownSpells) p.knownSpells = sp.knownSpells;
    if (sp.quests) p.quests = sp.quests;
    if (sp.guilds) p.guilds = sp.guilds;
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
