const { createClient } = require('@supabase/supabase-js');

const SESSION_TTL_MS = 30 * 60 * 1000;
const REPORT_QUALITY = ['Норма', 'Перенорма', 'Натяг', 'Герой дня'];
const DEFAULT_VK_API_VERSION = '5.199';

let supabaseClient;

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

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );
  }
  return supabaseClient;
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function nowId(prefix = 'rep_vk') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeDate(input) {
  const raw = cleanText(input);
  let y, m, d;

  let match = raw.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (match) {
    y = match[1];
    m = match[2];
    d = match[3];
  } else {
    match = raw.match(/^(\d{2})\.(\d{2})\.(20\d{2})$/);
    if (match) {
      d = match[1];
      m = match[2];
      y = match[3];
    }
  }

  if (!y || !m || !d) return '';

  const iso = `${y}-${m}-${d}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  if (parsed.toISOString().slice(0, 10) !== iso) return '';

  return iso;
}

function normalizeQuality(input) {
  const raw = cleanText(input).toLowerCase().replace(/ё/g, 'е');
  if (!raw) return '';

  const aliases = new Map([
    ['норма', 'Норма'],
    ['норматив', 'Норма'],
    ['перенорма', 'Перенорма'],
    ['пере', 'Перенорма'],
    ['натяг', 'Натяг'],
    ['герой', 'Герой дня'],
    ['герой дня', 'Герой дня'],
  ]);

  return aliases.get(raw) || REPORT_QUALITY.find(x => x.toLowerCase().replace(/ё/g, 'е') === raw) || '';
}

function extractUrls(text) {
  return cleanText(text).match(/https?:\/\/[^\s<>"']+/gi) || [];
}

function sessionKey(peerId, vkUserId) {
  return `${String(peerId)}:${String(vkUserId)}`;
}

function botAdminIds() {
  return new Set(
    env('BOT_ADMIN_VK_IDS')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
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

function validateCallbackSecret(payload) {
  const expected = env('VK_CALLBACK_SECRET');
  if (!expected) return true;
  return cleanText(payload.secret) === expected;
}

function getMessage(payload) {
  return payload && payload.object && payload.object.message ? payload.object.message : null;
}

async function vkApi(method, params) {
  const token = requireEnv('VK_GROUP_TOKEN');
  const version = env('VK_API_VERSION', DEFAULT_VK_API_VERSION);
  const body = new URLSearchParams({
    ...params,
    access_token: token,
    v: version,
  });

  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`VK API HTTP ${response.status}`);
  }
  if (data && data.error) {
    const code = data.error.error_code || 'unknown';
    const message = data.error.error_msg || 'Unknown VK API error';
    throw new Error(`VK API error ${code}: ${message}`);
  }
  return data ? data.response : null;
}

async function sendMessage(peerId, text) {
  const message = cleanText(text).slice(0, 3900);
  if (!message) return;

  await vkApi('messages.send', {
    peer_id: String(peerId),
    random_id: String(Math.floor(Math.random() * 2147483647)),
    message,
  });
}

async function getLinkedUser(vkUserId) {
  const { data, error } = await getSupabase()
    .from('vk_links')
    .select('vk_user_id,site_user_id,email,nickname')
    .eq('vk_user_id', String(vkUserId))
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getUserStats(siteUserId, email) {
  const supabase = getSupabase();

  const byId = await supabase
    .from('user_stats')
    .select('user_id,nickname,email')
    .eq('user_id', String(siteUserId))
    .maybeSingle();

  if (!byId.error && byId.data) return byId.data;

  if (email) {
    const byEmail = await supabase
      .from('user_stats')
      .select('user_id,nickname,email')
      .eq('email', String(email))
      .maybeSingle();

    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

async function isModerator(siteUserId) {
  const { data, error } = await getSupabase()
    .from('reports')
    .select('id')
    .eq('email', 'USER_ROLE')
    .eq('link', String(siteUserId))
    .eq('status', 'moderator')
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function deleteExpiredSessions() {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  await getSupabase()
    .from('vk_report_sessions')
    .delete()
    .lt('updated_at', cutoff);
}

async function getSession(peerId, vkUserId) {
  const key = sessionKey(peerId, vkUserId);
  const { data, error } = await getSupabase()
    .from('vk_report_sessions')
    .select('session_key,vk_user_id,peer_id,step,data,updated_at')
    .eq('session_key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const updatedAt = new Date(data.updated_at).getTime();
  if (!updatedAt || Date.now() - updatedAt > SESSION_TTL_MS) {
    await deleteSession(peerId, vkUserId);
    return null;
  }

  return {
    key: data.session_key,
    vkUserId: String(data.vk_user_id),
    peerId: String(data.peer_id),
    step: data.step,
    data: data.data || {},
  };
}

async function saveSession(peerId, vkUserId, step, data) {
  const record = {
    session_key: sessionKey(peerId, vkUserId),
    vk_user_id: String(vkUserId),
    peer_id: String(peerId),
    step,
    data,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from('vk_report_sessions')
    .upsert(record, { onConflict: 'session_key' });

  if (error) throw error;
}

async function deleteSession(peerId, vkUserId) {
  const { error } = await getSupabase()
    .from('vk_report_sessions')
    .delete()
    .eq('session_key', sessionKey(peerId, vkUserId));

  if (error) throw error;
}

function photoUrlFromAttachment(attachment) {
  const photo = attachment && (attachment.photo || attachment);
  if (!photo) return '';

  if (photo.largeSizeUrl) return photo.largeSizeUrl;
  if (photo.mediumSizeUrl) return photo.mediumSizeUrl;
  if (photo.smallSizeUrl) return photo.smallSizeUrl;
  if (photo.url) return photo.url;

  const sizes = Array.isArray(photo.sizes) ? photo.sizes : [];
  const sorted = sizes
    .filter(size => size && size.url)
    .sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0));

  return sorted[0] ? sorted[0].url : '';
}

function docUrlFromAttachment(attachment) {
  const doc = attachment && attachment.doc;
  if (!doc || !doc.url) return '';

  const ext = cleanText(doc.ext).toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'].includes(ext)) return '';

  return doc.url;
}

async function uploadRemoteProof(url, sessionData, index, fallbackKind = 'vk_photo') {
  const fallback = {
    url,
    name: fallbackKind === 'vk_doc' ? `VK файл ${index + 1}` : `VK фото ${index + 1}`,
    kind: fallbackKind,
    fallback: true,
  };

  const bucket = env('REPORT_PROOFS_BUCKET', 'report-proofs');
  if (!url || !bucket) return fallback;

  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.some(type => contentType.toLowerCase().startsWith(type))) return fallback;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const lowered = contentType.toLowerCase();
    const ext = lowered.includes('png') ? 'png'
      : lowered.includes('webp') ? 'webp'
        : lowered.includes('gif') ? 'gif'
          : lowered.includes('pdf') ? 'pdf'
            : 'jpg';

    const owner = sessionData.linked?.site_user_id || sessionData.linked?.email || sessionData.vkUserId || 'vk';
    const safeUser = String(owner).replace(/[^a-zA-Z0-9_.@-]+/g, '_').slice(0, 80);
    const path = `vk/${safeUser}/${Date.now()}_${index + 1}.${ext}`;

    const { error: uploadError } = await getSupabase()
      .storage
      .from(bucket)
      .upload(path, buffer, { contentType, upsert: false });

    if (uploadError) return fallback;

    const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
    if (!data || !data.publicUrl) return fallback;

    return {
      url: data.publicUrl,
      name: fallbackKind === 'vk_doc' ? `VK файл ${index + 1}` : `VK фото ${index + 1}`,
      kind: fallbackKind === 'vk_doc' ? 'vk_doc_storage' : 'vk_photo_storage',
      bucket,
      path,
    };
  } catch (_) {
    return fallback;
  }
}

async function extractProofs(message, sessionData) {
  const proofs = [];

  for (const url of extractUrls(message.text)) {
    proofs.push({
      url,
      name: `Ссылка ${proofs.length + 1}`,
      kind: 'link',
    });
  }

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  let fileIndex = 0;

  for (const attachment of attachments) {
    if (!attachment) continue;

    if (attachment.type === 'photo' || attachment.photo) {
      const url = photoUrlFromAttachment(attachment);
      if (url) {
        proofs.push(await uploadRemoteProof(url, sessionData, fileIndex, 'vk_photo'));
        fileIndex += 1;
      }
      continue;
    }

    if (attachment.type === 'doc' || attachment.doc) {
      const url = docUrlFromAttachment(attachment);
      if (url) {
        proofs.push(await uploadRemoteProof(url, sessionData, fileIndex, 'vk_doc'));
        fileIndex += 1;
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const proof of proofs) {
    if (!proof.url || seen.has(proof.url)) continue;
    seen.add(proof.url);
    unique.push(proof);
  }

  return unique;
}

async function createReport(sessionData, message) {
  const proofs = await extractProofs(message, sessionData);

  if (!proofs.length) {
    return { ok: false, message: 'Нужно прислать ссылку, фото, скриншот или PDF-файл.' };
  }

  const now = new Date();
  const payload = {
    version: 'vk_bot_vercel_v1',
    source: 'vk_callback_vercel',
    nick: sessionData.nick,
    nickname: sessionData.nick,
    work: sessionData.work,
    comment: sessionData.work,
    date: sessionData.date,
    day: sessionData.date,
    quality: sessionData.quality,
    requestedStatus: sessionData.quality,
    proofs,
    userId: String(sessionData.linked.site_user_id),
    email: sessionData.linked.email,
    vkUserId: String(sessionData.vkUserId),
    peerId: String(sessionData.peerId),
    vkMessageId: message.id || null,
    createdAt: now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
    createdIso: now.toISOString(),
  };

  const combined =
    `Ник: ${sessionData.nick} | ` +
    `Дата: ${sessionData.date} | ` +
    `Работа: ${sessionData.work} | ` +
    `Тип сдачи: ${sessionData.quality} | ` +
    `Доказательства: ${proofs.length} | ` +
    `JSON: ${JSON.stringify(payload)}`;

  const { error } = await getSupabase().from('reports').insert([{
    id: nowId('rep_vk'),
    email: sessionData.linked.email,
    link: proofs[0]?.url || '',
    date: combined,
    status: 'На проверке',
    xp: 0,
  }]);

  if (error) {
    return { ok: false, message: `Ошибка Supabase: ${error.message}` };
  }

  return {
    ok: true,
    message:
      `Отчёт отправлен.\n\n` +
      `Ник: ${sessionData.nick}\n` +
      `Дата: ${sessionData.date}\n` +
      `Тип: ${sessionData.quality}\n` +
      `Доказательств: ${proofs.length}\n` +
      `Статус: На проверке`,
  };
}

async function startReport(peerId, vkUserId) {
  const linked = await getLinkedUser(vkUserId);

  if (!linked) {
    await sendMessage(peerId,
      `Ваш VK ID: ${vkUserId}\n\n` +
      `Этот VK не привязан к аккаунту сайта. Зайдите на сайт под своим аккаунтом, откройте «Отчётность» и привяжите этот VK ID.`
    );
    return;
  }

  const stats = await getUserStats(linked.site_user_id, linked.email);
  const nick = cleanText(linked.nickname || stats?.nickname || linked.email || `vk_${vkUserId}`);

  const moderator = await isModerator(linked.site_user_id);
  if (!moderator) {
    await sendMessage(peerId, 'Сдавать отчёты через VK-бота могут только пользователи с ролью модератора на сайте.');
    return;
  }

  const data = {
    vkUserId: String(vkUserId),
    peerId: String(peerId),
    linked: {
      ...linked,
      site_user_id: String(linked.site_user_id),
      email: linked.email || stats?.email || '',
    },
    nick,
  };

  await saveSession(peerId, vkUserId, 'work', data);

  await sendMessage(peerId,
    `Начинаем отчёт.\n\n` +
    `Аккаунт сайта: ${nick}\n\n` +
    `1/4 Напишите, что вы сделали за день.\n` +
    `Для отмены напишите /отмена.`
  );
}

async function handleSession(peerId, vkUserId, message, session) {
  const text = cleanText(message.text);
  const data = session.data || {};

  if (/^\/отмена$/i.test(text)) {
    await deleteSession(peerId, vkUserId);
    await sendMessage(peerId, 'Отчёт отменён.');
    return;
  }

  if (session.step === 'work') {
    if (text.length < 3) {
      await sendMessage(peerId, 'Опишите проделанную работу чуть подробнее.');
      return;
    }

    data.work = text;
    await saveSession(peerId, vkUserId, 'date', data);
    await sendMessage(peerId, '2/4 Укажите дату отчёта. Формат: 2026-06-25 или 25.06.2026.');
    return;
  }

  if (session.step === 'date') {
    const date = normalizeDate(text);
    if (!date) {
      await sendMessage(peerId, 'Дата не распознана. Пример: 2026-06-25 или 25.06.2026.');
      return;
    }

    data.date = date;
    await saveSession(peerId, vkUserId, 'quality', data);
    await sendMessage(peerId, '3/4 Выберите тип сдачи: Норма, Перенорма, Натяг или Герой дня.');
    return;
  }

  if (session.step === 'quality') {
    const quality = normalizeQuality(text);
    if (!quality) {
      await sendMessage(peerId, 'Напишите один из вариантов: Норма, Перенорма, Натяг, Герой дня.');
      return;
    }

    data.quality = quality;
    await saveSession(peerId, vkUserId, 'proof', data);
    await sendMessage(peerId, '4/4 Пришлите ссылку на доказательства, фото/скриншот или PDF. Можно прислать несколько вложений одним сообщением.');
    return;
  }

  if (session.step === 'proof') {
    const result = await createReport(data, message);
    if (!result.ok) {
      await sendMessage(peerId, result.message);
      return;
    }

    await deleteSession(peerId, vkUserId);
    await sendMessage(peerId, result.message);
  }
}

async function adminLinkCommand(peerId, vkUserId, text) {
  if (!botAdminIds().has(String(vkUserId))) return false;

  const match = cleanText(text).match(/^\/привязать\s+(\d{2,20})\s+([^\s]+)\s+([^\s]+)(?:\s+(.+))?$/i);
  if (!match) return false;

  const [, linkedVkUserId, siteUserId, email, nickname = ''] = match;
  const { error } = await getSupabase().from('vk_links').upsert({
    vk_user_id: linkedVkUserId,
    site_user_id: siteUserId,
    email,
    nickname: cleanText(nickname),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'site_user_id' });

  if (error) await sendMessage(peerId, `Ошибка привязки: ${error.message}`);
  else await sendMessage(peerId, `Привязано: VK ${linkedVkUserId} → ${email}`);

  return true;
}

function helpText(vkUserId) {
  return [
    `Ваш VK ID: ${vkUserId}`,
    '',
    'Команды:',
    '/отчет — начать сдачу отчёта',
    '/id — показать ваш VK ID для привязки на сайте',
    '/отмена — отменить текущую сдачу',
    '',
    'Перед первой сдачей зайдите на сайт под своим аккаунтом и привяжите VK ID в разделе «Отчётность».',
  ].join('\n');
}

async function handleMessageNew(payload) {
  const message = getMessage(payload);
  if (!message) return;
  if (message.out) return;

  const peerId = String(message.peer_id || '');
  const vkUserId = String(message.from_id || '');
  const text = cleanText(message.text);

  if (!peerId || !vkUserId || vkUserId.startsWith('-')) return;

  await deleteExpiredSessions();

  if (/^\/(?:id|айди|vkid)$/i.test(text)) {
    await sendMessage(peerId, `Ваш VK ID: ${vkUserId}`);
    return;
  }

  if (/^\/(?:help|помощь|start|старт)$/i.test(text)) {
    await sendMessage(peerId, helpText(vkUserId));
    return;
  }

  if (await adminLinkCommand(peerId, vkUserId, text)) return;

  const session = await getSession(peerId, vkUserId);
  if (session) {
    await handleSession(peerId, vkUserId, message, session);
    return;
  }

  if (/^\/отч[её]т$/i.test(text)) {
    await startReport(peerId, vkUserId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'ch89-vk-report-bot-vercel' });
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
    console.error('Invalid JSON body:', error);
    res.status(400).send('bad request');
    return;
  }

  if (!validateCallbackSecret(payload)) {
    res.status(403).send('bad secret');
    return;
  }

  if (payload.type === 'confirmation') {
    const confirmation = requireEnv('VK_CALLBACK_CONFIRMATION');
    res.status(200).send(confirmation);
    return;
  }

  try {
    if (payload.type === 'message_new') {
      await handleMessageNew(payload);
    }
  } catch (error) {
    console.error('VK callback handler error:', error);

    const message = getMessage(payload);
    if (message && message.peer_id) {
      try {
        await sendMessage(message.peer_id, `Ошибка бота: ${error.message || error}`);
      } catch (sendError) {
        console.error('Failed to send VK error message:', sendError);
      }
    }
  }

  res.status(200).send('ok');
};
