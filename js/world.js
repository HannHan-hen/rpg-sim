/* world.js — the map. A small ruined hall, authored as a text grid so it is
   trivial to read and to expand into more areas later. Floor detail (cracks,
   tint) is generated procedurally per-tile at draw time, not stored as art. */

(function (RPG) {
  "use strict";

  const TILE = 32;

  // # wall   . floor   , rubble floor (cosmetic)   t wall-torch
  // P player  N npc   r/s/k enemies   D exit door
  const MAP = [
    "############################",
    "#..........#.......t.......#",
    "#..t.......#...............#",
    "#..........#......r........#",
    "#....P.....D...............#",
    "#..........#...........,,..#",
    "#..........#....s......,,..#",
    "#####.######...............#",
    "#...........t..............#",
    "#...,,......................#",
    "#...,,..........k..........t#",
    "#..........#######.........#",
    "#..........#.....#.........#",
    "#....N.....#.....#....r.....#",
    "#..........#.....#.........#",
    "#..t.......#.....#......t...#",
    "#..........................#",
    "############################"
  ];

  function World() {
    this.tile = TILE;
    this.rows = MAP.length;
    this.cols = MAP[0].length;
    this.w = this.cols * TILE;
    this.h = this.rows * TILE;
    this.grid = [];        // 0 floor, 1 wall
    this.rubble = [];      // cosmetic floor flag
    this.torches = [];     // {x,y} wall torch positions (world coords)
    this.spawns = { enemies: [], npcs: [], player: { x: 64, y: 64 }, exit: null };

    this._parse();
  }

  World.prototype._parse = function () {
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      this.rubble[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const ch = MAP[r][c];
        const wall = ch === "#";
        this.grid[r][c] = wall ? 1 : 0;
        this.rubble[r][c] = ch === ",";

        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;

        switch (ch) {
          case "t": this.torches.push({ x: cx, y: cy }); break;
          case "P": this.spawns.player = { x: cx, y: cy }; break;
          case "D": this.spawns.exit = { x: cx, y: cy }; break;
          case "N": this.spawns.npcs.push({ x: cx, y: cy }); break;
          case "r": this.spawns.enemies.push({ type: "rat", x: cx, y: cy }); break;
          case "s": this.spawns.enemies.push({ type: "scrib", x: cx, y: cy }); break;
          case "k": this.spawns.enemies.push({ type: "skeleton", x: cx, y: cy }); break;
        }
      }
    }
  };

  World.prototype.isWallAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    const c = (x / TILE) | 0;
    const r = (y / TILE) | 0;
    return this.grid[r][c] === 1;
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

  // Slide-along-walls movement: try full move, then axis-separated.
  World.prototype.moveCircle = function (e, dx, dy) {
    if (!this.blocked(e.x + dx, e.y + dy, e.radius)) { e.x += dx; e.y += dy; return; }
    if (!this.blocked(e.x + dx, e.y, e.radius)) e.x += dx;
    if (!this.blocked(e.x, e.y + dy, e.radius)) e.y += dy;
  };

  RPG.World = World;
  RPG.TILE = TILE;
})(window.RPG = window.RPG || {});
