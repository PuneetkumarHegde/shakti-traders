/* ============================================================
   supabase.js — Supabase client initialisation
   Depends on: config.js (must be loaded before this file)
   Exposes: window.supabase  (used by db.js)
============================================================ */

// Supabase JS v2 is loaded via CDN in index.html.
// createClient comes from the global `supabase` namespace exposed by the CDN.
const { createClient } = supabase;

// Create and expose the client globally so db.js can use it.
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
