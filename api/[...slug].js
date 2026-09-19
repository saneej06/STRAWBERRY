import aiAssistantHandler from "../server/ai-assistant.js";
import authHandler from "../server/auth.js";
import authGoogleHandler from "../server/auth-google.js";
import authGoogleCallbackHandler from "../server/auth-google-callback.js";
import authGoogleConfigHandler from "../server/auth-google-config.js";
import dataHandler from "../server/data.js";
import passwordResetHandler from "../server/password-reset.js";
import userHandler from "../server/user.js";

const ROUTES = {
  "/api/ai-assistant": aiAssistantHandler,
  "/api/auth": authHandler,
  "/api/auth-google": authGoogleHandler,
  "/api/auth-google/callback": authGoogleCallbackHandler,
  "/api/auth-google-config": authGoogleConfigHandler,
  "/api/data": dataHandler,
  "/api/password-reset": passwordResetHandler,
  "/api/user": userHandler,
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const rawPath = String(req.url || "").split("?")[0].split("#")[0] || "/";
  const pathname = rawPath.replace(/\/+$/, "") || "/";

  const route = ROUTES[pathname];
  if (!route) {
    return res.status(404).json({ error: "Not found" });
  }

  return route(req, res);
}