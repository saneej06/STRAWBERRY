import crypto from "node:crypto";
import { supabase, ensureSchema } from "./supabase.js";
import { createToken, verifyToken } from "./jwt.js";

export function readHeader(req, headerName) {
  const value = req.headers?.[headerName];
  return Array.isArray(value) ? value[0] : value;
}

export function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");
  const proto = readHeader(req, "x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.replace(/\/$/, "");
  }
  if (!isProduction()) {
    return "http://localhost:3000/api/auth-google/callback";
  }
  return `${getAppUrl(req)}/api/auth-google/callback`;
}

export function makeStateToken() {
  const nonce = crypto.randomBytes(16).toString("hex");
  return createToken({ purpose: "google-oauth-state", nonce }, 10 * 60 * 1000);
}

export function verifyStateToken(token) {
  const payload = verifyToken(token || "", { requireIdentity: false });
  return payload?.purpose === "google-oauth-state" ? payload : null;
}

export function parseIdToken(idToken, clientId) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.sub || !payload.email) return null;
    if (payload.aud && payload.aud !== clientId) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeEmail(v) { return typeof v === "string" ? v.trim().toLowerCase() : ""; }

export async function upsertGoogleUser(googleUser) {
  const email = normalizeEmail(googleUser.email);
  if (!email) throw new Error("Google account has no email address");

  const { data: existing } = await supabase.from("users_auth").select("*").eq("email", email).maybeSingle();
  let user = existing;

  if (!user) {
    const id = crypto.randomUUID();
    const displayName = googleUser.name || email.split("@")[0];
    await supabase.from("profiles").insert({ id, name: displayName, email, currency: "LKR" });
    await supabase.from("users_auth").insert({
      id,
      email,
      password_hash: "",
      full_name: displayName,
      email_verified: true,
      provider: "google",
    });
    const { data: created } = await supabase.from("users_auth").select("*").eq("id", id).maybeSingle();
    user = created;
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email, name: user.full_name, photoURL: profile?.photo_url || null };
}

export async function createSessionForUser(user) {
  return createToken({ sub: user.id, email: user.email, name: user.name });
}