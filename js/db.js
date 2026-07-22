/* ============================================================
   db.js — Database service (Supabase)
   MIGRATED from localStorage → Supabase.
   All methods are now async / return Promises.
   Depends on: supabase.js (window.supabase must exist)

   Table mapping (Supabase table name ← app key):
     purchases  ← 'purchase'
     sellings   ← 'selling'
     meta       ← internal key-value store (manual sold qty, etc.)
============================================================ */

const TABLES = {
  purchase: 'purchases',
  selling:  'sellings',
  meta:     'meta',
  notes:    'notes'
};

const DB = {

  /* ----------------------------------------------------------
     getAll(table)
     Returns all rows from the given table, ordered by id.
  ---------------------------------------------------------- */
  async getAll(table) {
    const { data, error } = await window.supabase
      .from(TABLES[table])
      .select('*')
      .order('id', { ascending: true });
    if (error) { console.error('DB.getAll error', error); return []; }
    return data || [];
  },

  /* ----------------------------------------------------------
     getById(table, id)
     Returns a single row by primary key, or null.
  ---------------------------------------------------------- */
  async getById(table, id) {
    const { data, error } = await window.supabase
      .from(TABLES[table])
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('DB.getById error', error); return null; }
    return data || null;
  },

  /* ----------------------------------------------------------
     insert(table, record)
     Inserts one record and returns the saved row (with id).
     Do NOT pass id/created_at — Supabase generates them.
  ---------------------------------------------------------- */
  async insert(table, record) {
    // Strip client-side id so Supabase auto-generates it.
    const clean = { ...record };
    delete clean.id;
    delete clean.created_at;

    const { data, error } = await window.supabase
      .from(TABLES[table])
      .insert([clean])
      .select()
      .single();
    if (error) { console.error('DB.insert error', error); throw error; }
    return data;
  },

  /* ----------------------------------------------------------
     update(table, id, updates)
     Updates an existing row by id. Returns the updated row.
  ---------------------------------------------------------- */
  async update(table, id, updates) {
    const clean = { ...updates };
    delete clean.id;
    delete clean.created_at;

    const { data, error } = await window.supabase
      .from(TABLES[table])
      .update(clean)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) { console.error('DB.update error', error); throw error; }
    return data;
  },

  /* ----------------------------------------------------------
     remove(table, id)
     Deletes a row by id.
  ---------------------------------------------------------- */
  async remove(table, id) {
    const { error } = await window.supabase
      .from(TABLES[table])
      .delete()
      .eq('id', Number(id));
    if (error) { console.error('DB.remove error', error); throw error; }
    return true;
  },

  /* ----------------------------------------------------------
     replaceAll(table, records)
     Wipes the table and bulk-inserts the provided records.
     Used by importAll / restore backup.
  ---------------------------------------------------------- */
  async replaceAll(table, records) {
    // Delete every row in the table.
    const { error: delErr } = await window.supabase
      .from(TABLES[table])
      .delete()
      .gte('id', 0);            // matches all rows
    if (delErr) { console.error('DB.replaceAll delete error', delErr); throw delErr; }

    if (records && records.length > 0) {
      const clean = records.map(r => {
        const c = { ...r };
        delete c.id;            // let Supabase assign new ids
        delete c.created_at;
        return c;
      });
      const { error: insErr } = await window.supabase
        .from(TABLES[table])
        .insert(clean);
      if (insErr) { console.error('DB.replaceAll insert error', insErr); throw insErr; }
    }
  },

  /* ----------------------------------------------------------
     clearAll()
     Deletes all purchases and sellings (used by "Clear All").
  ---------------------------------------------------------- */
  async clearAll() {
    await window.supabase.from('purchases').delete().gte('id', 0);
    await window.supabase.from('sellings').delete().gte('id', 0);
  },

  /* ----------------------------------------------------------
     exportAll()
     Returns an object with all data — for JSON backup download.
  ---------------------------------------------------------- */
  async exportAll() {
    const purchases = await this.getAll('purchase');
    const sellings  = await this.getAll('selling');
    return {
      app:         'Shakti Traders',
      exported_at: new Date().toISOString(),
      purchases,
      sellings
    };
  },

  /* ----------------------------------------------------------
     importAll(data)
     Validates and restores data from a backup JSON object.
  ---------------------------------------------------------- */
  async importAll(data) {
    if (!data || !Array.isArray(data.purchases) || !Array.isArray(data.sellings)) {
      throw new Error('Invalid backup file format');
    }
    await this.replaceAll('purchase', data.purchases);
    await this.replaceAll('selling',  data.sellings);
  },

  /* ----------------------------------------------------------
     getMeta(key)  /  setMeta(key, value)
     Key-value store in the `meta` table.
     value is automatically JSON-serialised/deserialised.
     Used for manual sold quantity totals (and any future settings).
  ---------------------------------------------------------- */
  async getMeta(key) {
    const { data, error } = await window.supabase
      .from('meta')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) { console.error('DB.getMeta error', error); return null; }
    return data ? data.value : null;   // raw JSON string or null
  },

  async setMeta(key, value) {
    const { error } = await window.supabase
      .from('meta')
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
    if (error) { console.error('DB.setMeta error', error); throw error; }
  }
};
