/* input.js — keyboard + mouse. Movement keys are polled each frame;
   discrete actions (attack, talk, sheet, save/load, spells) fire on press. */

(function (RPG) {
  "use strict";

  function Input(game) {
    this.game = game;
    this.keys = Object.create(null);
    this.mouse = { x: game.renderer.W / 2, y: game.renderer.H / 2 };
    this._bind();
  }

  Input.prototype._bind = function () {
    const g = this.game;
    const canvas = g.renderer.canvas;

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      // Keep the page from scrolling on arrows/space.
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (e.key === "F5") e.preventDefault();
      if (e.key === "F9") e.preventDefault();
      this.keys[k] = true;

      if (g.overlayUp) return;            // ignore world keys on the title screen

      // Modal panels swallow input; their toggle keys (and Esc) still work to close.
      if (g.ui.dialogueOpen) { if (k === "e" || k === "escape") g.ui.closeDialogue(); return; }
      if (g.ui.inventoryOpen) { if (k === "i" || k === "escape") g.ui.toggleInventory(g); return; }
      if (g.ui.arcaneOpen) { if (k === "m" || k === "escape") g.ui.toggleArcane(g); return; }
      if (g.ui.journalOpen) { if (k === "j" || k === "escape") g.ui.toggleJournal(g); return; }

      switch (k) {
        case "e": g.tryInteract(); break;
        case "c": g.ui.toggleSheet(g.player); break;
        case "i": g.ui.toggleInventory(g); break;
        case "m": g.ui.toggleArcane(g); break;
        case "j": g.ui.toggleJournal(g); break;
        case "escape": if (g.ui.sheetOpen) g.ui.toggleSheet(g.player); break;
      }
      // Number keys 1-9 cast the matching spellbook slot.
      if (k >= "1" && k <= "9") g.castSlot(parseInt(k, 10) - 1);
      if (e.key === "F5") { g.save(); }
      if (e.key === "F9") { g.load(); }
    });

    window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      // Map CSS pixels back to the canvas's internal resolution.
      this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });

    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (g.overlayUp || g.ui.anyPanelOpen()) return;
      if (e.button === 2) RPG.Magic.cast(g, g.player.knownSpells[g.selectedSpell || 0]); // right-click casts
      else RPG.Combat.playerSwing(g);
    });

    // Right-click casts the selected spell instead of opening a menu.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  };

  // Polled each frame: returns the desired movement vector (not normalized).
  Input.prototype.moveVector = function () {
    let dx = 0, dy = 0;
    if (this.keys["w"] || this.keys["arrowup"]) dy -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) dx += 1;
    return { dx, dy };
  };

  RPG.Input = Input;
})(window.RPG = window.RPG || {});
