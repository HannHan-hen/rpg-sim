/* render.js — all graphics are drawn here, in code. No image files.
   The "pretty" comes from: layered floor tinting, faux-depth walls,
   flickering torch light carved out of a darkness overlay, and particles.
   It's deliberately cheap so it runs on a weak machine. */

(function (RPG) {
  "use strict";

  const TILE = RPG.TILE;

  // Stable per-tile pseudo-random in [0,1) so floor detail doesn't shimmer.
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
    this.ctx = canvas.getContext("2d");
    this.W = canvas.width;
    this.H = canvas.height;
    this.cam = { x: 0, y: 0 };
    this.light = document.createElement("canvas");
    this.light.width = this.W; this.light.height = this.H;
    this.lctx = this.light.getContext("2d");
    this.time = 0;
  }

  Renderer.prototype.centerOn = function (e, world) {
    this.cam.x = Math.round(Math.min(Math.max(e.x - this.W / 2, 0), Math.max(0, world.w - this.W)));
    this.cam.y = Math.round(Math.min(Math.max(e.y - this.H / 2, 0), Math.max(0, world.h - this.H)));
  };

  Renderer.prototype.draw = function (game, dt) {
    this.time += dt;
    const ctx = this.ctx, world = game.world, cam = this.cam;
    this.centerOn(game.player, world);

    ctx.clearRect(0, 0, this.W, this.H);

    const c0 = Math.max(0, (cam.x / TILE) | 0);
    const r0 = Math.max(0, (cam.y / TILE) | 0);
    const c1 = Math.min(world.cols - 1, ((cam.x + this.W) / TILE | 0) + 1);
    const r1 = Math.min(world.rows - 1, ((cam.y + this.H) / TILE | 0) + 1);

    // Floor
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (world.grid[r][c] === 1) continue;
        this._floorTile(ctx, c, r, world);
      }
    }
    // Walls (drawn after floor so faux-depth faces overlap correctly)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (world.grid[r][c] !== 1) continue;
        this._wallTile(ctx, c, r, world);
      }
    }

    // Exit door
    if (world.spawns.exit) {
      const e = world.spawns.exit;
      ctx.fillStyle = "#1a120a";
      ctx.fillRect(e.x - cam.x - 11, e.y - cam.y - 15, 22, 30);
      ctx.strokeStyle = "#caa24a"; ctx.lineWidth = 2;
      ctx.strokeRect(e.x - cam.x - 11, e.y - cam.y - 15, 22, 30);
    }

    // Entities, depth-sorted by y
    const ents = [];
    for (const e of game.enemies) if (!e.dead) ents.push(e);
    for (const n of game.npcs) ents.push(n);
    ents.push(game.player);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e === game.player) this._drawPlayer(ctx, e);
      else if (e.isNpc) this._drawNpc(ctx, e);
      else this._drawEnemy(ctx, e);
    }

    // Swing arcs + particles
    this._drawSwings(ctx, game.fx);
    this._drawParticles(ctx, game.fx);

    // Lighting pass last
    this._lighting(game, world);
  };

  Renderer.prototype._floorTile = function (ctx, c, r, world) {
    const x = c * TILE - this.cam.x, y = r * TILE - this.cam.y;
    const n = hash2(c, r);
    // Base flagstone with subtle per-tile tint variation.
    const shade = 26 + Math.floor(n * 14);
    ctx.fillStyle = `rgb(${shade + 8},${shade + 4},${shade - 2})`;
    ctx.fillRect(x, y, TILE, TILE);
    // Grout lines.
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    // Occasional crack / pebble for texture.
    if (n > 0.82) {
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.moveTo(x + 4 + n * 18, y + 6);
      ctx.lineTo(x + 10 + n * 12, y + 24);
      ctx.stroke();
    }
    if (world.rubble[r][c]) {
      ctx.fillStyle = "rgba(90,78,60,0.5)";
      for (let i = 0; i < 4; i++) {
        const px = x + 4 + hash2(c * 7 + i, r) * 22;
        const py = y + 4 + hash2(c, r * 7 + i) * 22;
        ctx.fillRect(px, py, 3, 3);
      }
    }
  };

  Renderer.prototype._wallTile = function (ctx, c, r, world) {
    const x = c * TILE - this.cam.x, y = r * TILE - this.cam.y;
    const southFloor = r + 1 < world.rows && world.grid[r + 1][c] === 0;
    // Wall body.
    ctx.fillStyle = "#2c2620";
    ctx.fillRect(x, y, TILE, TILE);
    // Brick courses.
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
    for (let by = 0; by < TILE; by += 8) {
      ctx.beginPath(); ctx.moveTo(x, y + by + 0.5); ctx.lineTo(x + TILE, y + by + 0.5); ctx.stroke();
    }
    // Top highlight (catches the light).
    ctx.fillStyle = "rgba(120,104,80,0.4)";
    ctx.fillRect(x, y, TILE, 3);
    // Faux-depth face + drop shadow where a wall meets floor to the south.
    if (southFloor) {
      ctx.fillStyle = "#211c17";
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, y + TILE, TILE, 6);
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
    // Body
    ctx.fillStyle = p.hitFlash > 0 ? "#ffd9d2" : p.color;
    ctx.beginPath(); ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a3024"; ctx.lineWidth = 2; ctx.stroke();
    // Cloak/back
    ctx.fillStyle = "#5b4a8a";
    ctx.beginPath(); ctx.arc(x, y, p.radius - 3, 0, Math.PI * 2); ctx.fill();
    // Facing indicator (a little blade-tip nub)
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
    // Eyes — a little menace.
    ctx.fillStyle = e.aggro ? "#ff5640" : "#1a1a1a";
    ctx.fillRect(x - 4, y - 2, 2, 2);
    ctx.fillRect(x + 2, y - 2, 2, 2);
    // HP pip bar when hurt.
    if (e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - e.radius, y - e.radius - 7, w, 3);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(x - e.radius, y - e.radius - 7, w * (e.hp / e.maxHp), 3);
    }
  };

  Renderer.prototype._drawNpc = function (ctx, n) {
    this._shadow(ctx, n);
    const x = n.x - this.cam.x, y = n.y - this.cam.y;
    ctx.fillStyle = "#b9a05a";
    ctx.beginPath(); ctx.arc(x, y, n.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a3024"; ctx.lineWidth = 2; ctx.stroke();
    // Floating "talk" marker.
    const bob = Math.sin(this.time * 3) * 2;
    ctx.fillStyle = "#d9a441";
    ctx.font = "bold 14px serif";
    ctx.textAlign = "center";
    ctx.fillText("!", x, y - n.radius - 6 + bob);
    ctx.textAlign = "left";
  };

  Renderer.prototype._drawSwings = function (ctx, fx) {
    for (const s of fx.swings) {
      const t = s.life / s.max;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * t})`;
      ctx.lineWidth = 3;
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
  Renderer.prototype._lighting = function (game, world) {
    const l = this.lctx;
    l.globalCompositeOperation = "source-over";
    l.fillStyle = "rgba(6,6,12,0.82)";
    l.fillRect(0, 0, this.W, this.H);

    l.globalCompositeOperation = "destination-out";

    const carve = (x, y, radius, strength) => {
      const sx = x - this.cam.x, sy = y - this.cam.y;
      const g = l.createRadialGradient(sx, sy, 0, sx, sy, radius);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      l.fillStyle = g;
      l.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    };

    // Player carries a soft light.
    carve(game.player.x, game.player.y, 150, 0.95);

    // Torches flicker.
    for (const t of world.torches) {
      const flick = 0.85 + Math.sin(this.time * 9 + t.x) * 0.08 + Math.random() * 0.04;
      carve(t.x, t.y, 95 * flick, 1.0);
    }

    this.ctx.drawImage(this.light, 0, 0);

    // Warm additive glow + torch flame sprites on top of the darkness.
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    for (const t of world.torches) {
      const sx = t.x - this.cam.x, sy = t.y - this.cam.y;
      const flick = 0.8 + Math.sin(this.time * 9 + t.x) * 0.2;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70 * flick);
      g.addColorStop(0, "rgba(255,150,40,0.35)");
      g.addColorStop(1, "rgba(255,150,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 70, sy - 70, 140, 140);
    }
    ctx.globalCompositeOperation = "source-over";
    // Flame nubs.
    for (const t of world.torches) {
      const sx = t.x - this.cam.x, sy = t.y - this.cam.y;
      const h = 6 + Math.sin(this.time * 12 + t.y) * 2;
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath(); ctx.ellipse(sx, sy - 2, 3, h, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff7a1a";
      ctx.beginPath(); ctx.ellipse(sx, sy, 2, h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  RPG.Renderer = Renderer;
  RPG.FX = FX;
})(window.RPG = window.RPG || {});
