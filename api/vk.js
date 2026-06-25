const { createClient } = require('@supabase/supabase-js');

const SESSION_TTL_MS = 25 * 60 * 1000;
const REPORT_QUALITY = ['Норма', 'Перенорма', 'Натяг', 'Герой дня'];
const DEFAULT_VK_API_VERSION = '5.199';
const MAX_VK_MESSAGE = 3900;

let supabaseClient;

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

function boolEnv(name, fallback = false) {
  const value = env(name);
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'да', 'on'].includes(value.toLowerCase());
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

function escapeLine(value) {
  return cleanText(value).replace(/\s+/g, ' ').slice(0, 900);
}

function nowId(prefix = 'rep_vk') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function moscowDateIso() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function moscowDateTime() {
  return new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
}

function normalizeDate(input) {
  const raw = cleanText(input).toLowerCase();
  if (!raw || ['сегодня', 'today', 'щас', 'сейчас'].includes(raw)) return moscowDateIso();

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
    ['норм', 'Норма'],
    ['норматив', 'Норма'],
    ['перенорма', 'Перенорма'],
    ['пере', 'Перенорма'],
    ['пер', 'Перенорма'],
    ['натяг', 'Натяг'],
    ['нат', 'Натяг'],
    ['герой', 'Герой дня'],
    ['герой дня', 'Герой дня'],
    ['геройдня', 'Герой дня'],
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

function ownerVkId() {
  // Fixed owner for this build. OWNER_VK_ID can still be set in Vercel,
  // but if it is missing the bot recognizes only this VK account as owner.
  return env('OWNER_VK_ID') || env('BOT_OWNER_VK_ID') || '628466808';
}

function isOwner(vkUserId) {
  const owner = ownerVkId();
  return !!owner && String(vkUserId) === String(owner);
}

function ownerOnlyText() {
  return ownerVkId()
    ? '⛔ Эта команда доступна только владельцу бота.'
    : '⛔ Владелец бота не совпадает с вашим VK ID.';
}

function allowedGroupTypes() {
  return new Set(['reports', 'staff', 'general', 'ai', 'off']);
}

function groupTypeTitle(type) {
  return {
    reports: 'группа отчётов',
    staff: 'staff-группа',
    general: 'общая группа',
    ai: 'AI-чат',
    off: 'без типа',
  }[type] || type;
}

function reportsPeerId() {
  return env('REPORTS_PEER_ID') || env('VK_REPORTS_PEER_ID') || '';
}

function notifyPeerId() {
  return env('NOTIFY_PEER_ID') || reportsPeerId();
}

function cleanupEnabled() {
  return boolEnv('CLEANUP_MESSAGES_AFTER_REPORT', true);
}

async function getGroupBinding(peerId) {
  const { data, error } = await getSupabase()
    .from('vk_group_bindings')
    .select('peer_id,group_type,title,set_by_vk_user_id,updated_at')
    .eq('peer_id', String(peerId))
    .maybeSingle();

  if (error) {
    // Old installs may not have the table yet; env fallback should still work.
    console.warn('getGroupBinding failed:', error.message || error);
    return null;
  }
  return data || null;
}

async function setGroupBinding(peerId, groupType, vkUserId) {
  const normalized = cleanText(groupType).toLowerCase();
  if (!allowedGroupTypes().has(normalized)) {
    throw new Error('unknown group type');
  }

  const { error } = await getSupabase().from('vk_group_bindings').upsert({
    peer_id: String(peerId),
    group_type: normalized,
    title: groupTypeTitle(normalized),
    set_by_vk_user_id: String(vkUserId),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'peer_id' });

  if (error) throw error;
  return normalized;
}

async function clearGroupBinding(peerId) {
  const { error } = await getSupabase()
    .from('vk_group_bindings')
    .delete()
    .eq('peer_id', String(peerId));
  if (error) throw error;
}

async function getGroupType(peerId) {
  if (String(peerId) === String(reportsPeerId())) return 'reports';
  if (String(peerId) === String(env('STAFF_PEER_ID') || notifyPeerId())) return 'staff';
  const binding = await getGroupBinding(peerId);
  return binding?.group_type || '';
}

async function isReportPeer(peerId) {
  const configured = reportsPeerId();
  if (configured) return String(peerId) === String(configured);
  return (await getGroupType(peerId)) === 'reports';
}

function isGroupPeer(peerId) {
  return Number(peerId) >= 2000000000;
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

async function sendMessage(peerId, text, options = {}) {
  const message = cleanText(text).slice(0, MAX_VK_MESSAGE);
  if (!message) return null;

  const response = await vkApi('messages.send', {
    peer_id: String(peerId),
    random_id: String(Math.floor(Math.random() * 2147483647)),
    disable_mentions: options.disableMentions === false ? '0' : '1',
    message,
  });

  if (typeof response === 'number') return response;
  if (response && typeof response.message_id === 'number') return response.message_id;
  if (response && typeof response.conversation_message_id === 'number') return response.conversation_message_id;
  return null;
}

async function deleteMessagesBestEffort(peerId, ids) {
  const cleanIds = Array.from(new Set((ids || [])
    .map(x => Number(x))
    .filter(x => Number.isFinite(x) && x > 0)));

  if (!cleanIds.length) return;

  const chunks = [];
  for (let i = 0; i < cleanIds.length; i += 80) chunks.push(cleanIds.slice(i, i + 80));

  for (const chunk of chunks) {
    const joined = chunk.join(',');
    try {
      await vkApi('messages.delete', {
        peer_id: String(peerId),
        cmids: joined,
        delete_for_all: '1',
      });
      continue;
    } catch (error) {
      console.warn('VK delete by cmids failed:', error.message || error);
    }

    try {
      await vkApi('messages.delete', {
        message_ids: joined,
        delete_for_all: '1',
      });
    } catch (error) {
      console.warn('VK delete by message_ids failed:', error.message || error);
    }
  }
}

function addCleanupId(data, id) {
  const num = Number(id);
  if (!Number.isFinite(num) || num <= 0) return data;
  const arr = Array.isArray(data.cleanupMessageIds) ? data.cleanupMessageIds : [];
  data.cleanupMessageIds = Array.from(new Set([...arr, num])).slice(-80);
  return data;
}

async function sendTracked(peerId, text, data) {
  const id = await sendMessage(peerId, text);
  addCleanupId(data, id);
  return id;
}

function messageId(message) {
  return Number(message && (message.conversation_message_id || message.id || message.cmid || 0)) || 0;
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
    .select('user_id,nickname,email,role')
    .eq('user_id', String(siteUserId))
    .maybeSingle();

  if (!byId.error && byId.data) return byId.data;

  if (email) {
    const byEmail = await supabase
      .from('user_stats')
      .select('user_id,nickname,email,role')
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

async function isAp(siteUserId) {
  const { data, error } = await getSupabase()
    .from('reports')
    .select('id')
    .eq('email', 'USER_ROLE')
    .eq('link', String(siteUserId))
    .eq('status', 'ap')
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function isBotAdminOrAp(vkUserId) {
  // Backward-compatible name, but high-privilege bot ownership is now OWNER_VK_ID only.
  return isOwner(vkUserId);
}

async function isLinkedModerator(vkUserId) {
  if (isOwner(vkUserId)) return true;
  const linked = await getLinkedUser(vkUserId).catch(() => null);
  if (!linked) return false;
  return await isModerator(linked.site_user_id).catch(() => false);
}

async function canUseStaffCommands(vkUserId, peerId) {
  if (isOwner(vkUserId)) return true;
  const type = await getGroupType(peerId).catch(() => '');
  if (type === 'staff') return await isLinkedModerator(vkUserId).catch(() => false);
  return await isLinkedModerator(vkUserId).catch(() => false);
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

  const bucket = env('REPORT_PROOFS_BUCKET', '');
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
  const proofText = cleanText(sessionData.proofText || message.text || '');

  for (const url of extractUrls(proofText)) {
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

async function loadUserForReport(vkUserId) {
  const linked = await getLinkedUser(vkUserId);
  if (!linked) {
    return {
      ok: false,
      text:
        `⚠️ VK не привязан к сайту.\n\n` +
        `🆔 Ваш VK ID: ${vkUserId}\n` +
        `Зайдите на сайт → «Отчётность» → привяжите этот VK ID.`,
    };
  }

  const stats = await getUserStats(linked.site_user_id, linked.email);
  const nick = cleanText(linked.nickname || stats?.nickname || linked.email || `vk_${vkUserId}`);

  const moderator = await isModerator(linked.site_user_id);
  if (!moderator) {
    return { ok: false, text: '⛔ Сдавать отчёты через VK-бота могут только пользователи со статусом модератора на сайте.' };
  }

  return {
    ok: true,
    data: {
      vkUserId: String(vkUserId),
      linked: {
        ...linked,
        site_user_id: String(linked.site_user_id),
        email: linked.email || stats?.email || '',
      },
      nick,
    },
  };
}

async function createReport(sessionData, message) {
  const proofs = await extractProofs(message, sessionData);
  if (!proofs.length) {
    return { ok: false, message: '⚠️ Нужно прислать ссылку, фото, скриншот или PDF-файл.' };
  }

  const now = new Date();
  const payload = {
    version: 'vk_bot_vercel_v3_ai_staff',
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
    vkConversationMessageId: message.conversation_message_id || null,
    createdAt: moscowDateTime(),
    createdIso: now.toISOString(),
  };

  const combined =
    `Ник: ${sessionData.nick} | ` +
    `Дата: ${sessionData.date} | ` +
    `Работа: ${sessionData.work} | ` +
    `Тип сдачи: ${sessionData.quality} | ` +
    `Доказательства: ${proofs.length} | ` +
    `JSON: ${JSON.stringify(payload)}`;

  const reportId = nowId('rep_vk');
  const { error } = await getSupabase().from('reports').insert([{
    id: reportId,
    email: sessionData.linked.email,
    link: proofs[0]?.url || '',
    date: combined,
    status: 'На проверке',
    xp: 0,
  }]);

  if (error) return { ok: false, message: `❌ Ошибка Supabase: ${error.message}` };

  const summary = [
    '✅ ОТЧЁТ ОТПРАВЛЕН',
    '',
    `👤 Модератор: ${escapeLine(sessionData.nick)}`,
    `📅 Дата: ${sessionData.date}`,
    `🏷 Тип: ${sessionData.quality}`,
    `🧾 Работа: ${escapeLine(sessionData.work)}`,
    `📎 Доказательств: ${proofs.length}`,
    `🕒 Статус: На проверке`,
    `#️⃣ ID: ${reportId}`,
  ].join('\n');

  return { ok: true, message: summary, reportId, proofs };
}

function parseInlineReport(text) {
  const body = cleanText(text).replace(/^\/отч[её]т\b/i, '').trim();
  if (!body) return null;

  const parts = body
    .split(/\s*[|;]\s*|\n+/)
    .map(x => cleanText(x))
    .filter(Boolean);

  if (parts.length >= 4) {
    const date = normalizeDate(parts[1]);
    const quality = normalizeQuality(parts[2]);
    if (!date || !quality) return { error: 'Формат: /отчет работа | дата | тип | ссылка/доказательство' };
    return { work: parts[0], date, quality, proofText: parts.slice(3).join('\n') };
  }

  if (parts.length === 3) {
    const quality = normalizeQuality(parts[1]);
    if (!quality) return { error: 'Формат: /отчет работа | тип | ссылка/доказательство' };
    return { work: parts[0], date: moscowDateIso(), quality, proofText: parts[2] };
  }

  return { error: 'Формат быстрой сдачи: /отчет работа | дата | тип | ссылка' };
}

async function startReport(peerId, vkUserId, message) {
  if (!(await isReportPeer(peerId))) {
    await sendMessage(peerId, `⛔ Отчёты принимаются только в специальной группе.\nPeer ID группы: ${reportsPeerId()}`);
    return;
  }

  const loaded = await loadUserForReport(vkUserId);
  if (!loaded.ok) {
    await sendMessage(peerId, loaded.text);
    return;
  }

  const data = {
    ...loaded.data,
    peerId: String(peerId),
    cleanupMessageIds: [],
  };
  addCleanupId(data, messageId(message));

  await saveSession(peerId, vkUserId, 'work', data);

  await sendTracked(peerId,
    `🧾 СДАЧА ОТЧЁТА\n\n` +
    `👤 Аккаунт: ${data.nick}\n\n` +
    `1/4 Напишите, что сделали за день.\n` +
    `✖️ Отмена: /отмена`,
    data
  );

  await saveSession(peerId, vkUserId, 'work', data);
}

async function startInlineReport(peerId, vkUserId, message, parsed) {
  if (!(await isReportPeer(peerId))) {
    await sendMessage(peerId, `⛔ Отчёты принимаются только в специальной группе.\nPeer ID группы: ${reportsPeerId()}`);
    return;
  }

  if (parsed.error) {
    await sendMessage(peerId, `⚠️ ${parsed.error}\n\nПример:\n/отчет Проверил жалобы, закрыл 12 тем | ${moscowDateIso()} | Норма | https://example.com`);
    return;
  }

  if (!parsed.work || parsed.work.length < 3) {
    await sendMessage(peerId, '⚠️ Опишите проделанную работу чуть подробнее.');
    return;
  }

  const loaded = await loadUserForReport(vkUserId);
  if (!loaded.ok) {
    await sendMessage(peerId, loaded.text);
    return;
  }

  const data = {
    ...loaded.data,
    peerId: String(peerId),
    work: parsed.work,
    date: parsed.date,
    quality: parsed.quality,
    proofText: parsed.proofText,
    cleanupMessageIds: [],
  };
  addCleanupId(data, messageId(message));

  const result = await createReport(data, message);
  if (!result.ok) {
    await sendMessage(peerId, result.message);
    return;
  }

  if (cleanupEnabled()) await deleteMessagesBestEffort(peerId, data.cleanupMessageIds);
  await sendMessage(peerId, result.message);
}

async function handleSession(peerId, vkUserId, message, session) {
  const text = cleanText(message.text);
  const data = session.data || {};
  addCleanupId(data, messageId(message));

  if (/^\/отмена$/i.test(text)) {
    const ids = data.cleanupMessageIds || [];
    await deleteSession(peerId, vkUserId);
    if (cleanupEnabled()) await deleteMessagesBestEffort(peerId, ids.concat([messageId(message)]));
    await sendMessage(peerId, '🧹 Отчёт отменён. Сообщения формы очищены.');
    return;
  }

  if (session.step === 'work') {
    if (text.length < 3) {
      await sendTracked(peerId, '⚠️ Опишите проделанную работу чуть подробнее.', data);
      await saveSession(peerId, vkUserId, 'work', data);
      return;
    }

    data.work = text;
    await sendTracked(peerId, `2/4 Укажите дату отчёта.\nФормат: ${moscowDateIso()} или 25.06.2026.`, data);
    await saveSession(peerId, vkUserId, 'date', data);
    return;
  }

  if (session.step === 'date') {
    const date = normalizeDate(text);
    if (!date) {
      await sendTracked(peerId, `⚠️ Дата не распознана. Пример: ${moscowDateIso()} или 25.06.2026.`, data);
      await saveSession(peerId, vkUserId, 'date', data);
      return;
    }

    data.date = date;
    await sendTracked(peerId, '3/4 Тип сдачи: Норма / Перенорма / Натяг / Герой дня.', data);
    await saveSession(peerId, vkUserId, 'quality', data);
    return;
  }

  if (session.step === 'quality') {
    const quality = normalizeQuality(text);
    if (!quality) {
      await sendTracked(peerId, '⚠️ Напишите один вариант: Норма, Перенорма, Натяг, Герой дня.', data);
      await saveSession(peerId, vkUserId, 'quality', data);
      return;
    }

    data.quality = quality;
    await sendTracked(peerId, '4/4 Пришлите ссылку на доказательства, фото/скриншот или PDF. Можно несколько вложений одним сообщением.', data);
    await saveSession(peerId, vkUserId, 'proof', data);
    return;
  }

  if (session.step === 'proof') {
    const result = await createReport(data, message);
    if (!result.ok) {
      await sendTracked(peerId, result.message, data);
      await saveSession(peerId, vkUserId, 'proof', data);
      return;
    }

    await deleteSession(peerId, vkUserId);
    if (cleanupEnabled()) await deleteMessagesBestEffort(peerId, data.cleanupMessageIds || []);
    await sendMessage(peerId, result.message);
  }
}

function formatUserLine(user, prefix = '•') {
  return `${prefix} ${escapeLine(user.nickname || user.email || user.user_id)} — ${user.email || 'без email'}\n  ID: ${user.user_id}`;
}

async function listModerators(peerId) {
  const { data: roles, error } = await getSupabase()
    .from('reports')
    .select('id,link,status,date')
    .eq('email', 'USER_ROLE')
    .eq('status', 'moderator')
    .limit(200);

  if (error) throw error;
  const ids = Array.from(new Set((roles || []).map(x => String(x.link || '')).filter(Boolean)));
  if (!ids.length) {
    await sendMessage(peerId, '👥 Модераторов пока нет.');
    return;
  }

  const { data: users } = await getSupabase()
    .from('user_stats')
    .select('user_id,nickname,email')
    .in('user_id', ids);

  const byId = new Map((users || []).map(u => [String(u.user_id), u]));
  const lines = ids.map(id => formatUserLine(byId.get(id) || { user_id: id }, '▫️'));
  await sendMessage(peerId, `👥 МОДЕРАТОРЫ (${ids.length})\n\n${lines.join('\n')}`);
}

async function grantModerator(peerId, vkUserId, targetVkId) {
  if (!isOwner(vkUserId)) {
    await sendMessage(peerId, ownerOnlyText());
    return;
  }

  const linked = await getLinkedUser(targetVkId);
  if (!linked) {
    await sendMessage(peerId, `⚠️ VK ${targetVkId} не привязан к аккаунту сайта.`);
    return;
  }

  const stats = await getUserStats(linked.site_user_id, linked.email);
  const nick = stats?.nickname || linked.nickname || linked.email || linked.site_user_id;

  const { data: existing } = await getSupabase()
    .from('reports')
    .select('id')
    .eq('email', 'USER_ROLE')
    .eq('link', String(linked.site_user_id))
    .eq('status', 'moderator')
    .limit(1);

  if (existing && existing.length) {
    await sendMessage(peerId, `ℹ️ ${nick} уже модератор.`);
    return;
  }

  const { error } = await getSupabase().from('reports').insert([{
    id: `role_mod_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    email: 'USER_ROLE',
    link: String(linked.site_user_id),
    date: `Выдано через VK-бота · VK ${targetVkId} · ${moscowDateTime()}`,
    status: 'moderator',
    xp: 0,
  }]);

  if (error) throw error;
  await sendMessage(peerId, `✅ Выдан статус модератора.\n👤 ${nick}\n🆔 VK: ${targetVkId}`);
}

async function revokeModerator(peerId, vkUserId, targetVkId) {
  if (!isOwner(vkUserId)) {
    await sendMessage(peerId, ownerOnlyText());
    return;
  }

  const linked = await getLinkedUser(targetVkId);
  if (!linked) {
    await sendMessage(peerId, `⚠️ VK ${targetVkId} не привязан к аккаунту сайта.`);
    return;
  }

  const { error } = await getSupabase()
    .from('reports')
    .delete()
    .eq('email', 'USER_ROLE')
    .eq('link', String(linked.site_user_id))
    .eq('status', 'moderator');

  if (error) throw error;
  await sendMessage(peerId, `🧹 Статус модератора снят.\n🆔 VK: ${targetVkId}`);
}

async function userInfo(peerId, targetVkId) {
  const linked = await getLinkedUser(targetVkId);
  if (!linked) {
    await sendMessage(peerId, `⚠️ VK ${targetVkId} не привязан.`);
    return;
  }

  const stats = await getUserStats(linked.site_user_id, linked.email);
  const mod = await isModerator(linked.site_user_id).catch(() => false);
  const ap = await isAp(linked.site_user_id).catch(() => false);

  await sendMessage(peerId, [
    '👤 КАРТОЧКА ПОЛЬЗОВАТЕЛЯ',
    '',
    `🆔 VK: ${targetVkId}`,
    `🧩 Site ID: ${linked.site_user_id}`,
    `📧 Email: ${linked.email || stats?.email || '—'}`,
    `🏷 Ник: ${linked.nickname || stats?.nickname || '—'}`,
    `🛡 Модератор: ${mod ? 'да' : 'нет'}`,
    `👑 Руководство АП: ${ap ? 'да' : 'нет'}`,
  ].join('\n'));
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

function applicationFields(row) {
  const payload = parseJsonMaybe(row.date) || {};
  const fromCombined = String(row.date || '');
  const nickMatch = fromCombined.match(/Ник:\s*([^|]+)/i);
  return {
    id: row.id,
    type: row.email,
    nick: payload.nick || payload.nickname || nickMatch?.[1] || '',
    forum: payload.forum || payload.fa || payload.forumUrl || payload.forum_link || '',
    vk: payload.vk || payload.vkUrl || payload.vk_link || payload.vkid || payload.vkId || '',
    discord: payload.discord || payload.ds || '',
    org: payload.org || payload.organization || payload.post || '',
    comment: payload.comment || payload.text || payload.reason || payload.work || '',
    status: row.status || '',
    link: row.link || '',
    xp: row.xp || 0,
    raw: payload,
  };
}

function formatApplicationRow(row) {
  const p = applicationFields(row);
  const lines = [
    '📨 ЗАЯВКА',
    '',
    `#️⃣ ID: ${p.id}`,
    `🏷 Тип: ${p.type || '—'}`,
  ];

  if (p.nick) lines.push(`👤 Ник: ${escapeLine(p.nick)}`);
  if (p.org) lines.push(`🏛 Организация/пост: ${escapeLine(p.org)}`);
  if (p.vk) lines.push(`🔗 VK: ${escapeLine(p.vk)}`);
  if (p.forum) lines.push(`📝 Форум: ${escapeLine(p.forum)}`);
  if (p.discord) lines.push(`💬 Discord: ${escapeLine(p.discord)}`);
  if (p.link) lines.push(`📎 Ссылка: ${escapeLine(p.link)}`);
  if (p.status) lines.push(`📌 Статус: ${escapeLine(p.status)}`);
  if (p.comment) lines.push(`💭 Комментарий: ${escapeLine(p.comment)}`);

  return lines.join('\n');
}

async function listApplications(peerId, limit = 5) {
  const emails = env('APPLICATION_REPORT_EMAILS', 'GOSS_PROFILE,MOD_APPLICATION,APPLICATION,INACTIVE_REQ')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  let query = getSupabase().from('reports').select('*').order('id', { ascending: false }).limit(Math.min(Math.max(limit, 1), 10));
  if (emails.length) query = query.in('email', emails);

  const { data, error } = await query;
  if (error) throw error;
  if (!data || !data.length) {
    await sendMessage(peerId, '📭 Заявок пока нет.');
    return;
  }

  await sendMessage(peerId, `📋 ПОСЛЕДНИЕ ЗАЯВКИ\n\n${data.map(formatApplicationRow).join('\n\n────────────\n\n')}`);
}

async function adminLinkCommand(peerId, vkUserId, text) {
  if (!isOwner(vkUserId)) return false;

  const match = cleanText(text).match(/^\/привязать\s+(\d{2,20})\s+([^\s]+)\s+([^\s]+)(?:\s+(.+))?$/i);
  if (!match) return false;

  const [, linkedVkUserId, siteUserId, email, nickname = ''] = match;
  const { error } = await getSupabase().from('vk_links').upsert({
    vk_user_id: linkedVkUserId,
    site_user_id: siteUserId,
    email,
    nickname: cleanText(nickname),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vk_user_id' });

  if (error) await sendMessage(peerId, `❌ Ошибка привязки: ${error.message}`);
  else await sendMessage(peerId, `✅ Привязано: VK ${linkedVkUserId} → ${email}`);

  return true;
}


async function askDeepSeek(mode, question, context = {}) {
  const apiKey = env('DEEPSEEK_API_KEY');
  if (!apiKey) {
    return '⚠️ DeepSeek API не настроен. Добавь DEEPSEEK_API_KEY в Vercel Environment Variables и сделай Redeploy.';
  }

  const baseUrl = env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = env('DEEPSEEK_MODEL', 'deepseek-chat');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env('DEEPSEEK_TIMEOUT_MS', '22000')) || 22000);

  const system = [
    'Ты помощник штаба модерации CH89.',
    'Отвечай по-русски, кратко, структурно, без воды.',
    'Не выдумывай внутренние правила проекта. Если правил недостаточно, явно пиши, что нужно свериться с регламентом.',
    'Не призывай к травле, сливу персональных данных или обходу правил платформ.',
    'Для спорных ситуаций давай: риск, рекомендуемое действие, формулировку ответа игроку, что проверить перед решением.',
  ].join('\n');

  const modeHint = {
    ai: 'Ответь как нейро-помощник модерации.',
    advice: 'Дай практический совет модератору.',
    punishment: 'Оцени ситуацию и предложи мягкую, среднюю и строгую меру наказания. Укажи, что финальное решение за регламентом.',
    template: 'Составь готовый официальный ответ игроку/кандидату. Тон: спокойный, деловой.',
    analyze: 'Разбери кейс: факты, риски, недостающие данные, рекомендуемое решение.',
  }[mode] || 'Ответь как помощник модерации.';

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: Number(env('DEEPSEEK_TEMPERATURE', '0.35')),
        max_tokens: Number(env('DEEPSEEK_MAX_TOKENS', '850')),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `${modeHint}\n\nКонтекст: peer_id=${context.peerId || '—'}, vk_id=${context.vkUserId || '—'}\n\nЗапрос:\n${question}` },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const details = data?.error?.message || data?.message || `HTTP ${response.status}`;
      return `❌ DeepSeek API ошибка: ${details}`;
    }

    const answer = data?.choices?.[0]?.message?.content || '';
    return cleanText(answer) || '⚠️ DeepSeek вернул пустой ответ.';
  } catch (error) {
    if (error.name === 'AbortError') return '⏱ DeepSeek не успел ответить. Попробуй короче сформулировать запрос.';
    return `❌ DeepSeek недоступен: ${error.message || error}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function canUseAi(vkUserId, peerId) {
  if (isOwner(vkUserId)) return true;
  const type = await getGroupType(peerId).catch(() => '');
  if (['staff', 'reports', 'ai'].includes(type)) return true;
  return await isLinkedModerator(vkUserId).catch(() => false);
}

async function handleAiCommand(peerId, vkUserId, text) {
  const raw = cleanText(text);
  let mode = '';
  let question = '';

  const slash = raw.match(/^\/(ai|ии|нейро|совет|разбор|наказание|шаблон)\s+([\s\S]+)$/i);
  if (slash) {
    const cmd = slash[1].toLowerCase();
    question = slash[2];
    mode = cmd === 'совет' ? 'advice'
      : cmd === 'разбор' ? 'analyze'
        : cmd === 'наказание' ? 'punishment'
          : cmd === 'шаблон' ? 'template'
            : 'ai';
  } else {
    const mention = raw.match(/^(?:бот|bot|ч89|ch89)[,!\s]+([\s\S]+)$/i);
    if (mention) {
      mode = 'ai';
      question = mention[1];
    }
  }

  if (!question) return false;

  if (!(await canUseAi(vkUserId, peerId))) {
    await sendMessage(peerId, '⛔ AI-команды доступны владельцу, модераторам и разрешённым группам staff/reports/ai.');
    return true;
  }

  const typing = await sendMessage(peerId, '🧠 Думаю...');
  const answer = await askDeepSeek(mode, question, { peerId, vkUserId });
  const title = {
    advice: '🧭 СОВЕТ МОДЕРАЦИИ',
    analyze: '🔎 РАЗБОР СИТУАЦИИ',
    punishment: '⚖️ РЕКОМЕНДАЦИЯ ПО НАКАЗАНИЮ',
    template: '📝 ШАБЛОН ОТВЕТА',
    ai: '🧠 AI-ПОМОЩНИК',
  }[mode] || '🧠 AI-ПОМОЩНИК';
  if (typing && cleanupEnabled()) await deleteMessagesBestEffort(peerId, [typing]);
  await sendMessage(peerId, `${title}\n━━━━━━━━━━━━━━━━\n\n${answer}`);
  return true;
}

async function handleGroupCommand(peerId, vkUserId, text) {
  const raw = cleanText(text);
  if (!/^\/group\b/i.test(raw) && !/^\/группа\b/i.test(raw) && !/^\/groups\b/i.test(raw) && !/^\/группы\b/i.test(raw)) return false;

  if (!isOwner(vkUserId)) {
    await sendMessage(peerId, ownerOnlyText());
    return true;
  }

  const list = raw.match(/^\/(?:groups|группы)$/i);
  if (list) {
    const { data, error } = await getSupabase()
      .from('vk_group_bindings')
      .select('peer_id,group_type,title,updated_at,set_by_vk_user_id')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data || !data.length) {
      await sendMessage(peerId, '📭 Группы ещё не привязаны. Используй /group type staff или /group type reports в нужной беседе.');
      return true;
    }
    await sendMessage(peerId, `🧩 ПРИВЯЗАННЫЕ ГРУППЫ\n━━━━━━━━━━━━━━━━\n\n${data.map(x => `• ${x.peer_id} — ${x.group_type} (${x.title || '—'})`).join('\n')}`);
    return true;
  }

  if (/^\/(?:group|группа)\s+info$/i.test(raw)) {
    const binding = await getGroupBinding(peerId);
    await sendMessage(peerId, [
      '🧩 ГРУППА',
      '━━━━━━━━━━━━━━━━',
      `💬 peer_id: ${peerId}`,
      `🏷 Тип: ${binding?.group_type || 'не задан'}`,
      `📌 Название: ${binding?.title || '—'}`,
      `👑 Владелец: ${ownerVkId() || 'OWNER_VK_ID не задан'}`,
    ].join('\n'));
    return true;
  }

  if (/^\/(?:group|группа)\s+(?:clear|off|снять|очистить)$/i.test(raw)) {
    await clearGroupBinding(peerId);
    await sendMessage(peerId, `🧹 Тип группы очищен.\n💬 peer_id: ${peerId}`);
    return true;
  }

  const type = raw.match(/^\/(?:group|группа)\s+type\s+(reports|staff|general|ai|off)$/i);
  if (type) {
    const normalized = await setGroupBinding(peerId, type[1], vkUserId);
    await sendMessage(peerId, [
      '✅ ТИП ГРУППЫ СОХРАНЁН',
      '━━━━━━━━━━━━━━━━',
      `💬 peer_id: ${peerId}`,
      `🏷 Тип: ${normalized} · ${groupTypeTitle(normalized)}`,
      '',
      normalized === 'staff' ? '📨 Теперь новые заявки будут приходить сюда.' : '',
      normalized === 'reports' ? '🧾 Теперь отчёты можно сдавать здесь.' : '',
    ].filter(Boolean).join('\n'));
    return true;
  }

  await sendMessage(peerId, [
    '⚙️ КОМАНДЫ ГРУПП',
    '━━━━━━━━━━━━━━━━',
    '• /group type staff — сделать текущую беседу staff-группой для заявок',
    '• /group type reports — сделать текущую беседу группой отчётов',
    '• /group type ai — разрешить AI-общение в этой беседе',
    '• /group info — текущая привязка',
    '• /groups — список привязанных групп',
    '• /group clear — снять тип с текущей беседы',
  ].join('\n'));
  return true;
}

function reportPayloadFromRow(row) {
  const payload = parseJsonMaybe(row.date) || {};
  const combined = String(row.date || '');
  return {
    id: row.id,
    email: row.email,
    status: row.status || '',
    xp: row.xp || 0,
    link: row.link || '',
    nick: payload.nick || payload.nickname || (combined.match(/Ник:\s*([^|]+)/i)?.[1] || ''),
    work: payload.work || payload.comment || (combined.match(/Работа:\s*([^|]+)/i)?.[1] || ''),
    date: payload.date || payload.day || (combined.match(/Дата:\s*([^|]+)/i)?.[1] || ''),
    quality: payload.quality || payload.requestedStatus || (combined.match(/Тип сдачи:\s*([^|]+)/i)?.[1] || ''),
    userId: payload.userId || payload.user_id || '',
    vkUserId: payload.vkUserId || '',
  };
}

function formatReportRow(row) {
  const p = reportPayloadFromRow(row);
  return [
    `#️⃣ ${p.id}`,
    `👤 ${escapeLine(p.nick || p.email || '—')}`,
    `📅 ${escapeLine(p.date || '—')} · ${escapeLine(p.quality || '—')}`,
    `📌 ${escapeLine(p.status || '—')} · XP: ${p.xp || 0}`,
    p.work ? `🧾 ${escapeLine(p.work)}` : '',
    p.link ? `📎 ${escapeLine(p.link)}` : '',
  ].filter(Boolean).join('\n');
}

async function listPendingReports(peerId, limit = 5) {
  const { data, error } = await getSupabase()
    .from('reports')
    .select('*')
    .eq('status', 'На проверке')
    .not('email', 'eq', 'USER_ROLE')
    .limit(Math.min(Math.max(Number(limit) || 5, 1), 10));
  if (error) throw error;
  if (!data || !data.length) {
    await sendMessage(peerId, '📭 Отчётов на проверке нет.');
    return;
  }
  await sendMessage(peerId, `🧾 ОТЧЁТЫ НА ПРОВЕРКЕ\n━━━━━━━━━━━━━━━━\n\n${data.map(formatReportRow).join('\n\n────────────\n\n')}`);
}

async function reportInfo(peerId, reportId) {
  const { data, error } = await getSupabase()
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await sendMessage(peerId, `⚠️ Отчёт не найден: ${reportId}`);
    return;
  }
  await sendMessage(peerId, `🧾 ОТЧЁТ\n━━━━━━━━━━━━━━━━\n\n${formatReportRow(data)}`);
}

async function updateReportStatus(peerId, vkUserId, reportId, status, xp = null, reason = '') {
  if (!(await canUseStaffCommands(vkUserId, peerId))) {
    await sendMessage(peerId, '⛔ Команда доступна владельцу или модератору.');
    return;
  }
  const update = { status };
  if (xp !== null && !Number.isNaN(Number(xp))) update.xp = Number(xp);
  if (reason) update.date = undefined;
  const { error } = await getSupabase().from('reports').update(update).eq('id', reportId);
  if (error) throw error;
  await sendMessage(peerId, `${status === 'Принят' ? '✅' : '❌'} Отчёт обновлён.\n#️⃣ ID: ${reportId}\n📌 Статус: ${status}${xp !== null ? `\n⭐ XP: ${Number(xp)}` : ''}${reason ? `\n💭 Причина: ${escapeLine(reason)}` : ''}`);
}

async function changeUserXp(peerId, vkUserId, targetVkId, amount, reason = '') {
  if (!isOwner(vkUserId)) {
    await sendMessage(peerId, ownerOnlyText());
    return;
  }
  const linked = await getLinkedUser(targetVkId);
  if (!linked) {
    await sendMessage(peerId, `⚠️ VK ${targetVkId} не привязан.`);
    return;
  }
  const numeric = Number(String(amount).replace('+', ''));
  if (!Number.isFinite(numeric)) {
    await sendMessage(peerId, '⚠️ Формат: /xp <vk_id> +100 причина');
    return;
  }
  const { data: xpRow } = await getSupabase()
    .from('user_stats')
    .select('report_xp')
    .eq('user_id', linked.site_user_id)
    .maybeSingle();
  const currentXp = Number(xpRow?.report_xp || 0);
  const { error } = await getSupabase().from('user_stats').update({
    report_xp: currentXp + numeric,
  }).eq('user_id', linked.site_user_id);
  if (error) throw error;
  await sendMessage(peerId, `✅ XP изменён.\n👤 ${escapeLine(linked.nickname || linked.email)}\n📈 ${currentXp} → ${currentXp + numeric}${reason ? `\n💭 ${escapeLine(reason)}` : ''}`);
}

async function statsCommand(peerId, targetVkId) {
  const linked = await getLinkedUser(targetVkId);
  if (!linked) {
    await sendMessage(peerId, `⚠️ VK ${targetVkId} не привязан.`);
    return;
  }
  const stats = await getUserStats(linked.site_user_id, linked.email);
  const { data: reports } = await getSupabase()
    .from('reports')
    .select('id,status,xp')
    .eq('email', linked.email)
    .limit(200);
  const totalReports = reports?.length || 0;
  const pending = (reports || []).filter(r => r.status === 'На проверке').length;
  const accepted = (reports || []).filter(r => ['Принят', 'Принято', 'Одобрено'].includes(r.status)).length;
  const { data: xpRow } = await getSupabase()
    .from('user_stats')
    .select('report_xp')
    .eq('user_id', linked.site_user_id)
    .maybeSingle();
  const xp = Number(xpRow?.report_xp || 0);
  await sendMessage(peerId, [
    '📊 СТАТИСТИКА',
    '━━━━━━━━━━━━━━━━',
    `👤 ${escapeLine(stats?.nickname || linked.nickname || linked.email)}`,
    `📧 ${escapeLine(linked.email || stats?.email || '—')}`,
    `🆔 Site ID: ${linked.site_user_id}`,
    `⭐ XP: ${xp}`,
    `🧾 Отчётов: ${totalReports}`,
    `⏳ На проверке: ${pending}`,
    `✅ Принято: ${accepted}`,
  ].join('\n'));
}

async function handleModCommand(peerId, vkUserId, text) {
  const raw = cleanText(text);

  const reports = raw.match(/^\/(?:отчеты|отчёты|reports)(?:\s+(\d{1,2}))?$/i);
  if (reports) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчётов доступен владельцу или модератору.');
      return true;
    }
    await listPendingReports(peerId, Number(reports[1] || 5));
    return true;
  }

  const repInfo = raw.match(/^\/(?:репорт|report)\s+([^\s]+)$/i);
  if (repInfo) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчёта доступен владельцу или модератору.');
      return true;
    }
    await reportInfo(peerId, repInfo[1]);
    return true;
  }

  const accept = raw.match(/^\/(?:принять|accept)\s+([^\s]+)(?:\s+(-?\d+))?$/i);
  if (accept) {
    await updateReportStatus(peerId, vkUserId, accept[1], 'Принят', accept[2] == null ? null : Number(accept[2]));
    return true;
  }

  const decline = raw.match(/^\/(?:отклонить|reject)\s+([^\s]+)(?:\s+([\s\S]+))?$/i);
  if (decline) {
    await updateReportStatus(peerId, vkUserId, decline[1], 'Отклонено', null, decline[2] || '');
    return true;
  }

  const xpCmd = raw.match(/^\/xp\s+(\d{2,20})\s+([+-]?\d+)(?:\s+([\s\S]+))?$/i);
  if (xpCmd) {
    await changeUserXp(peerId, vkUserId, xpCmd[1], xpCmd[2], xpCmd[3] || '');
    return true;
  }

  const stat = raw.match(/^\/(?:стата|stats|статистика)\s+(\d{2,20})$/i);
  if (stat) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Статистика доступна владельцу или модератору.');
      return true;
    }
    await statsCommand(peerId, stat[1]);
    return true;
  }

  if (/^\/(?:модеры|mods)$/i.test(raw)) {
    await listModerators(peerId);
    return true;
  }

  const grant = raw.match(/^\/(?:модер|mod)\s+(?:выдать|дать|add)\s+(\d{2,20})$/i);
  if (grant) {
    await grantModerator(peerId, vkUserId, grant[1]);
    return true;
  }

  const revoke = raw.match(/^\/(?:модер|mod)\s+(?:снять|remove|del|delete)\s+(\d{2,20})$/i);
  if (revoke) {
    await revokeModerator(peerId, vkUserId, revoke[1]);
    return true;
  }

  const user = raw.match(/^\/(?:юзер|user|профиль)\s+(\d{2,20})$/i);
  if (user) {
    await userInfo(peerId, user[1]);
    return true;
  }

  const apps = raw.match(/^\/(?:заявки|apps)(?:\s+(\d{1,2}))?$/i);
  if (apps) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр заявок доступен только владельцу или модератору.');
      return true;
    }
    await listApplications(peerId, Number(apps[1] || 5));
    return true;
  }

  return false;
}

function helpText(vkUserId, peerId) {
  const groupLine = reportsPeerId()
    ? `📍 Группа отчётов: ${reportsPeerId()}${String(peerId) === reportsPeerId() ? ' ✅' : ''}`
    : '📍 Группа отчётов: не ограничена';

  return [
    '🤖 CH89 VK-БОТ',
    '━━━━━━━━━━━━━━━━',
    '',
    `🆔 Ваш VK ID: ${vkUserId}`,
    `💬 Текущий peer_id: ${peerId}`,
    groupLine,
    '',
    '🧾 ОТЧЁТЫ',
    '• /отчет — пошаговая сдача отчёта',
    `• /отчет работа | ${moscowDateIso()} | Норма | ссылка — быстрая сдача`,
    '• /отмена — отменить текущую форму',
    '',
    '👤 АККАУНТ',
    '• /id — показать VK ID',
    '• /помощь — это меню',
    '',
    '🛡 МОДЕРСКИЕ',
    '• /модеры — список модераторов',
    '• /юзер <vk_id> — карточка привязки',
    '• /стата <vk_id> — статистика пользователя',
    '• /отчёты [число] — отчёты на проверке',
    '• /репорт <id> — детали отчёта',
    '• /принять <id> [xp] — принять отчёт',
    '• /отклонить <id> [причина] — отклонить отчёт',
    '• /заявки [число] — последние заявки из таблицы',
    '',
    '🧠 DEEPSEEK AI',
    '• /ai <вопрос> — общий вопрос',
    '• /совет <ситуация> — совет модератору',
    '• /разбор <кейс> — разбор конфликта',
    '• /наказание <нарушение> — варианты меры',
    '• /шаблон <что ответить> — готовый текст',
    '• бот, <вопрос> — свободное общение в разрешённой группе',
    '',
    '👑 ВЛАДЕЛЕЦ',
    '• /group type staff — текущая беседа получает заявки',
    '• /group type reports — текущая беседа принимает отчёты',
    '• /group info · /groups · /group clear',
    '• /модер выдать <vk_id> · /модер снять <vk_id>',
    '• /xp <vk_id> +100 причина',
    '• /привязать <vk_id> <site_user_id> <email> <ник>',
    '',
    '⚙️ После успешной сдачи бот удаляет сообщения формы и оставляет только итог отчёта.',
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
    await sendMessage(peerId, `🆔 Ваш VK ID: ${vkUserId}\n💬 peer_id этого чата: ${peerId}`);
    return;
  }

  if (/^\/(?:help|помощь|commands|команды|start|старт)$/i.test(text)) {
    await sendMessage(peerId, helpText(vkUserId, peerId));
    return;
  }

  if (/^\/(?:ping|пинг)$/i.test(text)) {
    await sendMessage(peerId, `🏓 pong · ${moscowDateTime()}`);
    return;
  }

  if (await handleGroupCommand(peerId, vkUserId, text)) return;
  if (await handleAiCommand(peerId, vkUserId, text)) return;

  if (await adminLinkCommand(peerId, vkUserId, text)) return;
  if (await handleModCommand(peerId, vkUserId, text)) return;

  const session = await getSession(peerId, vkUserId);
  if (session) {
    await handleSession(peerId, vkUserId, message, session);
    return;
  }

  if (/^\/отч[её]т\b/i.test(text)) {
    const parsed = parseInlineReport(text);
    if (parsed) await startInlineReport(peerId, vkUserId, message, parsed);
    else await startReport(peerId, vkUserId, message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'ch89-vk-report-bot-vercel-v3-ai-staff', reportsPeerId: reportsPeerId() || null });
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

  if (payload.type === 'confirmation') {
    const confirmation = requireEnv('VK_CALLBACK_CONFIRMATION');
    res.status(200).send(confirmation);
    return;
  }

  if (!validateCallbackSecret(payload)) {
    res.status(403).send('bad secret');
    return;
  }

  try {
    if (payload.type === 'message_new') await handleMessageNew(payload);
  } catch (error) {
    console.error('VK callback handler error:', error);

    const message = getMessage(payload);
    if (message && message.peer_id) {
      try {
        await sendMessage(message.peer_id, `❌ Ошибка бота: ${error.message || error}`);
      } catch (sendError) {
        console.error('Failed to send VK error message:', sendError);
      }
    }
  }

  res.status(200).send('ok');
};
