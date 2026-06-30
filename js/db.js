/* ============================================================
   db.js — Local in-device database (localStorage based)
   Auto-saves on every write. No server / Supabase required.
============================================================ */

const DB = (() => {
  const KEYS = {
    purchase: 'st_purchases',
    selling: 'st_sellings',
    meta: 'st_meta'
  };

  function _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('DB read error', e);
      return [];
    }
  }

  function _write(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function _nextId(list) {
    return list.length ? Math.max(...list.map(r => r.id)) + 1 : 1;
  }

  return {
    getAll(table) {
      return _read(KEYS[table]);
    },
    getById(table, id) {
      return _read(KEYS[table]).find(r => r.id === Number(id)) || null;
    },
    insert(table, record) {
      const list = _read(KEYS[table]);
      record.id = _nextId(list);
      record.created_at = new Date().toISOString();
      list.push(record);
      _write(KEYS[table], list);
      return record;
    },
    update(table, id, updates) {
      const list = _read(KEYS[table]);
      const idx = list.findIndex(r => r.id === Number(id));
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...updates, id: list[idx].id };
      _write(KEYS[table], list);
      return list[idx];
    },
    remove(table, id) {
      const list = _read(KEYS[table]);
      const filtered = list.filter(r => r.id !== Number(id));
      _write(KEYS[table], filtered);
      return true;
    },
    replaceAll(table, records) {
      _write(KEYS[table], records || []);
    },
    clearAll() {
      _write(KEYS.purchase, []);
      _write(KEYS.selling, []);
    },
    exportAll() {
      return {
        app: 'Shakti Traders',
        exported_at: new Date().toISOString(),
        purchases: _read(KEYS.purchase),
        sellings: _read(KEYS.selling)
      };
    },
    importAll(data) {
      if (!data || !Array.isArray(data.purchases) || !Array.isArray(data.sellings)) {
        throw new Error('Invalid backup file format');
      }
      _write(KEYS.purchase, data.purchases);
      _write(KEYS.selling, data.sellings);
    },
    KEYS
  };
})();
