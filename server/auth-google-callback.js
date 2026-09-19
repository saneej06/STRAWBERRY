import { ensureSchema } from "./db.js";
import {
  getAppUrl,
  getRedirectUri,
  googleConfigured,
  parseIdToken,
  upsertGoogleUser,
  createSessionForUser,
  verifyStateToken,
} from "./google-oauth.js";

function redirectToLogin(res, hashFragment) {
  const target = `/login${hashFragment}`;
  res.setHeader("Location", target);
  return res.status(302).end();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const query = new URL((req.url || "/api/auth-google/callback"), getAppUrl(req)).searchParams;
  const code = query.get("code");
  const state = query.get("state");
  const error = query.get("error");

  if (error) {
    return redirectToLogin(res, `#error=${encodeURIComponent("Google sign-in was cancelled or failed.")}`);
  }
  if (!code || !state) {
    return redirectToLogin(res, `#error=${encodeURIComponent("Invalid Google sign-in response.")}`);
  }
  if (!verifyStateToken(state)) {
    return redirectToLogin(res, `#error=${encodeURIComponent("Google sign-in session is invalid or expired. Please try again.")}`);
  }
  if (!googleConfigured()) {
    return redirectToLogin(res, `#error=${encodeURIComponent("Google Login is not configured.")}`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Google token exchange failed:", tokenResponse.status);
      return redirectToLogin(res, `#error=${encodeURIComponent("Could not complete Google sign-in.")}`);
    }

    const tokenData = await tokenResponse.json();
    let googleUser = parseIdToken(tokenData.id_token, process.env.GOOGLE_CLIENT_ID);

    if (!googleUser) {
      const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userinfoResponse.ok) {
        return redirectToLogin(res, `#error=${encodeURIComponent("Could not fetch Google profile.")}`);
      }
      const profile = await userinfoResponse.json();
      if (!profile.sub || !profile.email) {
        return redirectToLogin(res, `#error=${encodeURIComponent("Google profile is missing email.")}`);
      }
      googleUser = { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture };
    }

    await ensureSchema();
    const user = await upsertGoogleUser(googleUser);
    const sessionToken = await createSessionForUser(user);

    return redirectToLogin(res, `#token=${sessionToken}`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return redirectToLogin(res, `#error=${encodeURIComponent("Google sign-in failed unexpectedly.")}`);
  }
}