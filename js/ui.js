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
      shell: document.getElementById("game-shell")
    };
    this.dialogueOpen = false;
    this.sheetOpen = false;
  }

  UI.prototype.log = function (html, cls) {
    const line = document.createElement("div");
    line.className = "line fade" + (cls ? " " + cls : "");
    line.innerHTML = html;
    this.el.log.appendChild(line);
    while (this.el.log.childNodes.length > 8) this.el.log.removeChild(this.el.log.firstChild);
  };

  UI.prototype.updateHud = function (p) {
    this.el.health.style.width = (100 * Math.max(0, p.hp) / p.maxHp) + "%";
    this.el.magicka.style.width = (100 * Math.max(0, p.magicka) / p.maxMagicka) + "%";
    this.el.fatigue.style.width = (100 * Math.max(0, p.fatigue) / p.maxFatigue) + "%";
    this.el.level.textContent = p.level;
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

  UI.prototype.showTopic = function (npc, key, game) {
    const node = npc.dialogue[key];
    if (!node) return;
    this.el.dlgText.textContent = node.text;
    this.el.dlgTopics.innerHTML = "";
    (node.topics || []).forEach((t) => {
      const btn = document.createElement("button");
      btn.textContent = t.label;
      btn.onclick = () => {
        if (t.action) t.action(game, npc, this);
        if (t.goto) this.showTopic(npc, t.goto, game);
      };
      this.el.dlgTopics.appendChild(btn);
    });
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

  RPG.UI = UI;
})(window.RPG = window.RPG || {});
