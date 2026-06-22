/* rng.js — deterministic, seedable random number generator + dice helpers.
   A single shared RNG keeps the "dice decide" feel reproducible for a save. */

(function (RPG) {
  "use strict";

  // mulberry32: tiny, fast, good-enough PRNG for a game.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const RNG = {
    _next: mulberry32((Math.random() * 1e9) | 0),
    seed: 0,

    reseed: function (seed) {
      this.seed = seed >>> 0;
      this._next = mulberry32(this.seed);
    },

    // float in [0,1)
    f: function () { return this._next(); },

    // integer in [min, max] inclusive
    int: function (min, max) {
      return min + Math.floor(this._next() * (max - min + 1));
    },

    // float in [min, max)
    range: function (min, max) {
      return min + this._next() * (max - min);
    },

    // roll a d100, return 1..100
    d100: function () { return this.int(1, 100); },

    // true with the given percent chance (0..100)
    chance: function (percent) {
      return this.d100() <= percent;
    },

    // pick a random element
    pick: function (arr) { return arr[this.int(0, arr.length - 1)]; }
  };

  RPG.RNG = RNG;
})(window.RPG = window.RPG || {});
