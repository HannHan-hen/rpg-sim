/* entities.js — the player and the things that want to bite the player.
   Skills improve through use, Morrowind-style: every swing trains Blade,
   every cast trains its school, etc. */

(function (RPG) {
  "use strict";

  const Data = RPG.Data;

  // ---------- Player ----------
  function Player(x, y) {
    this.x = x; this.y = y;
    this.radius = 10;
    this.facing = 0;                 // radians, for the attack arc + drawing
    this.color = "#cdb892";

    this.attributes = {
      Strength: 40, Agility: 40, Endurance: 40,
      Speed: 40, Willpower: 40, Personality: 40, Luck: 40
    };

    this.quests = {};                // questId -> { stage, progress, done }
    this.guilds = {};                // guildId -> { rank, rep }

    this.skills = {};                // name -> { level, xp }
    for (const name in Data.skills) this.skills[name] = { level: 5, xp: 0 };
    this.skills.Blade.level = 18;    // starting class: a scrappy swordhand
    this.skills.Athletics.level = 14;

    this.level = 1;

    // Gear, magic, and the spoils of mastery.
    this.inventory = [];
    const starter = RPG.Items.weapon("iron_sword");
    this.inventory.push(starter);
    this.equippedWeapon = starter;
    this.knownSpells = Data.startingSpells.map(function (s) {
      return RPG.Magic.compose(s.name, s.effects, {});
    });
    this.activeEffects = [];         // timed buffs from Alteration etc.
    this.vis = 0;                    // essence harvested from kills (enchanting)

    this.recalc();                   // derive maxHp etc. from attributes
    this.hp = this.maxHp;
    this.magicka = this.maxMagicka;
    this.fatigue = this.maxFatigue;

    this.attackTimer = 0;            // swing cooldown
    this.hitFlash = 0;
    this.dead = false;
  }

  // The equipped weapon's live stats (definition merged with this instance).
  Player.prototype.weapon = function () {
    const d = Data.weapons[this.equippedWeapon.defId];
    return Object.assign({}, d, { name: this.equippedWeapon.name, enchant: this.equippedWeapon.enchant });
  };

  Player.prototype.equip = function (item) {
    if (item && item.kind === "weapon") this.equippedWeapon = item;
  };

  // ---- Timed effects (Alteration buffs, shields, levitation) ----
  Player.prototype.addEffect = function (stat, magnitude, duration, def) {
    const existing = this.activeEffects.find(function (a) { return a.stat === stat; });
    if (existing) {
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.activeEffects.push({ stat: stat, magnitude: magnitude, remaining: duration,
        color: def ? def.color : "#fff", name: def ? def.name : stat });
    }
  };
  Player.prototype.effMag = function (stat) {
    let m = 0;
    for (const a of this.activeEffects) if (a.stat === stat) m += a.magnitude;
    return m;
  };
  Player.prototype.tickEffects = function (dt) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      this.activeEffects[i].remaining -= dt;
      if (this.activeEffects[i].remaining <= 0) this.activeEffects.splice(i, 1);
    }
  };

  // Derived stats from attributes (kept simple and readable).
  Player.prototype.recalc = function () {
    const a = this.attributes;
    this.maxHp = Math.round((a.Strength + a.Endurance) / 2 + this.level * 6);
    this.maxMagicka = Math.round(a.Willpower * 1.2);
    this.maxFatigue = a.Strength + a.Agility + a.Endurance + a.Speed;
    this.moveSpeed = 78 + a.Speed * 0.5 + this.skills.Athletics.level * 0.6;
  };

  // Add XP to a skill; level it up (and message) when the threshold is met.
  Player.prototype.trainSkill = function (name, amount, ui) {
    const s = this.skills[name];
    if (!s) return;
    s.xp += amount;
    let need = Data.skillXpFor(s.level);
    while (s.xp >= need) {
      s.xp -= need;
      s.level++;
      if (ui) ui.log(`Your ${name} skill increased to ${s.level}.`, "good");
      this.maybeLevelUp(ui);
      need = Data.skillXpFor(s.level);
    }
  };

  // Crude leveling: every 10 combined skill-ups grants a character level.
  Player.prototype.maybeLevelUp = function (ui) {
    let total = 0;
    for (const k in this.skills) total += this.skills[k].level;
    const newLevel = 1 + Math.floor((total - this._baseSkillTotal()) / 10);
    if (newLevel > this.level) {
      this.level = newLevel;
      // Reward a couple of attribute points on level up.
      this.attributes.Strength += 2;
      this.attributes.Endurance += 2;
      const beforeHp = this.maxHp;
      this.recalc();
      this.hp += (this.maxHp - beforeHp);
      this.fatigue = this.maxFatigue;
      if (ui) ui.log(`You are now level ${this.level}!`, "good");
    }
  };

  Player.prototype._baseSkillTotal = function () {
    // Sum of starting skill levels, used as the leveling baseline.
    return 5 * (Object.keys(Data.skills).length - 2) + 18 + 14;
  };

  // Fatigue normalized 0..1 — drives hit chance and is the "are you winded" feel.
  Player.prototype.fatigueFactor = function () {
    return 0.3 + 0.7 * Math.max(0, this.fatigue) / this.maxFatigue;
  };

  Player.prototype.damage = function (amount, ui) {
    this.hp -= amount;
    this.hitFlash = 0.25;
    if (this.hp <= 0 && !this.dead) {
      this.hp = 0;
      this.dead = true;
      if (ui) ui.log("You have fallen. (Press F9 to load, or refresh to restart.)", "hurt");
    }
  };

  // ---------- Enemy ----------
  function Enemy(type, x, y) {
    const def = Data.enemies[type];
    this.type = type;
    this.def = def;
    this.name = def.name;
    this.x = x; this.y = y;
    this.radius = def.radius;
    this.color = def.color;
    this.hp = def.maxHp;
    this.maxHp = def.maxHp;
    this.attackTimer = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.aggro = false;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
  }

  Enemy.prototype.damage = function (amount) {
    this.hp -= amount;
    this.hitFlash = 0.25;
    this.aggro = true;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  };

  RPG.Player = Player;
  RPG.Enemy = Enemy;
})(window.RPG = window.RPG || {});
