import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { supabase, ensureSchema } from "./supabase.js";
import { createToken } from "./jwt.js";
import { sendEmail } from "./email.js";

const MAX_BODY_BYTES = 8 * 1024;
const MIN_PASSWORD_LENGTH = 6;

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

function signVerificationToken(payload) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("EMAIL_VERIFICATION_SECRET must be set");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyEmailToken(token) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig) return null;
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET;
  if (!secret) return null;
  const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.email || !payload?.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch { return null; }
}

async function sendVerificationEmail({ email, name, verificationUrl }) {
  return sendEmail({
    to: email,
    type: "verify",
    subject: "Verify your STRAWBERRY account",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px">Verify your STRAWBERRY account</h1>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Confirm your email address to finish setting up your STRAWBERRY account.</p>
        <p><a href="${verificationUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Verify email</a></p>
        <p>This link expires in 24 hours.</p>
      </div>`,
    text: `Hi ${name},\n\nConfirm your STRAWBERRY account by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return handleVerifyEmail(req, res);
  if (req.method !== "POST") { res.setHeader("Allow", "POST, GET"); return res.status(405).json({ error: "Method not allowed" }); }
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden origin" });
  const contentLength = Number.parseInt(readHeader(req, "content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: "Request body is too large" });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return res.status(400).json({ error: "Full name is required" });
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email is required" });
  if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });

  try {
    await ensureSchema();
    const { data: existing } = await supabase.from("users_auth").select("id").eq("email", email).maybeSingle();
    if (existing) return res.status(400).json({ error: "An account already exists for this email" });

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      name,
      email,
      currency: "LKR",
      notifications: { email: true, push: false, inApp: true, earlyWarning: "3", paymentDay: "due" },
    });
    if (profileError) throw profileError;

    const { error: authError } = await supabase.from("users_auth").insert({
      id: userId,
      email,
      password_hash: passwordHash,
      full_name: name,
      email_verified: true,
      provider: "email",
    });
    if (authError) throw authError;

    const token = createToken({ sub: userId, email, name });

    const verificationToken = signVerificationToken({ sub: userId, email, exp: Date.now() + 24 * 60 * 60 * 1000 });
    const verificationUrl = `${getAppUrl(req)}/api/auth?verify-email=${encodeURIComponent(verificationToken)}`;

    let emailResult = { ok: false, reason: "skipped" };
    if (process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL) {
      emailResult = await sendVerificationEmail({ email, name, verificationUrl });
    } else {
      console.warn(`[email][verify] not sent to <${email}>: BREVO_API_KEY or BREVO_FROM_EMAIL is not set`);
    }

    const message = emailResult.ok
      ? "Account created. Check your inbox to verify your email before signing in."
      : "Account created, but the verification email could not be sent." + (emailResult.message ? ` (${emailResult.message})` : "") + " You can still sign in with your password.";

    return res.status(201).json({
      message,
      emailSent: emailResult.ok,
      token,
      user: { id: userId, email, name },
      verificationUrl: !isProduction() ? verificationUrl : undefined,
    });
  } catch (error) {
    console.error("Signup failed:", error);
    return res.status(500).json({ error: "Could not create account. Please try again." });
  }
}

async function handleVerifyEmail(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const token = req.query?.token || req.query?.["verify-email"];
  if (!token) return res.status(400).send(htmlPage("Invalid link", "No verification token provided.", "error"));

  const payload = verifyEmailToken(token);
  if (!payload) return res.status(400).send(htmlPage("Invalid link", "This verification link is invalid or has expired.", "error"));

  try {
    await ensureSchema();
    await supabase.from("users_auth").update({ email_verified: true }).eq("id", payload.sub);
    return res.status(200).send(htmlPage("Email verified", "Your email has been verified. You can sign in to STRAWBERRY now."));
  } catch (error) {
    console.error("Email verification failed:", error);
    return res.status(500).send(htmlPage("Verification unavailable", "We could not verify your email right now.", "error"));
  }
}

function htmlPage(title, message, status = "success") {
  const color = status === "success" ? "#16a34a" : "#dc2626";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#111827"><main style="min-height:100vh;display:grid;place-items:center;padding:24px">
  <section style="max-width:460px;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;box-shadow:0 18px 45px rgba(15,23,42,.08)">
  <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.14em;color:${color};text-transform:uppercase">STRAWBERRY</p>
  <h1 style="margin:0 0 12px;font-size:26px">${title}</h1>
  <p style="margin:0 0 22px;line-height:1.6;color:#4b5563">${message}</p>
  <a href="/login" style="display:inline-block;background:#111827;color:white;text-decoration:none;border-radius:12px;padding:12px 16px;font-weight:800">Go to sign in</a>
  </section></main></body></html>`;
}