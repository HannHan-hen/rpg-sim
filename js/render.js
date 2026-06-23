/* render.js — all graphics, drawn in code. Now zone-aware: ground colour,
   darkness, and light radius come from the active zone's ambient, so a sunlit
   harbor and a black cave use the same cheap primitives to very different effect. */

(function (RPG) {
  "use strict";

  const TILE = RPG.TILE;
  const T = RPG.TILES;

  function hash2(c, r) {
    let h = (c * 374761393 + r * 668265263) ^ 0x9e3779b9;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- Particle / effect system ----------
  function FX() { this.parts = []; this.swings = []; }
  FX.prototype.swing = function (x, y, angle, reach) {
    this.swings.push({ x, y, angle, reach, life: 0.18, max: 0.18 });
  };
  FX.prototype.blood = function (x, y, color) {
    color = color || "#9e2b25";
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 70;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3, max: 0.7, size: 2 + Math.random() * 2, color });
    }
  };
  FX.prototype.spark = function (x, y, angle, color) {
    color = color || "#ff9a3c";
    for (let i = 0; i < 14; i++) {
      const a = angle + (Math.random() - 0.5) * 1.0, s = 60 + Math.random() * 120;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.3, max: 0.6, size: 2 + Math.random() * 2, color });
    }
  };
  FX.prototype.update = function (dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.9; p.vy *= 0.9;
      p.life -= dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.swings.length - 1; i >= 0; i--) {
      this.swings[i].life -= dt;
      if (this.swings[i].life <= 0) this.swings.splice(i, 1);
    }
  };

  // ---------- Renderer ----------
  function Renderer(canvas) {
    this.canvas = canvas;
    // Opaque backing buffer: the world fills the screen, so we never need the
    // canvas to be transparent. This lets the browser skip per-pixel blending.
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.W = canvas.width;
    this.H = canvas.height;
    this.cam = { x: 0, y: 0 };
    this.light = document.createElement("canvas");
    this.light.width = this.W; this.light.height = this.H;
    this.lctx = this.light.getContext("2d");
    this.time = 0;
    // Static terrain is baked to an offscreen canvas once per zone, then blitted.
    this.terrain = null;
    this.terrainZone = null;
  }

  Renderer.prototype.centerOn = function (e, world) {
    this.cam.x = Math.round(Math.min(Math.max(e.x - this.W / 2, 0), Math.max(0, world.w - this.W)));
    this.cam.y = Math.round(Math.min(Math.max(e.y - this.H / 2, 0), Math.max(0, world.h - this.H)));
  };

  Renderer.prototype.draw = function (game, dt) {
    this.time += dt;
    const ctx = this.ctx, world = game.world, cam = this.cam;
    this.centerOn(game.player, world);

    // Terrain is static, so bake the whole zone once and just blit the slice the
    // camera can see. One drawImage replaces hundreds of per-tile fill/stroke ops.
    if (this.terrainZone !== world.id) this._bakeTerrain(world);
    ctx.fillStyle = "#06060c";
    ctx.fillRect(0, 0, this.W, this.H);
    const sw = Math.min(this.W, world.w - cam.x);
    const sh = Math.min(this.H, world.h - cam.y);
    ctx.drawImage(this.terrain, cam.x, cam.y, sw, sh, 0, 0, sw, sh);

    const c0 = Math.max(0, (cam.x / TILE) | 0);
    const r0 = Math.max(0, (cam.y / TILE) | 0);
    const c1 = Math.min(world.cols - 1, ((cam.x + this.W) / TILE | 0) + 1);
    const r1 = Math.min(world.rows - 1, ((cam.y + this.H) / TILE | 0) + 1);

    // The only animated terrain: water shimmer, drawn over the baked base for
    // the handful of water tiles currently on screen.
    this._waterShimmer(ctx, world, c0, r0, c1, r1);

    this._drawPortals(ctx, world);
    this._drawContainers(ctx, game);

    // Entities, depth-sorted by y.
    const ents = [];
    for (const e of game.enemies) if (!e.dead) ents.push(e);
    for (const n of game.npcs) ents.push(n);
    for (const s of game.summons) ents.push(s);
    ents.push(game.player);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e === game.player) this._drawPlayer(ctx, e);
      else if (e.isNpc) this._drawNpc(ctx, e);
      else if (e.def && e.def.baseHp != null) this._drawSummon(ctx, e);   // summon defs carry baseHp
      else this._drawEnemy(ctx, e);
    }

    this._drawSwings(ctx, game.fx);
    this._drawParticles(ctx, game.fx);
    this._lighting(game, world);
  };

  // Bake every static tile of the zone into an offscreen canvas (world-sized).
  // Coordinates here are world-space — no camera — because the result is reused
  // across frames and we just blit the visible window of it in draw().
  Renderer.prototype._bakeTerrain = function (world) {
    const cv = this.terrain || (this.terrain = document.createElement("canvas"));
    cv.width = world.w; cv.height = world.h;
    const tctx = cv.getContext("2d");
    for (let r = 0; r < world.rows; r++)
      for (let c = 0; c < world.cols; c++)
        if (world.grid[r][c] !== T.WALL) this._floorTile(tctx, c, r, world);
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const v = world.grid[r][c];
        if (v === T.WALL) this._wallTile(tctx, c, r, world);
        else if (v === T.WATER) this._waterTile(tctx, c, r);
        else if (v === T.TREE) this._treeTile(tctx, c, r);
        else if (v === T.ROCK) this._rockTile(tctx, c, r);
      }
    }
    this.terrainZone = world.id;
  };

  // Animated water lines, drawn live over the baked water base (visible tiles only).
  Renderer.prototype._waterShimmer = function (ctx, world, c0, r0, c1, r1) {
    ctx.strokeStyle = "rgba(150,190,220,0.25)"; ctx.lineWidth = 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (world.grid[r][c] !== T.WATER) continue;
        const x = c * TILE - this.cam.x, y = r * TILE - this.cam.y;
        for (let i = 0; i < 2; i++) {
          const yy = y + 9 + i * 12 + Math.sin(this.time * 1.6 + c + i) * 2;
          ctx.beginPath(); ctx.moveTo(x + 3, yy); ctx.lineTo(x + TILE - 3, yy); ctx.stroke();
        }
      }
    }
  };

  Renderer.prototype._floorTile = function (ctx, c, r, world) {
    const x = c * TILE, y = r * TILE;
    const g = world.ambient.ground;
    const n = hash2(c, r);
    const j = Math.floor(n * 16) - 6;
    ctx.fillStyle = `rgb(${g[0] + j},${g[1] + j},${g[2] + j})`;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    if (n > 0.86) {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.moveTo(x + 4 + n * 18, y + 6); ctx.lineTo(x + 10 + n * 12, y + 24); ctx.stroke();
    }
    if (world.rubble[r][c]) {
      ctx.fillStyle = "rgba(90,78,60,0.6)";
      for (let i = 0; i < 4; i++)
        ctx.fillRect(x + 4 + hash2(c * 7 + i, r) * 22, y + 4 + hash2(c, r * 7 + i) * 22, 3, 3);
    }
  };

  Renderer.prototype._wallTile = function (ctx, c, r, world) {
    const x = c * TILE, y = r * TILE;
    const southFloor = r + 1 < world.rows && world.grid[r + 1][c] === T.FLOOR;
    ctx.fillStyle = "#2c2620"; ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
    for (let by = 0; by < TILE; by += 8) { ctx.beginPath(); ctx.moveTo(x, y + by + 0.5); ctx.lineTo(x + TILE, y + by + 0.5); ctx.stroke(); }
    ctx.fillStyle = "rgba(120,104,80,0.4)"; ctx.fillRect(x, y, TILE, 3);
    if (southFloor) {
      ctx.fillStyle = "#211c17"; ctx.fillRect(x, y + TILE - 6, TILE, 6);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x, y + TILE, TILE, 6);
    }
  };

  Renderer.prototype._waterTile = function (ctx, c, r) {
    const x = c * TILE, y = r * TILE;
    // Static base only; the moving shimmer is layered live in _waterShimmer.
    ctx.fillStyle = "#243a55"; ctx.fillRect(x, y, TILE, TILE);
  };

  Renderer.prototype._treeTile = function (ctx, c, r) {
    const x = c * TILE, y = r * TILE;
    const n = hash2(c, r);
    ctx.fillStyle = "#3a2c1c"; ctx.fillRect(x + TILE / 2 - 2, y + TILE - 12, 4, 12); // trunk
    const cr = 11 + n * 2;
    ctx.fillStyle = "#24401f";
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2 - 1, cr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2f5527";
    ctx.beginPath(); ctx.arc(x + TILE / 2 - 3, y + TILE / 2 - 4, cr * 0.6, 0, Math.PI * 2); ctx.fill();
  };

  Renderer.prototype._rockTile = function (ctx, c, r) {
    const x = c * TILE, y = r * TILE;
    ctx.fillStyle = "#5b554c";
    ctx.beginPath(); ctx.ellipse(x + TILE / 2, y + TILE / 2 + 2, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6f6a60";
    ctx.beginPath(); ctx.ellipse(x + TILE / 2 - 2, y + TILE / 2 - 1, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  };

  Renderer.prototype._drawPortals = function (ctx, world) {
    for (const p of world.portals) {
      const x = p.x - this.cam.x, y = p.y - this.cam.y;
      if (p.locked) {
        ctx.fillStyle = "#1a120a"; ctx.fillRect(x - 11, y - 14, 22, 28);
        ctx.strokeStyle = "#7a3a32"; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 14, 22, 28);
        ctx.beginPath(); ctx.moveTo(x - 8, y - 10); ctx.lineTo(x + 8, y + 10);
        ctx.moveTo(x + 8, y - 10); ctx.lineTo(x - 8, y + 10); ctx.stroke();
      } else {
        ctx.fillStyle = "#0d0a06"; ctx.fillRect(x - 11, y - 14, 22, 28);
        ctx.strokeStyle = "#caa24a"; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 14, 22, 28);
        // Inviting glow.
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
        g.addColorStop(0, "rgba(210,170,80,0.25)"); g.addColorStop(1, "rgba(210,170,80,0)");
        ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  };

  Renderer.prototype._drawContainers = function (ctx, game) {
    for (const c of game.containers) {
      const x = c.x - this.cam.x, y = c.y - this.cam.y;
      ctx.fillStyle = c.opened ? "#3a2c1c" : "#6b4f2a";
      ctx.fillRect(x - 10, y - 7, 20, 14);
      ctx.strokeStyle = "#caa24a"; ctx.lineWidth = 1.5; ctx.strokeRect(x - 10, y - 7, 20, 14);
      ctx.fillStyle = "#caa24a";
      if (c.opened) { ctx.fillRect(x - 10, y - 7, 20, 3); }   // lid flipped back
      else {
        ctx.fillRect(x - 1, y - 2, 2, 4);                     // latch
        // a little shine to read as "interactive"
        const bob = Math.sin(this.time * 3 + c.x) * 1.5;
        ctx.font = "10px serif"; ctx.textAlign = "center";
        ctx.fillText("✦", x, y - 11 + bob); ctx.textAlign = "left";
      }
    }
  };

  Renderer.prototype._shadow = function (ctx, e) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x - this.cam.x, e.y - this.cam.y + e.radius - 1, e.radius, e.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  Renderer.prototype._drawPlayer = function (ctx, p) {
    this._shadow(ctx, p);
    const x = p.x - this.cam.x, y = p.y - this.cam.y;
    // Aura when buffs/levitation are active.
    if (p.activeEffects && p.activeEffects.length) {
      const c = p.activeEffects[p.activeEffects.length - 1].color;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 2, x, y, p.radius + 8 + Math.sin(this.time * 6) * 2);
      g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.35; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, p.radius + 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    ctx.fillStyle = p.hitFlash > 0 ? "#ffd9d2" : p.color;
    ctx.beginPath(); ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a3024"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#5b4a8a";
    ctx.beginPath(); ctx.arc(x, y, p.radius - 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8e0cf";
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.facing) * (p.radius + 2), y + Math.sin(p.facing) * (p.radius + 2), 3, 0, Math.PI * 2);
    ctx.fill();
  };

  Renderer.prototype._drawEnemy = function (ctx, e) {
    this._shadow(ctx, e);
    const x = e.x - this.cam.x, y = e.y - this.cam.y;
    ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : e.color;
    ctx.beginPath(); ctx.arc(x, y, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = e.calmedFor > 0 ? "#7fb0e0" : (e.aggro ? "#ff5640" : "#1a1a1a");
    ctx.fillRect(x - 4, y - 2, 2, 2); ctx.fillRect(x + 2, y - 2, 2, 2);
    if (e.calmedFor > 0) { ctx.fillStyle = "#a6c4ec"; ctx.font = "9px serif"; ctx.textAlign = "center"; ctx.fillText("z", x + 6, y - 8); ctx.textAlign = "left"; }
    if (e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - e.radius, y - e.radius - 7, w, 3);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(x - e.radius, y - e.radius - 7, w * (e.hp / e.maxHp), 3);
    }
  };

  Renderer.prototype._drawSummon = function (ctx, s) {
    this._shadow(ctx, s);
    const x = s.x - this.cam.x, y = s.y - this.cam.y;
    // Glowing, semi-ethereal ally.
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 1, x, y, s.radius + 7);
    g.addColorStop(0, s.color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.5; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s.radius + 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(x, y, s.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    // Fading ring as the summon's time runs out.
    if (s.life < 4) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(this.time * 10); ctx.strokeStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, s.radius + 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  };

  Renderer.prototype._drawNpc = function (ctx, n) {
    this._shadow(ctx, n);
    const x = n.x - this.cam.x, y = n.y - this.cam.y;
    ctx.fillStyle = "#b9a05a";
    ctx.beginPath(); ctx.arc(x, y, n.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a3024"; ctx.lineWidth = 2; ctx.stroke();
    const bob = Math.sin(this.time * 3) * 2;
    ctx.fillStyle = "#d9a441"; ctx.font = "bold 14px serif"; ctx.textAlign = "center";
    ctx.fillText("!", x, y - n.radius - 6 + bob);
    ctx.textAlign = "left";
  };

  Renderer.prototype._drawSwings = function (ctx, fx) {
    for (const s of fx.swings) {
      const t = s.life / s.max;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * t})`; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x - this.cam.x, s.y - this.cam.y, s.reach, s.angle - 0.6, s.angle + 0.6);
      ctx.stroke();
    }
  };

  Renderer.prototype._drawParticles = function (ctx, fx) {
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - this.cam.x - p.size / 2, p.y - this.cam.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  // Darkness overlay with light carved out around torches + the player.
  // Zone ambient.darkness controls how black it gets (cave vs. daylight).
  Renderer.prototype._lighting = function (game, world) {
    const amb = world.ambient;
    const l = this.lctx;
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, this.W, this.H);
    l.fillStyle = `rgba(6,6,12,${amb.darkness})`;
    l.fillRect(0, 0, this.W, this.H);

    l.globalCompositeOperation = "destination-out";
    const carve = (x, y, radius, strength) => {
      const sx = x - this.cam.x, sy = y - this.cam.y;
      const g = l.createRadialGradient(sx, sy, 0, sx, sy, radius);
      g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(1, "rgba(0,0,0,0)");
      l.fillStyle = g; l.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    };
    carve(game.player.x, game.player.y, amb.light, 0.95);
    for (const t of world.torches) {
      const flick = 0.85 + Math.sin(this.time * 9 + t.x) * 0.08 + Math.random() * 0.04;
      carve(t.x, t.y, 95 * flick, 1.0);
    }
    this.ctx.drawImage(this.light, 0, 0);

    // Warm torch glow + flame nubs on top.
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    for (const t of world.torches) {
      const sx = t.x - this.cam.x, sy = t.y - this.cam.y;
      const flick = 0.8 + Math.sin(this.time * 9 + t.x) * 0.2;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70 * flick);
      g.addColorStop(0, "rgba(255,150,40,0.35)"); g.addColorStop(1, "rgba(255,150,40,0)");
      ctx.fillStyle = g; ctx.fillRect(sx - 70, sy - 70, 140, 140);
    }
    ctx.globalCompositeOperation = "source-over";
    for (const t of world.torches) {
      const sx = t.x - this.cam.x, sy = t.y - this.cam.y;
      const h = 6 + Math.sin(this.time * 12 + t.y) * 2;
      ctx.fillStyle = "#ffcf6b"; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 3, h, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff7a1a"; ctx.beginPath(); ctx.ellipse(sx, sy, 2, h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  RPG.Renderer = Renderer;
  RPG.FX = FX;
})(window.RPG = window.RPG || {});
