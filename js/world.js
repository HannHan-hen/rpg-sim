/* world.js — turns a zone DEFINITION (from zones.js) into a live map:
   collision grid, terrain types, torches, portals, named entry points, and
   spawn lists. The engine no longer hardcodes any single map. */

(function (RPG) {
  "use strict";

  const TILE = 32;

  // Grid cell values. 0 is walkable; everything else blocks.
  const FLOOR = 0, WALL = 1, WATER = 2, TREE = 3, ROCK = 4;

  function World(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.tile = TILE;
    this.ambient = Object.assign({ darkness: 0.8, ground: [34, 30, 24], light: 150 }, def.ambient || {});

    this.rows = def.rows.length;
    this.cols = def.rows.reduce((m, r) => Math.max(m, r.length), 0);
    this.w = this.cols * TILE;
    this.h = this.rows * TILE;

    this.grid = [];
    this.rubble = [];
    this.torches = [];
    this.portals = [];
    this.entries = {};
    this.spawns = { npcs: [], enemies: [] };

    this._parse(def);
  }

  World.prototype._parse = function (def) {
    const portalDefs = def.portals || {};
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      this.rubble[r] = [];
      const row = def.rows[r];
      for (let c = 0; c < this.cols; c++) {
        const ch = c < row.length ? row[c] : "#";   // pad short rows with wall
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;
        let v = FLOOR;
        this.rubble[r][c] = false;

        switch (ch) {
          case "#": v = WALL; break;
          case "~": v = WATER; break;
          case "%": v = TREE; break;
          case "o": v = ROCK; break;
          case ",": this.rubble[r][c] = true; break;
          case "t": this.torches.push({ x: cx, y: cy }); break;
          case "P": this.entries.start = { x: cx, y: cy }; break;
          default:
            if (portalDefs[ch]) {
              const pd = portalDefs[ch];
              this.portals.push({ x: cx, y: cy, col: c, row: r,
                to: pd.to, entry: pd.entry, locked: !!pd.locked, label: pd.label });
            }
            break; // any other char is plain floor
        }
        this.grid[r][c] = v;
      }
    }

    // Named entries declared as [col,row] in the zone data.
    const ents = def.entries || {};
    for (const name in ents) {
      const e = ents[name];
      this.entries[name] = { x: e[0] * TILE + TILE / 2, y: e[1] * TILE + TILE / 2 };
    }

    (def.npcs || []).forEach((n) => {
      this.spawns.npcs.push({ id: n.id, x: n.at[0] * TILE + TILE / 2, y: n.at[1] * TILE + TILE / 2 });
    });
    (def.enemies || []).forEach((e) => {
      this.spawns.enemies.push({ type: e.type, x: e.at[0] * TILE + TILE / 2, y: e.at[1] * TILE + TILE / 2 });
    });
  };

  World.prototype.tileAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return WALL;
    return this.grid[(y / TILE) | 0][(x / TILE) | 0];
  };

  World.prototype.isWallAt = function (x, y) {
    return this.tileAt(x, y) !== FLOOR;
  };

  // Circle-vs-grid collision: can an entity of `radius` stand at (x,y)?
  World.prototype.blocked = function (x, y, radius) {
    return (
      this.isWallAt(x - radius, y - radius) ||
      this.isWallAt(x + radius, y - radius) ||
      this.isWallAt(x - radius, y + radius) ||
      this.isWallAt(x + radius, y + radius)
    );
  };

  // Slide-along-walls movement: try full move, then each axis separately.
  World.prototype.moveCircle = function (e, dx, dy) {
    if (!this.blocked(e.x + dx, e.y + dy, e.radius)) { e.x += dx; e.y += dy; return; }
    if (!this.blocked(e.x + dx, e.y, e.radius)) e.x += dx;
    if (!this.blocked(e.x, e.y + dy, e.radius)) e.y += dy;
  };

  // Which portal (if any) is the given world point standing on?
  World.prototype.portalAtTile = function (x, y) {
    const c = (x / TILE) | 0, r = (y / TILE) | 0;
    for (const p of this.portals) if (p.col === c && p.row === r) return p;
    return null;
  };

  RPG.World = World;
  RPG.TILE = TILE;
  RPG.TILES = { FLOOR, WALL, WATER, TREE, ROCK };
})(window.RPG = window.RPG || {});
