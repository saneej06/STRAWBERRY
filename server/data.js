import { supabase, ensureSchema } from "./supabase.js";
import { extractToken, verifyToken } from "./jwt.js";

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

function sanitizeValue(v) {
  if (typeof v === "string") return v.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim().slice(0, 5000);
  return v;
}

function getUserId(req) {
  const token = extractToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.sub || null;
}

// Allow-listed, writable columns per table (snake_case, as expected by the API).
// Anything not listed here is rejected — this prevents users overriding user_id
// or injecting arbitrary columns.
const ALLOWED_COLUMNS = {
  expenses: new Set([
    "amount", "category", "description", "date", "receipt_url", "split_with",
    "subject", "merchant", "currency", "reimbursable", "employee",
    "add_to_report", "tags", "is_recurring", "frequency", "end_date",
    "recurring_status", "recurring_notifications", "icon", "payment_method",
  ]),
  debtors: new Set([
    "debtor_name", "phone_number", "email", "amount", "paid_amount",
    "expense_id", "notes", "status", "date", "paid_at",
  ]),
  categories: new Set(["name"]),
  payments: new Set(["debtor_id", "debtor_name", "amount", "date", "method"]),
  feedback: new Set(["name", "email", "message", "type"]),
};

const ALLOWED_TABLES = new Set(Object.keys(ALLOWED_COLUMNS));

function buildWritableRecord(table, body) {
  const allowed = ALLOWED_COLUMNS[table];
  const record = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (value === undefined) continue;
    if (!allowed.has(key)) continue;
    record[key] = typeof value === "string" ? sanitizeValue(value) : value;
  }
  return record;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden origin" });

  const method = req.method;
  const table = req.query?.table;
  const id = req.query?.id;

  if (method === "GET") {
    return handleListData(req, res, userId);
  }

  if (method === "POST") {
    if (!table || !ALLOWED_TABLES.has(table)) return res.status(400).json({ error: "Invalid or missing table parameter" });
    const body = parseBody(req);
    if (!body) return res.status(400).json({ error: "Invalid JSON body" });
    return handleInsert(req, res, userId, table, body);
  }

  if (method === "PATCH") {
    if (!table || !ALLOWED_TABLES.has(table)) return res.status(400).json({ error: "Invalid or missing table parameter" });
    if (!id) return res.status(400).json({ error: "Missing id parameter" });
    const body = parseBody(req);
    if (!body) return res.status(400).json({ error: "Invalid JSON body" });
    return handleUpdate(req, res, userId, table, id, body);
  }

  if (method === "DELETE") {
    if (!table || !ALLOWED_TABLES.has(table)) return res.status(400).json({ error: "Invalid or missing table parameter" });
    if (!id) return res.status(400).json({ error: "Missing id parameter" });
    return handleDelete(req, res, userId, table, id);
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleListData(req, res, userId) {
  try {
    await ensureSchema();
    const requests = await Promise.all([
      supabase.from("expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("debtors").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userId).order("name", { ascending: true }),
      supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    for (const result of requests) {
      if (result.error) throw result.error;
    }

    const [expensesResult, debtorsResult, categoriesResult, paymentsResult] = requests;

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) {
      const { data: user } = await supabase.from("users_auth").select("full_name, email").eq("id", userId).maybeSingle();
      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            name: user.full_name,
            email: user.email,
            currency: "LKR",
            notifications: { email: true, push: false, inApp: true, earlyWarning: "3", paymentDay: "due" },
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
    }

    return res.status(200).json({
      expenses: expensesResult.data ?? [],
      debtors: debtorsResult.data ?? [],
      categories: categoriesResult.data ?? [],
      payments: paymentsResult.data ?? [],
    });
  } catch (error) {
    console.error("List data failed:", error);
    return res.status(500).json({ error: "Failed to load data" });
  }
}

async function handleInsert(req, res, userId, table, body) {
  try {
    await ensureSchema();
    const record = buildWritableRecord(table, body);
    if (Object.keys(record).length === 0) {
      return res.status(400).json({ error: "No valid fields to insert" });
    }
    record.user_id = userId;

    const { data, error } = await supabase.from(table).insert(record).select("*").single();
    if (error) throw error;
    return res.status(201).json({ data });
  } catch (error) {
    console.error(`Insert into ${table} failed:`, error);
    return res.status(500).json({ error: `Failed to create record in ${table}` });
  }
}

async function handleUpdate(req, res, userId, table, id, body) {
  try {
    await ensureSchema();
    const record = buildWritableRecord(table, body);
    if (Object.keys(record).length === 0) return res.status(400).json({ error: "No fields to update" });

    const { data, error } = await supabase
      .from(table)
      .update(record)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return res.status(200).json({ data });
  } catch (error) {
    console.error(`Update ${table} failed:`, error);
    return res.status(500).json({ error: `Failed to update record in ${table}` });
  }
}

async function handleDelete(req, res, userId, table, id) {
  try {
    await ensureSchema();
    const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    console.error(`Delete from ${table} failed:`, error);
    return res.status(500).json({ error: `Failed to delete record from ${table}` });
  }
}