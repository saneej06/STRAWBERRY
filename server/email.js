// Shared server-side email helper. Emails are ONLY sent from here, through the
// Brevo (formerly Sendinblue) transactional email API. The API key is read from
// the server environment and is never exposed to the client, logged, or
// returned in any API response.
//
// Logging rules:
//   - Log: email type, recipient, Brevo status/messageId, non-secret errors.
//   - NEVER log: BREVO_API_KEY, passwords, JWT secrets, verification secrets,
//     or verification/reset tokens.

const BREVO_API_ROOT = "https://api.brevo.com";
const BREVO_SENDER_NAME = "STRAWBERRY";

// Accepts either "Name <email@domain.com>" or a bare "email@domain.com".
function parseSender(raw) {
  const value = String(raw || "").trim();
  const open = value.indexOf("<");
  const close = value.indexOf(">");
  if (open !== -1 && close > open) {
    return {
      name: value.slice(0, open).replace(/"/g, "").trim() || BREVO_SENDER_NAME,
      email: value.slice(open + 1, close).trim(),
    };
  }
  return { name: BREVO_SENDER_NAME, email: value };
}

export async function sendEmail({ to, type, subject, html, text, from }) {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = parseSender(from || process.env.BREVO_FROM_EMAIL);

  if (!apiKey) {
    console.warn(`[email][${type}] not sent to <${to}>: BREVO_API_KEY is not set`);
    return { ok: false, reason: "missing_api_key" };
  }
  if (!sender.email || !sender.email.includes("@")) {
    console.warn(`[email][${type}] not sent to <${to}>: BREVO_FROM_EMAIL is not set (must be a sender verified in Brevo)`);
    return { ok: false, reason: "missing_from_email" };
  }

  try {
    const response = await fetch(`${BREVO_API_ROOT}/v3/smtp/email`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = body?.message || body?.code || response.statusText || "unknown Brevo error";
      console.error(
        `[email][${type}] FAILED to <${to}> (from ${sender.email}) status=${response.status} code=${body?.code || "n/a"} error=${detail}`
      );
      return { ok: false, status: response.status, reason: body?.code ? String(body.code) : detail, message: detail };
    }

    console.log(`[email][${type}] sent to <${to}> status=${response.status} messageId=${body?.messageId || "n/a"}`);
    return { ok: true, status: response.status, id: body?.messageId || null };
  } catch (error) {
    console.error(`[email][${type}] exception sending to <${to}>:`, error?.message || String(error));
    return { ok: false, reason: "exception", message: error?.message || String(error) };
  }
}