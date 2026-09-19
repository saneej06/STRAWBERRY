// Compatibility shim.
// STRAWBERRY migrated from SQLite (better-sqlite3) to Supabase PostgreSQL.
// All data access now goes through the server-side Supabase client; this module
// re-exports the shared helpers so existing imports keep working unchanged.
export { supabase, getSupabase, ensureSchema } from "./supabase.js";