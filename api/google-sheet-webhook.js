const { createClient } = require('@supabase/supabase-js');

const DEFAULT_VK_API_VERSION = '5.199';
const MAX_VK_MESSAGE = 3900;

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let supabaseClient;
function getSupabaseOptional() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  if (!supabaseClient) supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function escapeLine(value) {
  return cleanText(value).replace(/\s+/g, ' ').slice(0, 900);
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function getWebhookSecret(req, payload) {
  const querySecret = req.query && (req.query.secret || req.query.key || req.query.token);
  return cleanText(
    normalizeHeaderValue(req.headers['x-webhook-secret']) ||
    normalizeHeaderValue(req.headers['x-google-sheet-secret']) ||
    querySecret ||
    payload.secret ||
    payload.token
  );
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function resolveStaffPeerId() {
  const explicit = env('STAFF_PEER_ID') || env('NOTIFY_PEER_ID');
  if (explicit) return explicit;

  const supabase = getSupabaseOptional();
  if (!supabase) return env('REPORTS_PEER_ID');

  try {
    const { data, error } = await supabase
      .from('vk_group_bindings')
      .select('peer_id,updated_at')
      .eq('group_type', 'staff')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.peer_id) return String(data.peer_id);
  } catch (error) {
    console.warn('resolveStaffPeerId failed:', error.message || error);
  }

  return env('REPORTS_PEER_ID');
}

async function vkApi(method, params) {
  const token = requireEnv('VK_GROUP_TOKEN');
  const version = env('VK_API_VERSION', DEFAULT_VK_API_VERSION);
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')),
    access_token: token,
    v: version,
  });

  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`VK API HTTP ${response.status}`);
  if (data && data.error) {
    const code = data.error.error_code || 'unknown';
    const message = data.error.error_msg || 'Unknown VK API error';
    throw new Error(`VK API error ${code}: ${message}`);
  }
  return data ? data.response : null;
}

async function sendMessage(peerId, text) {
  const message = cleanText(text).slice(0, MAX_VK_MESSAGE);
  if (!message) return null;
  return await vkApi('messages.send', {
    peer_id: String(peerId),
    random_id: String(Math.floor(Math.random() * 2147483647)),
    disable_mentions: '1',
    message,
  });
}

function normalizeNamedValues(payload) {
  if (payload.namedValues && typeof payload.namedValues === 'object') return payload.namedValues;

  const headers = Array.isArray(payload.headers) ? payload.headers : [];
  const values = Array.isArray(payload.values) ? payload.values : [];
  const result = {};
  headers.forEach((header, index) => {
    const key = cleanText(header || `Поле ${index + 1}`);
    if (key) result[key] = values[index] == null ? '' : values[index];
  });
  return result;
}

function importantKeyScore(key) {
  const k = key.toLowerCase();
  if (/время|timestamp|дата/.test(k)) return 1;
  if (/ник|name|имя/.test(k)) return 2;
  if (/vk|вк|страниц/.test(k)) return 3;
  if (/форум|forum|fa/.test(k)) return 4;
  if (/discord|дискорд|ds/.test(k)) return 5;
  if (/возраст|age/.test(k)) return 6;
  if (/пост|должн|организац|сервер|server/.test(k)) return 7;
  if (/опыт|почему|причин|about|коммент|ответ/.test(k)) return 8;
  return 20;
}

function formatGoogleSheetApplication(payload) {
  const sheetName = cleanText(payload.sheetName || payload.sheet || '—');
  const rowNumber = cleanText(payload.rowNumber || payload.row || '—');
  const spreadsheetUrl = cleanText(payload.spreadsheetUrl || payload.url || '');
  const named = normalizeNamedValues(payload);

  const entries = Object.entries(named)
    .map(([k, v]) => [cleanText(k), Array.isArray(v) ? v.join(', ') : cleanText(v)])
    .filter(([k, v]) => k && v)
    .sort((a, b) => importantKeyScore(a[0]) - importantKeyScore(b[0]));

  const lines = [
    '📨 НОВАЯ ЗАЯВКА ИЗ GOOGLE FORMS',
    '━━━━━━━━━━━━━━━━',
    `📄 Лист: ${escapeLine(sheetName)}`,
    `#️⃣ Строка: ${escapeLine(rowNumber)}`,
  ];

  for (const [key, value] of entries.slice(0, 24)) {
    lines.push(`• ${escapeLine(key)}: ${escapeLine(value)}`);
  }

  if (spreadsheetUrl) lines.push(`🔗 Таблица: ${escapeLine(spreadsheetUrl)}`);
  return lines.join('\n');
}

async function saveEvent(payload, status, errorMessage = '') {
  const supabase = getSupabaseOptional();
  if (!supabase) return;
  try {
    await supabase.from('vk_google_sheet_events').insert([{
      sheet_name: cleanText(payload.sheetName || payload.sheet || ''),
      row_number: payload.rowNumber ? Number(payload.rowNumber) : null,
      payload,
      status,
      error_message: cleanText(errorMessage),
    }]);
  } catch (error) {
    console.warn('save google sheet event failed:', error.message || error);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const staffPeerId = await resolveStaffPeerId();
    res.status(200).json({ ok: true, service: 'ch89-google-sheet-webhook-v5', staffPeerId: staffPeerId || null });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    res.status(405).send('method not allowed');
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    res.status(400).send('bad request');
    return;
  }

  const expectedSecret = env('GOOGLE_SHEET_WEBHOOK_SECRET') || env('TABLE_WEBHOOK_SECRET');
  if (expectedSecret && getWebhookSecret(req, payload) !== expectedSecret) {
    res.status(403).send('bad secret');
    return;
  }

  const targetSheet = env('GOOGLE_SHEET_TARGET_NAME', 'Ответы на формы (3)');
  const sheetName = cleanText(payload.sheetName || payload.sheet || '');
  if (targetSheet && sheetName && sheetName !== targetSheet) {
    await saveEvent(payload, 'skipped_wrong_sheet');
    res.status(200).json({ ok: true, skipped: 'wrong sheet', sheetName });
    return;
  }

  const peerId = await resolveStaffPeerId();
  if (!peerId) {
    await saveEvent(payload, 'skipped_no_staff');
    res.status(200).json({ ok: false, skipped: 'missing staff group. Use /group type staff in VK or set STAFF_PEER_ID.' });
    return;
  }

  try {
    const text = formatGoogleSheetApplication(payload);
    await sendMessage(peerId, text);
    await saveEvent(payload, 'sent');
    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    await saveEvent(payload, 'error', error.message || String(error));
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
};
