import { extractToken, verifyToken } from "./jwt.js";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_CONTEXT_BYTES = 4 * 1024;
const MAX_CATEGORY_COUNT = 20;
const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_FINANCIAL_VALUE = 1_000_000_000;
const MAX_COUNT_VALUE = 100_000;
const OPENROUTER_TIMEOUT_MS = 15_000;
const IP_RATE_LIMIT_MAX = 20;
const USER_RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_STORE = globalThis.__spendoraRateLimitStore || new Map();

if (!globalThis.__spendoraRateLimitStore) {
  globalThis.__spendoraRateLimitStore = RATE_LIMIT_STORE;
}

const ALLOWED_CURRENCIES = new Set(["LKR", "USD", "EUR", "GBP"]);

function readHeader(req, headerName) {
  const value = req.headers?.[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function getContentLength(req) {
  const rawLength = readHeader(req, "content-length");
  const parsedLength = Number.parseInt(rawLength || "", 10);
  return Number.isFinite(parsedLength) ? parsedLength : 0;
}

function getClientIp(req) {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function pruneRateLimitStore(now) {
  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (bucket.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

function takeRateLimitSlot(key, limit) {
  const now = Date.now();
  pruneRateLimitStore(now);

  const existingBucket = RATE_LIMIT_STORE.get(key);
  if (!existingBucket || existingBucket.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existingBucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existingBucket.resetAt - now) / 1000)),
    };
  }

  existingBucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function clampNumber(value, { min = 0, max = MAX_FINANCIAL_VALUE, integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  const normalized = Math.min(max, Math.max(min, parsed));
  return integer ? Math.trunc(normalized) : normalized;
}

function sanitizeLabel(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
  return normalized || null;
}

function sanitizeCategoryTotals(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const safeEntries = Object.entries(input)
    .map(([key, value]) => [sanitizeLabel(key), clampNumber(value)])
    .filter(([key]) => Boolean(key))
    .slice(0, MAX_CATEGORY_COUNT);

  return Object.fromEntries(safeEntries);
}

function sanitizeCurrency(value) {
  if (typeof value !== "string") {
    return "LKR";
  }

  const normalized = value.trim().toUpperCase();
  return ALLOWED_CURRENCIES.has(normalized) ? normalized : "LKR";
}

function formatCurrencyValue(amount, currency) {
  if (currency === "LKR") {
    return `Rs. ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  try {
    return Number(amount || 0).toLocaleString(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function buildFormattedSummary(context) {
  const categoryLines = Object.entries(context.expenseSummary.categoryTotals)
    .map(([category, total]) => `${category}: ${formatCurrencyValue(total, context.preferredCurrency)}`);

  return [
    `Preferred currency: ${context.preferredCurrency}`,
    `Total expenses: ${formatCurrencyValue(context.expenseSummary.totalExpense, context.preferredCurrency)}`,
    `Expense count: ${context.expenseSummary.expenseCount}`,
    ...(categoryLines.length > 0 ? ["Expense categories:", ...categoryLines] : []),
    `Total debt: ${formatCurrencyValue(context.debtorSummary.totalDebt, context.preferredCurrency)}`,
    `Total collected: ${formatCurrencyValue(context.debtorSummary.totalCollected, context.preferredCurrency)}`,
    `Remaining balance: ${formatCurrencyValue(context.debtorSummary.remainingBalance, context.preferredCurrency)}`,
    `Pending debtors: ${context.debtorSummary.pendingCount}`,
  ].join("\n");
}

function sanitizeContext(input) {
  const context = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const expenseSummary =
    context.expenseSummary && typeof context.expenseSummary === "object" && !Array.isArray(context.expenseSummary)
      ? context.expenseSummary
      : {};
  const debtorSummary =
    context.debtorSummary && typeof context.debtorSummary === "object" && !Array.isArray(context.debtorSummary)
      ? context.debtorSummary
      : {};

  const safeContext = {
    preferredCurrency: sanitizeCurrency(context.preferredCurrency),
    expenseSummary: {
      totalExpense: clampNumber(expenseSummary.totalExpense),
      expenseCount: clampNumber(expenseSummary.expenseCount, {
        max: MAX_COUNT_VALUE,
        integer: true,
      }),
      categoryTotals: sanitizeCategoryTotals(expenseSummary.categoryTotals),
    },
    debtorSummary: {
      debtorCount: clampNumber(debtorSummary.debtorCount, {
        max: MAX_COUNT_VALUE,
        integer: true,
      }),
      totalDebt: clampNumber(debtorSummary.totalDebt),
      totalCollected: clampNumber(debtorSummary.totalCollected),
      pendingCount: clampNumber(debtorSummary.pendingCount, {
        max: MAX_COUNT_VALUE,
        integer: true,
      }),
      remainingBalance: clampNumber(debtorSummary.remainingBalance),
    },
  };

  while (
    Buffer.byteLength(JSON.stringify(safeContext), "utf8") > MAX_CONTEXT_BYTES &&
    Object.keys(safeContext.expenseSummary.categoryTotals).length > 0
  ) {
    const [lastKey] = Object.keys(safeContext.expenseSummary.categoryTotals).slice(-1);
    delete safeContext.expenseSummary.categoryTotals[lastKey];
  }

  return safeContext;
}

function parseRequestBody(req) {
  if (req.body == null) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body;
  }

  return null;
}

function getBodySize(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), "utf8");
  } catch {
    return MAX_BODY_BYTES + 1;
  }
}

function getAuthToken(req) {
  const authHeader = readHeader(req, "authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function getAppUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");
  const protocol = readHeader(req, "x-forwarded-proto") || "https";

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

function isAllowedOrigin(req) {
  const origin = readHeader(req, "origin");
  const host = readHeader(req, "x-forwarded-host") || readHeader(req, "host");

  if (!origin || !host) return true;

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

function parseMessage(value) {
  if (typeof value !== "string") {
    return { error: "Invalid message" };
  }

  const normalized = value.replace(/\0/g, "").trim();
  if (!normalized) {
    return { error: "Invalid message" };
  }

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    return { error: "Message is too long" };
  }

  return { value: normalized };
}

async function parseUpstreamError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function verifyAuthToken(accessToken) {
  const payload = verifyToken(accessToken);
  if (!payload?.sub) return null;
  return { id: payload.sub, email: payload.email };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  if (getContentLength(req) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Request body is too large" });
  }

  const ipRateLimit = takeRateLimitSlot(`ip:${getClientIp(req)}`, IP_RATE_LIMIT_MAX);
  if (!ipRateLimit.allowed) {
    res.setHeader("Retry-After", String(ipRateLimit.retryAfterSeconds));
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = parseRequestBody(req);
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (getBodySize(body) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Request body is too large" });
  }

  const authToken = getAuthToken(req);
  if (!authToken) {
    return res.status(401).json({ error: "Missing authentication token" });
  }

  const verifiedUser = verifyAuthToken(authToken);
  if (!verifiedUser?.id) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  const userRateLimit = takeRateLimitSlot(`user:${verifiedUser.id}`, USER_RATE_LIMIT_MAX);
  if (!userRateLimit.allowed) {
    res.setHeader("Retry-After", String(userRateLimit.retryAfterSeconds));
    return res.status(429).json({ error: "Too many requests" });
  }

  const parsedMessage = parseMessage(body.message);
  if (parsedMessage.error) {
    return res.status(400).json({ error: parsedMessage.error });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server AI key is not configured" });
  }

  const safeContext = sanitizeContext(body.context);
  const formattedSummary = buildFormattedSummary(safeContext);
  const prompt = `You are STRAWBERRY's financial assistant.
Use only the structured summary below and do not request personally identifying information.
Keep responses concise, practical, and privacy-aware.
Use plain text only. Do not use markdown syntax such as **, __, #, bullet markers, or numbered list markers.
When referring to money, always format every amount in the user's preferred currency: ${safeContext.preferredCurrency}.
Do not return raw bare numbers for money.

Structured Summary:
${JSON.stringify(safeContext, null, 2)}

Formatted Monetary Summary:
${formattedSummary}

User Question:
${parsedMessage.value}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": getAppUrl(req),
        "X-Title": "STRAWBERRY",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await parseUpstreamError(response);
      console.error("OpenRouter error:", {
        status: response.status,
        error: errorData,
        userId: verifiedUser.id,
      });
      return res.status(502).json({ error: "AI provider request failed" });
    }

    const data = await response.json();
    const aiResponse =
      typeof data.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content.slice(0, 4000)
        : "I could not generate a response.";

    return res.status(200).json({ text: aiResponse });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "AI request timed out" });
    }

    console.error("AI API error:", error);
    return res.status(500).json({ error: "Failed to process AI request" });
  } finally {
    clearTimeout(timeoutId);
  }
}
