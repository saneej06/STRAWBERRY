import bcrypt from "bcryptjs";
import { supabase, ensureSchema } from "../api/supabase.js";
import { createToken, extractToken, verifyToken } from "../api/jwt.js";

function readHeader(req, headerName) {
  const value = req.headers?.[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedOrigin(req) {
  const origin = readHeader(req, "origin");
  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function parseBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try { const p = JSON.parse(req.body); return p && typeof p === "object" && !Array.isArray(p) ? p : null; } catch { return null; }
  }
  return typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
}

function sanitize(v) {
  if (typeof v !== "string") return v;
  return v.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim().slice(0, 5000);
}

function getUserId(req) {
  const token = extractToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.sub || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") {
    if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden origin" });
    return handleLogin(req, res);
  }

  if (req.method === "GET") {
    return handleSession(req, res);
  }

  if (req.method === "PATCH") {
    return handleProfileUpdate(req, res);
  }

  if (req.method === "DELETE") {
    return handleLogout(req, res);
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleLogin(req, res) {
  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email is required" });
  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    await ensureSchema();
    const { data: user } = await supabase.from("users_auth").select("*").eq("email", email).maybeSingle();
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.email_verified) return res.status(403).json({ error: "Please verify your email before signing in." });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const token = createToken({ sub: user.id, email: user.email, name: user.full_name });

    return res.status(200).json({
      token,
      user: {
        id: user.id, email: user.email, name: user.full_name,
        photoURL: profile?.photo_url || null, displayName: profile?.name || user.full_name,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
}

async function handleSession(req, res) {
  try {
    await ensureSchema();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { data: user } = await supabase.from("users_auth").select("*").eq("id", userId).maybeSingle();
    if (!user) return res.status(401).json({ error: "User not found" });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    return res.status(200).json({
      user: {
        id: user.id, email: user.email, name: user.full_name,
        photoURL: profile?.photo_url || null, displayName: profile?.name || user.full_name,
      },
      profile,
    });
  } catch (error) {
    console.error("Session check failed:", error);
    return res.status(500).json({ error: "Session check failed" });
  }
}

async function handleProfileUpdate(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  try {
    await ensureSchema();
    const updates = {};
    if (body.name !== undefined) updates.name = sanitize(body.name);
    if (body.bio !== undefined) updates.bio = sanitize(body.bio);
    if (body.photo_url !== undefined) updates.photo_url = sanitize(body.photo_url);
    if (body.currency !== undefined) updates.currency = sanitize(body.currency);
    if (body.notifications !== undefined) updates.notifications = body.notifications;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
    }

    if (body.name !== undefined) {
      await supabase.from("users_auth").update({ full_name: updates.name || body.name }).eq("id", userId);
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return res.status(200).json({ profile });
  } catch (error) {
    console.error("Profile update failed:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}

async function handleLogout(req, res) {
  return res.status(200).json({ message: "Logged out" });
}