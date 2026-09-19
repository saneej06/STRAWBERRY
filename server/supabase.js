import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

function loadEnv() {
  const candidates = [
    join(PROJECT_ROOT, ".env.local"),
    join(PROJECT_ROOT, ".env"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex < 1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {}
  }
}

loadEnv();

// Normalize the URL. Some users paste the Dashboard's "REST & PostgREST" URL
// (https://<ref>.supabase.co/rest/v1) which the JS client appends itself.
const SUPABASE_URL =
  (process.env.SUPABASE_URL || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

let _client = null;

export function getSupabase() {
  if (!isConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (server-side only, never expose the service role key to the browser)."
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

// Lazy client object so `supabase.from(...)` works while the client is only
// created once credentials are available (keeps the dev server startable
// before environment variables are set).
export const supabase = new Proxy({}, {
  get(_, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

// Lightweight readiness check. PostgREST cannot run DDL, so the schema must be
// applied once via supabase/migrations/0001_initial_schema.sql (Supabase SQL
// Editor or `supabase db push`). This verifies the tables exist and gives an
// actionable error if not.
export async function ensureSchema() {
  const client = getSupabase();
  const { error } = await client.from("profiles").select("id").limit(1);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      throw new Error(
        "Supabase tables are missing. Open the Supabase Dashboard > SQL Editor and run supabase/migrations/0001_initial_schema.sql (or run `supabase db push`). " +
          error.message
      );
    }
    throw new Error(`Supabase connection check failed (${error.code || "unknown"}): ${error.message}`);
  }
}