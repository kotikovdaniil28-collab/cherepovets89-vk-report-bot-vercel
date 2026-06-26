const { createClient } = require('@supabase/supabase-js');

const DEFAULT_VK_API_VERSION = '5.199';
const MAX_VK_MESSAGE = 3900;

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

let supabaseClient;

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseOptional() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseClient;
}

async function resolveStaffPeerId() {
  const explicit = env('STAFF_PEER_ID') || env('NOTIFY_PEER_ID');
  if (explicit) return explicit;

  const supabase = getSupabaseOptional();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vk_group_bindings')
        .select('peer_id,updated_at')
        .eq('group_type', 'staff')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.peer_id) return String(data.peer_id);
      if (error) console.warn('resolveStaffPeerId failed:', error.message || error);
    } catch (error) {
      console.warn('resolveStaffPeerId exception:', error.message || error);
    }
  }

  return env('REPORTS_PEER_ID');
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
    normalizeHeaderValue(req.headers['x-supabase-webhook-secret']) ||
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

function parseJsonMaybe(value) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
    const jsonPart = text.match(/JSON:\s*(\{[\s\S]+\})\s*$/i);
    if (jsonPart) return JSON.parse(jsonPart[1]);
  } catch (_) {}
  return null;
}

function isApplicationRecord(record, table) {
  if (!record) return false;

  const tableAllow = env('APPLICATION_TABLES', 'reports,admin_logs')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  if (table && tableAllow.length && !tableAllow.includes(table)) return false;

  if (table === 'admin_logs') return true;

  const emails = env('APPLICATION_REPORT_EMAILS', 'GOSS_PROFILE,MOD_APPLICATION,APPLICATION,INACTIVE_REQ')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (!emails.length) return true;
  return emails.includes(String(record.email || ''));
}

function rowPayload(record) {
  const p = parseJsonMaybe(record.date) || parseJsonMaybe(record.shop_items) || {};
  const combined = String(record.date || '');
  const nickMatch = combined.match(/Ник:\s*([^|]+)/i);
  const workMatch = combined.match(/Работа:\s*([^|]+)/i);

  return {
    id: record.id || '',
    email: record.email || '',
    type: record.type || record.email || '',
    status: record.status || '',
    nick: p.nick || p.nickname || p.user || p.name || record.nickname || nickMatch?.[1] || '',
    vk: p.vk || p.vkUrl || p.vk_link || p.vkid || p.vkId || p.vk_id || '',
    forum: p.forum || p.fa || p.forumUrl || p.forum_link || p.forumLink || '',
    discord: p.discord || p.ds || '',
    org: p.org || p.organization || p.post || p.department || '',
    age: p.age || '',
    timezone: p.timezone || '',
    comment: p.comment || p.text || p.reason || p.work || workMatch?.[1] || '',
    link: record.link || '',
    item: record.item_name || p.item || p.title || '',
    cost: record.cost || record.xp || p.cost || p.price || '',
    raw: p,
  };
}

function formatNotification(record, table) {
  const p = rowPayload(record);

  if (table === 'admin_logs') {
    return [
      '🛒 НОВАЯ ЗАЯВКА / ПОКУПКА',
      '━━━━━━━━━━━━━━━━',
      '',
      `👤 Пользователь: ${escapeLine(p.nick || record.user_email || '—')}`,
      `📧 Email: ${escapeLine(record.user_email || '—')}`,
      `🎁 Товар: ${escapeLine(p.item || '—')}`,
      `💰 Стоимость: ${escapeLine(p.cost || '—')}`,
      `📌 Статус: ${escapeLine(p.status || '—')}`,
      `#️⃣ ID: ${escapeLine(p.id || '—')}`,
    ].join('\n');
  }

  const lines = [
    '📨 НОВАЯ ЗАЯВКА',
    '━━━━━━━━━━━━━━━━',
    '',
    `#️⃣ ID: ${escapeLine(p.id || '—')}`,
    `🏷 Тип: ${escapeLine(p.type || '—')}`,
  ];

  if (p.nick) lines.push(`👤 Ник: ${escapeLine(p.nick)}`);
  if (p.org) lines.push(`🏛 Организация/пост: ${escapeLine(p.org)}`);
  if (p.age) lines.push(`🎂 Возраст: ${escapeLine(p.age)}`);
  if (p.vk) lines.push(`🔗 VK: ${escapeLine(p.vk)}`);
  if (p.forum) lines.push(`📝 Форум: ${escapeLine(p.forum)}`);
  if (p.discord) lines.push(`💬 Discord: ${escapeLine(p.discord)}`);
  if (p.timezone) lines.push(`🕘 Часовой пояс: ${escapeLine(p.timezone)}`);
  if (p.link) lines.push(`📎 Ссылка: ${escapeLine(p.link)}`);
  if (p.status) lines.push(`📌 Статус: ${escapeLine(p.status)}`);
  if (p.comment) lines.push(`💭 Комментарий: ${escapeLine(p.comment)}`);

  return lines.join('\n');
}

function extractRecords(payload) {
  if (Array.isArray(payload)) return payload.map(x => ({ table: x.table || x.table_name || '', record: x.record || x.new || x }));
  if (Array.isArray(payload.records)) return payload.records.map(x => ({ table: payload.table || payload.table_name || x.table || '', record: x.record || x.new || x }));

  return [{
    table: payload.table || payload.table_name || '',
    record: payload.record || payload.new || payload.data || payload,
  }];
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const staffPeerId = await resolveStaffPeerId();
    res.status(200).json({ ok: true, service: 'ch89-table-webhook-v3', staffPeerId: staffPeerId || null });
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
    console.error('Invalid webhook JSON body:', error);
    res.status(400).send('bad request');
    return;
  }

  const expectedSecret = env('TABLE_WEBHOOK_SECRET');
  if (expectedSecret) {
    const got = getWebhookSecret(req, payload);
    if (got !== expectedSecret) {
      res.status(403).send('bad secret');
      return;
    }
  }

  const peerId = await resolveStaffPeerId();
  if (!peerId) {
    res.status(200).json({ ok: false, skipped: 'missing staff group. Use /group type staff in VK or set STAFF_PEER_ID.' });
    return;
  }

  try {
    const pairs = extractRecords(payload);
    let sent = 0;

    for (const { table, record } of pairs) {
      if (!record || !isApplicationRecord(record, table)) continue;
      const text = formatNotification(record, table || 'reports');
      await sendMessage(peerId, text);
      sent += 1;
    }

    res.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error('Table webhook error:', error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
};
