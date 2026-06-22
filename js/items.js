/* items.js — item instances and loot. A weapon in the world/inventory is an
   INSTANCE (it can carry its own enchantment and renamed title), distinct from
   its shared definition in data.js. */

(function (RPG) {
  "use strict";
  const Data = RPG.Data;

  RPG.Items = {
    weapon: function (defId) {
      const def = Data.weapons[defId];
      if (!def) return null;
      const inst = { kind: "weapon", defId, baseName: def.name, name: def.name, enchant: null };
      if (def.innateEnchant) inst.enchant = { effect: def.innateEnchant.effect, magnitude: def.innateEnchant.magnitude };
      if (inst.enchant) {
        const e = Data.effects[inst.enchant.effect];
        inst.name = def.name + ` [${e.name.split(" ")[0]} ${inst.enchant.magnitude}]`;
      }
      return inst;
    },

    // Rebuild an instance from saved data (preserves enchant/name).
    fromSave: function (s) {
      if (s.kind === "weapon") {
        const inst = RPG.Items.weapon(s.defId);
        inst.enchant = s.enchant || null;
        inst.name = s.name || inst.name;
        return inst;
      }
      return null;
    },

    describe: function (item) {
      if (!item) return "";
      if (item.kind === "weapon") {
        const d = Data.weapons[item.defId];
        let s = `${item.name} — ${d.min}-${d.max} dmg`;
        if (item.enchant) {
          const e = Data.effects[item.enchant.effect];
          s += `, +${item.enchant.magnitude} ${e.name.split(" ")[0]} on hit`;
        }
        return s;
      }
      return item.name;
    }
  };
})(window.RPG = window.RPG || {});
