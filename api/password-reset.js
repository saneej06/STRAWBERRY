import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { supabase, ensureSchema } from "../api/supabase.js";
import { sendEmail } from "../api/email.js";

function readHeader(req, headerName) {
  const value = req.headers?.[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");
  const proto = readHeader(req, "x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
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

function normalizeEmail(v) { return typeof v === "string" ? v.trim().toLowerCase() : ""; }
function escapeHtml(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

function signResetToken(payload) {
  const secret = process.env.JWT_SECRET || process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) throw new Error("JWT_SECRET or EMAIL_VERIFICATION_SECRET must be set");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyResetToken(token) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig) return null;
  const secret = process.env.JWT_SECRET || process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) return null;
  const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch { return null; }
}

async function sendPasswordResetEmail({ email, resetUrl }) {
  return sendEmail({
    to: email,
    type: "reset",
    subject: "Reset your STRAWBERRY password",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px">Reset your STRAWBERRY password</h1>
        <p>We received a request to reset your STRAWBERRY password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      </div>`,
    text: `Reset your STRAWBERRY password:\n${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") {
    if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden origin" });
    return handleRequestReset(req, res);
  }

  if (req.method === "PATCH") {
    if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden origin" });
    return handleConfirmReset(req, res);
  }

  res.setHeader("Allow", "POST, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleRequestReset(req, res) {
  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email is required" });

  try {
    await ensureSchema();
    const { data: user } = await supabase.from("users_auth").select("id, email").eq("email", email).maybeSingle();
    if (!user) {
      return res.status(200).json({ message: "If an account exists for this email, a reset link has been sent." });
    }

    const token = signResetToken({ sub: user.id, email: user.email, exp: Date.now() + 60 * 60 * 1000 });
    const resetUrl = `${getAppUrl(req)}/login?reset=${encodeURIComponent(token)}`;

    const emailResult = await sendPasswordResetEmail({ email: user.email, resetUrl });

    return res.status(200).json({
      message: emailResult.ok
        ? "Check your inbox for a password reset link."
        : "The reset email could not be sent." + (emailResult.message ? ` (${emailResult.message})` : "") + " Please try again later.",
      emailSent: emailResult.ok,
      devResetUrl: !isProduction() ? resetUrl : undefined,
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return res.status(500).json({ error: "Could not process password reset request" });
  }
}

async function handleConfirmReset(req, res) {
  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) return res.status(400).json({ error: "Missing reset token" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const payload = verifyResetToken(token);
  if (!payload?.sub) return res.status(400).json({ error: "Invalid or expired reset token" });

  try {
    await ensureSchema();
    const { data: user } = await supabase.from("users_auth").select("id").eq("id", payload.sub).maybeSingle();
    if (!user) return res.status(404).json({ error: "Account not found" });

    const passwordHash = await bcrypt.hash(password, 12);
    await supabase.from("users_auth").update({ password_hash: passwordHash }).eq("id", user.id);

    return res.status(200).json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("Password reset confirmation failed:", error);
    return res.status(500).json({ error: "Could not reset password" });
  }
}