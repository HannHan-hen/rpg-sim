/* ui.js — the HTML overlay: HUD bars, scrolling message log, character
   sheet, and topic-based dialogue. The canvas owns the world; this owns
   the chrome around it. */

(function (RPG) {
  "use strict";

  const Data = RPG.Data;

  function UI() {
    this.el = {
      health: document.getElementById("bar-health"),
      magicka: document.getElementById("bar-magicka"),
      fatigue: document.getElementById("bar-fatigue"),
      level: document.getElementById("level-num"),
      log: document.getElementById("log"),
      sheet: document.getElementById("sheet"),
      sheetBody: document.getElementById("sheet-body"),
      dialogue: document.getElementById("dialogue"),
      dlgName: document.getElementById("dlg-name"),
      dlgText: document.getElementById("dlg-text"),
      dlgTopics: document.getElementById("dlg-topics"),
      shell: document.getElementById("game-shell"),
      vis: document.getElementById("vis-num"),
      effects: document.getElementById("effects"),
      inventory: document.getElementById("inventory"),
      invBody: document.getElementById("inv-body"),
      arcane: document.getElementById("arcane"),
      arcBody: document.getElementById("arc-body"),
      arcTabs: document.getElementById("arc-tabs"),
      journal: document.getElementById("journal"),
      jrnBody: document.getElementById("jrn-body"),
      jrnTabs: document.getElementById("jrn-tabs")
    };
    this.dialogueOpen = false;
    this.sheetOpen = false;
    this.inventoryOpen = false;
    this.arcaneOpen = false;
    this.journalOpen = false;
    this.arcTab = "book";
    this.jrnTab = "quests";
    // Spellmaking scratch state.
    this.make = { effect: "fire", magnitude: 10, duration: 8 };
    this.ench = { effect: "fire", magnitude: 6 };
  }

  // Any modal panel that should pause the world / swallow movement keys.
  UI.prototype.anyPanelOpen = function () {
    return this.dialogueOpen || this.inventoryOpen || this.arcaneOpen || this.journalOpen;
  };

  UI.prototype.log = function (html, cls) {
    const line = document.createElement("div");
    line.className = "line fade" + (cls ? " " + cls : "");
    line.innerHTML = html;
    this.el.log.appendChild(line);
    while (this.el.log.childNodes.length > 8) this.el.log.removeChild(this.el.log.firstChild);
  };

  // Called every frame, so we diff against the last written values and only touch
  // the DOM when something actually changed — DOM writes are what's expensive here.
  UI.prototype.updateHud = function (p) {
    const c = this._hud || (this._hud = {});
    const hw = 100 * Math.max(0, p.hp) / p.maxHp;
    const mw = 100 * Math.max(0, p.magicka) / p.maxMagicka;
    const fw = 100 * Math.max(0, p.fatigue) / p.maxFatigue;
    if (hw !== c.hw) { this.el.health.style.width = hw + "%"; c.hw = hw; }
    if (mw !== c.mw) { this.el.magicka.style.width = mw + "%"; c.mw = mw; }
    if (fw !== c.fw) { this.el.fatigue.style.width = fw + "%"; c.fw = fw; }
    if (p.level !== c.level) { this.el.level.textContent = p.level; c.level = p.level; }
    const vis = Math.floor(p.vis);
    if (vis !== c.vis) { this.el.vis.textContent = vis; c.vis = vis; }

    // Active effect pips — rebuild only when the set or its readouts change.
    let sig = "", h = "";
    for (const a of p.activeEffects) {
      sig += a.name + "/" + a.magnitude + "/" + Math.ceil(a.remaining) + "|";
      h += `<span class="eff" style="border-color:${a.color}">${a.name} ${a.magnitude} · ${Math.ceil(a.remaining)}s</span>`;
    }
    if (sig !== c.effSig) { this.el.effects.innerHTML = h; c.effSig = sig; }
  };

  UI.prototype.toggleSheet = function (p) {
    this.sheetOpen = !this.sheetOpen;
    this.el.sheet.classList.toggle("hidden", !this.sheetOpen);
    if (this.sheetOpen) this.renderSheet(p);
  };

  UI.prototype.renderSheet = function (p) {
    let h = '<div class="section-title">Attributes</div>';
    for (const a of Data.attributes) {
      h += `<div class="stat-row"><span>${a}</span><span class="v">${p.attributes[a]}</span></div>`;
    }
    h += '<div class="section-title">Vitals</div>';
    h += `<div class="stat-row"><span>Health</span><span class="v">${Math.round(p.hp)} / ${p.maxHp}</span></div>`;
    h += `<div class="stat-row"><span>Magicka</span><span class="v">${Math.round(p.magicka)} / ${p.maxMagicka}</span></div>`;
    h += `<div class="stat-row"><span>Fatigue</span><span class="v">${Math.round(p.fatigue)} / ${p.maxFatigue}</span></div>`;
    h += '<div class="section-title">Skills (improve by using them)</div>';
    for (const name in p.skills) {
      const s = p.skills[name];
      const need = Data.skillXpFor(s.level);
      const pct = Math.min(100, 100 * s.xp / need);
      h += `<div class="skill-row"><span class="name">${name}</span>` +
           `<span class="skbar"><div style="width:${pct}%"></div></span>` +
           `<span class="lvl">${s.level}</span></div>`;
    }
    this.el.sheetBody.innerHTML = h;
  };

  UI.prototype.openDialogue = function (npc, game) {
    this.dialogueOpen = true;
    this.activeNpc = npc;
    this.el.dialogue.classList.remove("hidden");
    this.el.dlgName.textContent = npc.name;
    this.showTopic(npc, npc.greetingKey || "greeting", game);
  };

  UI.prototype._meetsReq = function (npc, req, game) {
    if (!req) return true;
    if (req.disp != null && npc.disposition < req.disp) return false;
    if (req.notGuild && game.player.guilds[req.notGuild]) return false;
    if (req.guild && !game.player.guilds[req.guild]) return false;
    if (req.noQuest && game.player.quests[req.noQuest]) return false;   // hide once started/done
    if (req.questDone && !(game.player.quests[req.questDone] && game.player.quests[req.questDone].done)) return false;
    return true;
  };

  UI.prototype._dispHeader = function (npc) {
    this.el.dlgName.innerHTML = `${npc.name} <span class="disp">disposition ${npc.disposition}</span>`;
  };

  UI.prototype.showTopic = function (npc, key, game) {
    const node = npc.dialogue[key];
    if (!node) return;
    this._dispHeader(npc);
    this.el.dlgText.textContent = node.text;
    this.el.dlgTopics.innerHTML = "";
    (node.topics || []).forEach((t) => {
      if (!this._meetsReq(npc, t.req, game)) return;  // gated topics hidden until earned
      const btn = document.createElement("button");
      btn.textContent = t.label;
      btn.onclick = () => {
        if (t.action) t.action(game, npc, this);
        if (t.goto) this.showTopic(npc, t.goto, game);
      };
      this.el.dlgTopics.appendChild(btn);
    });
    // Persuasion is always available from any topic.
    const pbtn = document.createElement("button");
    pbtn.className = "persuade-btn";
    pbtn.textContent = "Persuade ▸";
    pbtn.onclick = () => this.showPersuade(npc, game);
    this.el.dlgTopics.appendChild(pbtn);
  };

  UI.prototype.showPersuade = function (npc, game) {
    this._dispHeader(npc);
    this.el.dlgText.textContent = "How do you approach them? (Fortify Presence sways the odds.)";
    this.el.dlgTopics.innerHTML = "";
    for (const kind in RPG.Social.approaches) {
      const a = RPG.Social.approaches[kind];
      const ch = kind === "bribe" ? null : RPG.Social.chance(game, npc, kind);
      const btn = document.createElement("button");
      btn.textContent = a.label + (ch != null ? `  (${ch}%)` : "");
      btn.onclick = () => { RPG.Social.attempt(game, npc, kind); this.showPersuade(npc, game); };
      this.el.dlgTopics.appendChild(btn);
    }
    const back = document.createElement("button");
    back.textContent = "◂ Back";
    back.onclick = () => this.showTopic(npc, npc.greetingKey || "greeting", game);
    this.el.dlgTopics.appendChild(back);
  };

  UI.prototype.closeDialogue = function () {
    this.dialogueOpen = false;
    this.activeNpc = null;
    this.el.dialogue.classList.add("hidden");
  };

  UI.prototype.toast = function (msg, ms) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    this.el.shell.appendChild(t);
    setTimeout(() => t.remove(), ms || 1600);
  };

  // ---------- Inventory ----------
  UI.prototype.toggleInventory = function (game) {
    this.inventoryOpen = !this.inventoryOpen;
    this.el.inventory.classList.toggle("hidden", !this.inventoryOpen);
    if (this.inventoryOpen) this.renderInventory(game);
  };

  UI.prototype.renderInventory = function (game) {
    const p = game.player;
    let h = "";
    if (!p.inventory.length) h = '<p class="hint">Empty.</p>';
    p.inventory.forEach((it, i) => {
      const equipped = it === p.equippedWeapon;
      h += `<div class="item-row${equipped ? " equipped" : ""}" data-i="${i}">` +
           `<span>${RPG.Items.describe(it)}</span>` +
           `<span class="tag">${equipped ? "equipped" : "equip"}</span></div>`;
    });
    this.el.invBody.innerHTML = h;
    this.el.invBody.querySelectorAll(".item-row").forEach((row) => {
      row.onclick = () => { game.player.equip(game.player.inventory[+row.dataset.i]); this.renderInventory(game); };
    });
  };

  // ---------- Arcane: spellbook / spellmaking / enchanting ----------
  UI.prototype.toggleArcane = function (game) {
    this.arcaneOpen = !this.arcaneOpen;
    this.el.arcane.classList.toggle("hidden", !this.arcaneOpen);
    if (this.arcaneOpen) {
      this.el.arcTabs.querySelectorAll("button").forEach((b) => {
        b.onclick = () => { this.arcTab = b.dataset.tab; this._syncTabs(); this.renderArcane(game); };
      });
      this._syncTabs();
      this.renderArcane(game);
    }
  };

  UI.prototype._syncTabs = function () {
    this.el.arcTabs.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === this.arcTab);
    });
  };

  UI.prototype.renderArcane = function (game) {
    if (this.arcTab === "book") return this._renderSpellbook(game);
    if (this.arcTab === "make") return this._renderSpellmaking(game);
    return this._renderEnchanting(game);
  };

  UI.prototype._describeSpell = function (sp) {
    return sp.effects.map((s) => {
      const e = Data.effects[s.effect];
      return e.name + " " + s.magnitude + (e.timed ? `/${s.duration}s` : "");
    }).join(" + ");
  };

  UI.prototype._renderSpellbook = function (game) {
    const p = game.player;
    let h = '<p class="hint">Your spells. The slot number (or right-click for the selected one) casts it.</p>';
    p.knownSpells.forEach((sp, i) => {
      const sel = i === (game.selectedSpell || 0);
      h += `<div class="spell-row${sel ? " sel" : ""}" data-i="${i}">` +
           `<span class="slot">${i + 1}</span>` +
           `<span class="sname">${sp.name}<br><small>${this._describeSpell(sp)} · ${sp.school}</small></span>` +
           `<span class="scost">${sp.cost} mp</span></div>`;
    });
    this.el.arcBody.innerHTML = h;
    this.el.arcBody.querySelectorAll(".spell-row").forEach((row) => {
      row.onclick = () => { game.selectedSpell = +row.dataset.i; this._renderSpellbook(game); };
    });
  };

  UI.prototype._effectOptions = function (selected, filterTimed) {
    let o = "";
    for (const id in Data.effects) {
      const e = Data.effects[id];
      if (filterTimed !== undefined && !!e.timed !== filterTimed) continue;
      o += `<option value="${id}"${id === selected ? " selected" : ""}>${e.name} (${e.school})</option>`;
    }
    return o;
  };

  UI.prototype._renderSpellmaking = function (game) {
    const m = this.make;
    const e = Data.effects[m.effect];
    const spec = [{ effect: m.effect, magnitude: m.magnitude, duration: m.duration }];
    const cost = RPG.Magic.spellCost(spec, true);
    const fair = RPG.Magic.spellCost(spec, false);
    let h = '<div class="form">';
    h += `<label>Effect <select id="mk-effect">${this._effectOptions(m.effect)}</select></label>`;
    h += `<label>Magnitude <input id="mk-mag" type="range" min="1" max="60" value="${m.magnitude}"> <b>${m.magnitude}</b></label>`;
    if (e.timed) h += `<label>Duration <input id="mk-dur" type="range" min="1" max="30" value="${m.duration}"> <b>${m.duration}s</b></label>`;
    h += `<div class="cost">Magicka cost: <b>${cost}</b> &nbsp;<span class="roll">(self-made; a taught spell would cost ~${fair})</span> &nbsp; max: ${game.player.maxMagicka}</div>`;
    h += `<button id="mk-learn">Learn spell</button>`;
    h += '</div>';
    this.el.arcBody.innerHTML = h;

    const eff = document.getElementById("mk-effect");
    eff.onchange = () => { this.make.effect = eff.value; this._renderSpellmaking(game); };
    document.getElementById("mk-mag").oninput = (ev) => { this.make.magnitude = +ev.target.value; this._renderSpellmaking(game); };
    const dur = document.getElementById("mk-dur");
    if (dur) dur.oninput = (ev) => { this.make.duration = +ev.target.value; this._renderSpellmaking(game); };
    document.getElementById("mk-learn").onclick = () => {
      const sp = RPG.Magic.custom(e.name, m.effect, m.magnitude, m.duration);
      game.player.knownSpells.push(sp);
      this.log(`Learned a new spell: ${sp.name} (${sp.cost} mp).`, "good");
      this.arcTab = "book"; this._syncTabs(); this.renderArcane(game);
    };
  };

  UI.prototype._renderEnchanting = function (game) {
    const p = game.player, n = this.ench;
    const cost = n.magnitude * Data.magic.visPerMagnitude;
    let h = `<p class="hint">Bind an effect onto <b>${p.equippedWeapon ? p.equippedWeapon.baseName : "—"}</b>, paid in vis from the slain.</p><div class="form">`;
    h += `<label>Effect <select id="en-effect">${this._effectOptions(n.effect, false)}</select></label>`;
    h += `<label>Magnitude <input id="en-mag" type="range" min="1" max="20" value="${n.magnitude}"> <b>${n.magnitude}</b></label>`;
    h += `<div class="cost">Cost: <b>${cost}</b> vis &nbsp; (you have ${Math.floor(p.vis)})</div>`;
    h += `<button id="en-do">Enchant weapon</button></div>`;
    this.el.arcBody.innerHTML = h;

    const eff = document.getElementById("en-effect");
    eff.onchange = () => { this.ench.effect = eff.value; this._renderEnchanting(game); };
    document.getElementById("en-mag").oninput = (ev) => { this.ench.magnitude = +ev.target.value; this._renderEnchanting(game); };
    document.getElementById("en-do").onclick = () => {
      if (RPG.Magic.enchantWeapon(game, n.effect, n.magnitude)) this._renderEnchanting(game);
    };
  };

  // ---------- Journal: quests + map ----------
  UI.prototype.toggleJournal = function (game) {
    this.journalOpen = !this.journalOpen;
    this.el.journal.classList.toggle("hidden", !this.journalOpen);
    if (this.journalOpen) {
      this.el.jrnTabs.querySelectorAll("button").forEach((b) => {
        b.onclick = () => { this.jrnTab = b.dataset.tab; this._syncJrnTabs(); this.renderJournal(game); };
      });
      this._syncJrnTabs();
      this.renderJournal(game);
    }
  };

  UI.prototype._syncJrnTabs = function () {
    this.el.jrnTabs.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === this.jrnTab);
    });
  };

  UI.prototype.renderJournal = function (game) {
    if (this.jrnTab === "map") return this._renderMap(game);
    if (this.jrnTab === "guilds") return this._renderGuilds(game);
    return this._renderQuests(game);
  };

  UI.prototype._renderGuilds = function (game) {
    const ids = Object.keys(game.player.guilds);
    let h = "";
    if (!ids.length) h = '<p class="hint">You belong to no guild. Seek them in the cities.</p>';
    ids.forEach((id) => {
      const g = Data.guilds[id], m = game.player.guilds[id];
      h += `<div class="quest"><b>${g.name}</b><br><small>Rank: ${g.ranks[m.rank]} &nbsp;·&nbsp; ${g.town}</small><br><small class="hint">${g.blurb}</small></div>`;
    });
    this.el.jrnBody.innerHTML = h;
  };

  UI.prototype._renderQuests = function (game) {
    const seer = RPG.Quests.clairvoyant(game);
    const ids = Object.keys(game.player.quests);
    let h = "";
    if (!ids.length) h = '<p class="hint">No quests yet. Talk to the folk of the island.</p>';
    ids.forEach((id) => {
      const q = Data.quests[id], st = game.player.quests[id];
      if (st.done) {
        h += `<div class="quest done"><b>${q.name}</b><br><small>Completed.</small></div>`;
      } else {
        const stage = q.stages[st.stage], obj = stage.objective;
        const prog = obj.count ? ` (${st.progress}/${obj.count})` : "";
        const where = seer && obj.zone ? `<br><small class="seer">Sight: ${RPG.Zones[obj.zone].name}</small>`
          : '<br><small class="hint">Whereabouts unknown — seek it yourself. (Major in Astromancy for the Sight.)</small>';
        h += `<div class="quest"><b>${q.name}</b><br><small>${stage.desc}${prog}</small>${where}</div>`;
      }
    });
    this.el.jrnBody.innerHTML = h;
  };

  UI.prototype._renderMap = function (game) {
    const seer = RPG.Quests.clairvoyant(game);
    let h = `<p class="hint">${seer ? "You have the Sight — recall to any place you've walked." : "Major in Astromancy (20+) to recall across the island."}</p>`;
    for (const id in RPG.Zones) {
      if (!game.visited[id]) continue;
      const here = id === game.currentZone;
      h += `<div class="zone-row${here ? " here" : ""}">` +
           `<span>${RPG.Zones[id].name}${here ? " (here)" : ""}</span>`;
      if (seer && !here) h += `<button data-z="${id}" class="travel">Recall</button>`;
      h += `</div>`;
    }
    this.el.jrnBody.innerHTML = h;
    this.el.jrnBody.querySelectorAll(".travel").forEach((b) => {
      b.onclick = () => game.fastTravel(b.dataset.z);
    });
  };

  RPG.UI = UI;
})(window.RPG = window.RPG || {});
