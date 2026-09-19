import crypto from "node:crypto";

function base64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString("base64url");
}

function base64urlDecode(str) {
  return Buffer.from(str, "base64url");
}

export function createToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const secret = getJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: Math.floor((Date.now() + expiresInMs) / 1000) };
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(tokenPayload))];
  const signature = crypto.createHmac("sha256", secret).update(segments.join(".")).digest();
  segments.push(base64url(signature));
  return segments.join(".");
}

export function verifyToken(token, { requireIdentity = true } = {}) {
  try {
    const secret = getJwtSecret();
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const expectedSig = crypto.createHmac("sha256", secret).update(parts.slice(0, 2).join(".")).digest();
    const actualSig = base64urlDecode(parts[2]);
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) return null;
    const payload = JSON.parse(base64urlDecode(parts[1]).toString("utf8"));
    if (!payload) return null;
    if (requireIdentity && (!payload.sub || !payload.email)) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractToken(req) {
  const auth = req.headers?.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) throw new Error("JWT_SECRET or EMAIL_VERIFICATION_SECRET must be set");
  return secret;
}
