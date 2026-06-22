/* save.js — persist the run to localStorage. Inept-human friendly:
   nothing to manage, it just remembers where you were. */

(function (RPG) {
  "use strict";

  const KEY = "ashfall.save.v1";

  RPG.Save = {
    has: function () {
      try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
    },

    write: function (state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    },

    read: function () {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
})(window.RPG = window.RPG || {});
