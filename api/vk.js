const { createClient } = require('@supabase/supabase-js');

const SESSION_TTL_MS = 25 * 60 * 1000;
const REPORT_QUALITY = ['Норма', 'Перенорма', 'Натяг', 'Герой дня'];
const DEFAULT_VK_API_VERSION = '5.199';
const MAX_VK_MESSAGE = 3900;
const REPORT_COMMAND_RE = /^\/(?:отч[её]т|сдать|сдача)(?=\s|$)/i;
const HELP_COMMAND_RE = /^\/(?:help|хелп|помощь|commands|команды|start|старт)(?:\s+(.+))?$/i;
const ID_COMMAND_RE = /^\/(?:id|ид|айди|vkid|вкид|peer|пир)$/i;
const MUTE_COMMAND_RE = /^\/(?:мут|мьют|mute|замутить|молчанка)\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i;
const MUTE_USAGE_RE = /^\/(?:мут|мьют|mute|замутить|молчанка)(?:\s+[\s\S]*)?$/i;
const UNMUTE_COMMAND_RE = /^\/(?:размут|размьют|unmute)\s+(.+)$/i;
const BAN_COMMAND_RE = /^\/(?:бан|ban|забанить|кик)\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i;
const BAN_USAGE_RE = /^\/(?:бан|ban|забанить|кик)(?:\s+[\s\S]*)?$/i;

const AI_MAX_OUTPUT_CHARS = 650;
const RULE_TERMS = {
  'устное предупреждение': 'Предупреждение в устном формате от модератора/администратора, чтобы игрок обратил внимание на нарушение.',
  'предупреждение': 'Системное наказание со специальной ролью. Два обычных предупреждения заменяются на одно строгое.',
  'строгое предупреждение': 'Системное наказание со специальной ролью. Три строгих предупреждения заменяются на бан на 7 дней.',
  'мут': 'Блокировка доступа к текстовым каналам и возможности говорить в голосовых каналах на определенный срок.',
  'бан': 'Блокировка доступа к возможностям Discord-сервера на определенный срок.',
  'обнуление': 'Сброс статистики и баланса Discord-аккаунта.',
  'перманентная блокировка': 'Блокировка доступа к Discord-серверу навсегда.',
  'блокировка приватных комнат': 'Блокировка доступа к созданию приватных комнат Discord-сервера на срок.',
  'глобальная блокировка': 'Блокировка доступа ко всем Discord-серверам проекта на срок.',
};

const DISCORD_RULES = {
  '1.1': ['Общая информация', 'BLACK RUSSIA — мобильная игра с картой России, где пользователь выбирает роль и участвует в игровом процессе.', '—'],
  '1.2': ['Общая информация', 'Входя на Discord-сервер проекта, пользователь соглашается с правилами и обязан соблюдать их.', '—'],
  '1.3': ['Общая информация', 'Правила действуют на всех пользователей независимо от статуса.', '—'],
  '1.4': ['Общая информация', 'Правила могут изменяться ответственным лицом с уведомлением в новостном канале.', '—'],
  '1.5': ['Общая информация', 'Незнание правил не освобождает от ответственности.', '—'],
  '1.6': ['Общая информация', 'В зависимости от тяжести нарушения возможно дополнительное внутриигровое наказание.', '—'],
  '1.7': ['Общая информация', 'Руководство проекта, руководитель модераторов, заместители и главный администратор могут выдавать наказания на своё усмотрение, если действия вредят проекту.', '—'],
  '1.8': ['Общая информация', 'Правила могут распространяться на личные сообщения, если действия вредят проекту.', '—'],
  '2.1': ['Общие правила', 'Неадекватное поведение, завуалированные/саркастичные сообщения и действия для оскорбления, провокации или розжига конфликта.', 'Устное предупреждение / Предупреждение / Мут 90 минут / Бан 7-15 дней'],
  '2.2': ['Общие правила', 'Трансфер Discord-валюты между серверами проекта.', 'Перманентная блокировка / Обнуление'],
  '2.3': ['Общие правила', 'Реклама любого направления, кроме официальных ресурсов проекта. Реклама других игровых проектов и вещей за реальные средства — глобальная блокировка.', 'Мут 90 минут / Бан 7-15 дней / Перманентная блокировка / Глобальная блокировка'],
  '2.4': ['Общие правила', 'Возрастной, интимный, насильственный или шок-контент.', 'Мут 90 минут / Бан 7-15 дней / Перманентная блокировка'],
  '2.5': ['Общие правила', 'Распространение персональной информации пользователя без согласия.', 'Бан 7-15 дней / Перманентная блокировка'],
  '2.6': ['Общие правила', 'Попытки обмана пользователя или введения в заблуждение/замешательство.', 'Мут 90 минут / Бан 7-15 дней / Перманентная блокировка'],
  '2.7': ['Общие правила', 'Споры на тему политики и религии.', 'Устное предупреждение / Мут 90 минут / Бан 7-15 дней'],
  '2.8': ['Общие правила', 'Прямое или косвенное обсуждение продажи, передачи или обмена чего-либо за реальные деньги.', 'Бан 7-15 дней / Перманентная блокировка / Глобальная блокировка'],
  '2.9': ['Общие правила', 'Использование уязвимостей правил, багов систем и плагинов, дающих преимущества. Очевидная вина не снимается из-за “недостаточно расписанного” пункта.', 'Бан 7-15 дней / Перманентная блокировка / Глобальная блокировка / Обнуление'],
  '2.10': ['Общие правила', 'Вымогательство и попрошайничество в Discord-серверах проекта.', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '2.11': ['Общие правила', 'Деструктивные действия против проекта: неконструктивная критика, призывы покинуть проект, помеха развитию и другой негатив.', 'Бан 7-15 дней / Перманентная блокировка / Глобальная блокировка'],
  '2.12': ['Общие правила', 'Обход выданных или находящихся на рассмотрении наказаний.', 'Перманентная блокировка'],
  '2.13': ['Общие правила', 'Прямые или косвенные упоминания либо оскорбления родных пользователя.', 'Мут 90 минут / Бан 7-15 дней'],
  '2.14': ['Общие правила', 'Распространение сторонних файлов в любом формате.', 'Бан 7-15 дней / Перманентная блокировка / Глобальная блокировка'],
  '2.15': ['Общие правила', 'Пропаганда наркотиков, терроризма и иных вещей, нарушающих законы.', 'Перманентная блокировка / Глобальная блокировка'],
  '2.16': ['Общие правила', 'Расизм, сексизм, нацизм, запрещённые движения и дискриминация по различным признакам.', 'Устное предупреждение / Предупреждение / Мут 90 минут / Бан 7-15 дней'],
  '2.17': ['Общие правила', 'Помеха работе модерации или администрации проекта.', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '2.18': ['Общие правила', 'Провокация или побуждение пользователей к нарушению правил проекта.', 'Мут 90 минут / Бан 7-15 дней'],
  '2.19': ['Общие правила', 'Прямые или косвенные угрозы пользователям.', 'Мут 90 минут / Бан 7-15 дней'],
  '2.20': ['Общие правила', 'Многократное нарушение правил Discord-сервера: более пяти блокировок чатов или трёх строгих предупреждений за 7 дней.', 'Бан 7-15 дней / Перманентная блокировка'],
  '2.21': ['Общие правила', 'Создание приватных комнат с названиями, нарушающими правила Discord-серверов и проекта.', 'Бан создания приватных комнат 3-7 дней'],
  '3.1': ['Текстовые каналы', 'Флуд, спам и сообщения не по теме в каналах с определённым назначением.', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '3.2': ['Текстовые каналы', 'Упоминание пользователей в текстовых каналах без сопровождающего сообщения.', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '3.3': ['Текстовые каналы', 'Чрезмерное использование верхнего регистра (CapsLock).', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '3.4': ['Текстовые каналы', 'Злоупотребление знаками препинания и прочими символами.', 'Устное предупреждение / Предупреждение / Мут 90 минут'],
  '3.5': ['Текстовые каналы', 'Многократное упоминание пользователя.', 'Мут 90 минут'],
  '4.1': ['Голосовые каналы', 'Целенаправленное создание помехи общению пользователей любыми способами.', 'Устное предупреждение / Мут 90 минут'],
  '4.2': ['Голосовые каналы', 'Использование сторонних программ для воспроизведения звуков через микрофон.', 'Устное предупреждение / Мут 90 минут'],
  '4.3': ['Голосовые каналы', 'Использование неправильно настроенного микрофона с усилением, фоном или шипением.', 'Устное предупреждение / Мут 90 минут'],
  '4.4': ['Голосовые каналы', 'Использование программ для изменения голоса.', 'Устное предупреждение / Мут 90 минут'],
  '5.1': ['Учётные записи', 'Копирование чужих профилей.', 'Устное предупреждение / Предупреждение / Бан 7-15 дней / Перманентная блокировка'],
  '5.2': ['Учётные записи', 'Оскорбительные или провокационные никнеймы/оформления профиля.', 'Устное предупреждение / Бан 7-15 дней'],
  '5.3': ['Учётные записи', 'Использование в никнейме тегов и префиксов должностей без отношения к ним; на фракционные должности не распространяется.', 'Устное предупреждение / Предупреждение / Бан 7-15 дней'],
};

const MODERATOR_RULES = {
  'м1.01': 'Модератор — представитель Discord-сервера, помогает пользователям и следит за порядком.',
  'м1.02': 'Обязанности: контроль текстовых/голосовых каналов, модерация жалоб, помощь пользователям, повышение досуга.',
  'м1.03': 'Модератор имеет право на выходные с одобрения главного модератора/заместителя.',
  'м1.04': 'Система выговоров препятствует повышению и пребыванию в статусе модератора.',
  'м1.05': 'Выговор снимается решением главного модератора/заместителя по активности и объёму работы.',
  'м1.06': 'Модерация не запрашивает личные данные игроков; о таких запросах сообщать руководству.',
  'м1.07': 'Иерархия: младший модератор, модератор, старший модератор, куратор модерации, зам. главного модератора, главный модератор, куратор главных модераторов, зам. руководителя модераторов, руководитель модераторов.',
  'м2.01': 'Запрещено выдавать наказания по доказательствам из ЛС и т.п.',
  'м2.02': 'Запрещено снимать/заменять наказания другого модератора. Исключение: главный модератор, заместитель главного модератора и руководство проекта при наличии причины.',
  'м2.03': 'Все наказания выдаются строго по регламенту сервера.',
  'м2.04': 'Запрещено занимать должности на проектах со схожей тематикой.',
  'м2.05': 'Модератор обязан соблюдать субординацию с пользователями и коллегами.',
  'м2.06': 'Модератор обязан своевременно предоставлять руководству доказательства наказаний.',
  'м2.07': 'Запрещено показывать преимущество над пользователями.',
  'м2.08': 'Наказания выдаются беспристрастно.',
  'м2.09': 'Модератор может занимать должность только на одном сервере проекта.',
  'м2.10': 'Модератор обязан знать актуальные правила сервера.',
  'м2.11': 'Запрещено распространять информацию о деятельности модератора.',
  'м2.12': 'Если младший модератор ушёл/снят до достижения должности модератора, возможен ЧС модераторов до 90 дней.',
  'м2.13': 'Главный модератор отвечает за команду, может формировать состав, назначать и снимать по утрате доверия.',
};

const AI_RULE_CONTEXT = `
Контекст проекта: BLACK RUSSIA — мобильная role-play игра с картой России; Discord-сервер проекта регулируется правилами сообщества. Не путай Discord-модерацию с игровыми фракциями/мафиями/ОПГ. Не используй роли вроде «зам главы мафии», если пользователь сам не спрашивает про внутриигровую фракцию.

Термины наказаний:
${Object.entries(RULE_TERMS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Правила Discord:
${Object.entries(DISCORD_RULES).map(([num, r]) => `${num}. ${r[1]} Наказание: ${r[2]}`).join('\n')}

Правила модераторов:
${Object.entries(MODERATOR_RULES).map(([num, text]) => `${num}. ${text}`).join('\n')}
`;


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

const STAFF_ROLE_ALIASES = new Map([
  ['гм', 'gm'], ['gm', 'gm'], ['главный', 'gm'], ['владелец', 'gm'], ['owner', 'gm'],
  ['згм', 'zgm'], ['zgm', 'zgm'], ['замгм', 'zgm'], ['зам', 'zgm'], ['заместитель', 'zgm'],
  ['куратор', 'curator'], ['кур', 'curator'], ['curator', 'curator'],
  ['км', 'km'], ['km', 'km'], ['куратор модерации', 'km'],
  ['модер', 'moderator'], ['модератор', 'moderator'], ['mod', 'moderator'], ['moderator', 'moderator'],
]);

const STAFF_ROLE_TITLES = {
  gm: 'ГМ',
  zgm: 'ЗГМ',
  curator: 'Куратор',
  km: 'КМ',
  moderator: 'Модератор',
};

const STAFF_ROLE_RANK = {
  gm: 100,
  zgm: 80,
  curator: 70,
  km: 60,
  moderator: 30,
};

function normalizeStaffRole(value) {
  const raw = cleanText(value).toLowerCase().replace(/ё/g, 'е');
  return STAFF_ROLE_ALIASES.get(raw) || '';
}

function staffRoleTitle(role) {
  return STAFF_ROLE_TITLES[normalizeStaffRole(role) || role] || role || '—';
}

function staffRoleRank(role) {
  return STAFF_ROLE_RANK[normalizeStaffRole(role) || role] || 0;
}

async function getVkStaffRole(vkUserId) {
  if (isOwner(vkUserId)) return 'gm';
  const { data, error } = await getSupabase()
    .from('vk_staff_roles')
    .select('vk_user_id,role,title,note,updated_at')
    .eq('vk_user_id', String(vkUserId))
    .maybeSingle();

  if (error) {
    console.warn('getVkStaffRole failed:', error.message || error);
    return '';
  }
  return normalizeStaffRole(data?.role || '') || '';
}

async function hasStaffRank(vkUserId, minRole) {
  const role = await getVkStaffRole(vkUserId);
  return staffRoleRank(role) >= staffRoleRank(minRole);
}

async function canUseModActions(vkUserId) {
  return await hasStaffRank(vkUserId, 'moderator');
}

async function canManageSiteModerators(vkUserId) {
  // КМ и выше могут выдавать права модератора на сайте; ГМ всегда может всё.
  return await hasStaffRank(vkUserId, 'km');
}

async function canManageStaffRoles(vkUserId, targetRole = 'moderator') {
  const actorRole = await getVkStaffRole(vkUserId);
  if (actorRole === 'gm') return true;
  if (actorRole === 'zgm') return staffRoleRank(targetRole) < staffRoleRank('zgm');
  if (['curator', 'km'].includes(actorRole)) return normalizeStaffRole(targetRole) === 'moderator';
  return false;
}

async function actorRoleLine(vkUserId) {
  return `${staffRoleTitle(await getVkStaffRole(vkUserId))}`;
}

function normalizeGroupType(value) {
  const raw = cleanText(value).toLowerCase().replace(/ё/g, 'е');
  return new Map([
    ['reports', 'reports'], ['report', 'reports'], ['отчеты', 'reports'], ['отчет', 'reports'], ['репорты', 'reports'],
    ['staff', 'staff'], ['стафф', 'staff'], ['состав', 'staff'], ['модеры', 'staff'],
    ['general', 'general'], ['общая', 'general'], ['общий', 'general'], ['чат', 'general'],
    ['ai', 'ai'], ['ии', 'ai'], ['нейро', 'ai'],
    ['off', 'off'], ['выкл', 'off'], ['снять', 'off'], ['нет', 'off'],
  ]).get(raw) || '';
}

function allowedGroupTypes() {
  return new Set(['reports', 'staff', 'general', 'ai', 'off']);
}

function groupTypeTitle(type) {
  const normalized = normalizeGroupType(type) || type;
  return {
    reports: 'группа отчётов',
    staff: 'staff-группа',
    general: 'общая группа',
    ai: 'AI-чат',
    off: 'без типа',
  }[normalized] || normalized;
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
  const normalized = normalizeGroupType(groupType);
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
  if (configured && String(peerId) === String(configured)) return true;
  return (await getGroupType(peerId)) === 'reports';
}

async function reportPeerHelpText(peerId) {
  const configured = reportsPeerId();
  const type = await getGroupType(peerId).catch(() => '');
  return [
    '⛔ /отчет работает только в беседе отчётов.',
    `💬 Текущий peer_id: ${peerId}`,
    `🏷 Тип текущей группы: ${groupTypeTitle(type || 'off')}`,
    configured ? `📌 REPORTS_PEER_ID: ${configured}` : '',
    '',
    'Чтобы сдавать отчёты здесь, ГМ/владелец должен написать в этой беседе:',
    '/group type reports',
    '',
    'После этого команда заработает:',
    `/отчет Проверил жалобы | ${moscowDateIso()} | Норма | ссылка`,
  ].filter(Boolean).join('\n');
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

function parseVkIdFromText(value) {
  const raw = cleanText(value);
  if (!raw) return '';

  const bracket = raw.match(/\[id(\d+)\|[^\]]+\]/i);
  if (bracket) return bracket[1];

  const direct = raw.match(/^(?:@?id)?(\d{2,20})$/i);
  if (direct) return direct[1];

  const vkUrl = raw.match(/(?:https?:\/\/)?(?:m\.)?vk\.com\/(?:id)?([A-Za-z0-9_.]+)\/?/i);
  if (vkUrl && /^\d+$/.test(vkUrl[1])) return vkUrl[1];

  const mentionId = raw.match(/(?:^|\s)@id(\d{2,20})(?:\s|$)/i);
  if (mentionId) return mentionId[1];

  return '';
}

function parseVkScreenName(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  if (parseVkIdFromText(raw)) return '';

  const bracket = raw.match(/\[([a-zA-Z0-9_.]+)\|[^\]]+\]/i);
  if (bracket && !/^id\d+$/i.test(bracket[1])) return bracket[1];

  const url = raw.match(/(?:https?:\/\/)?(?:m\.)?vk\.com\/([A-Za-z0-9_.]+)\/?/i);
  if (url && !/^id\d+$/i.test(url[1])) return url[1];

  const at = raw.match(/^@([A-Za-z0-9_.]+)$/i);
  if (at && !/^id\d+$/i.test(at[1])) return at[1];

  return '';
}

async function resolveVkTarget(value) {
  const id = parseVkIdFromText(value);
  if (id) return id;

  const screen = parseVkScreenName(value);
  if (!screen) return '';

  try {
    const resolved = await vkApi('utils.resolveScreenName', { screen_name: screen });
    if (resolved && resolved.type === 'user' && resolved.object_id) return String(resolved.object_id);
  } catch (error) {
    console.warn('resolveVkTarget failed:', error.message || error);
  }
  return '';
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
}

async function findUserByAny(query) {
  const raw = cleanText(query);
  if (!raw) return { kind: 'empty', user: null, vkUserId: '' };

  if (looksLikeEmail(raw)) {
    return { kind: 'email', user: await findUserByEmail(raw), vkUserId: '' };
  }

  const vk = await resolveVkTarget(raw);
  if (vk) {
    const linked = await getLinkedUser(vk).catch(() => null);
    if (!linked) return { kind: 'vk', user: null, vkUserId: vk };
    const stats = await getUserStats(linked.site_user_id, linked.email).catch(() => null);
    return {
      kind: 'vk',
      vkUserId: vk,
      linked,
      user: {
        user_id: linked.site_user_id,
        email: linked.email || stats?.email || '',
        nickname: linked.nickname || stats?.nickname || '',
        role: stats?.role || '',
        report_xp: stats?.report_xp || 0,
      },
    };
  }

  const users = await findUsersByQuery(raw, 1).catch(() => []);
  return { kind: 'query', user: users[0] || null, vkUserId: '' };
}

function formatResolvedUser(found) {
  const u = found?.user;
  if (!u) return 'не найден';
  const parts = [];
  if (found.vkUserId) parts.push(`VK: ${found.vkUserId}`);
  if (u.nickname) parts.push(`ник: ${u.nickname}`);
  if (u.email) parts.push(`email: ${u.email}`);
  parts.push(`site: ${u.user_id}`);
  return parts.join(' · ');
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
  if (await canUseModActions(vkUserId)) return true;
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
  const body = cleanText(text).replace(REPORT_COMMAND_RE, '').trim();
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
    await sendMessage(peerId, await reportPeerHelpText(peerId));
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
    await sendMessage(peerId, await reportPeerHelpText(peerId));
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
  if (!(await canManageSiteModerators(vkUserId))) {
    await sendMessage(peerId, '⛔ Выдача/снятие модератора доступна КМ/Куратору/ЗГМ/ГМ.');
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
  if (!(await canManageSiteModerators(vkUserId))) {
    await sendMessage(peerId, '⛔ Выдача/снятие модератора доступна КМ/Куратору/ЗГМ/ГМ.');
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


async function grantModeratorByUser(peerId, vkUserId, user, label = '') {
  if (!(await canManageSiteModerators(vkUserId))) {
    await sendMessage(peerId, '⛔ Выдача/снятие модератора доступна КМ/Куратору/ЗГМ/ГМ.');
    return;
  }

  if (!user || !user.user_id) {
    await sendMessage(peerId, '⚠️ Пользователь не найден в user_stats. Он должен зарегистрироваться на сайте.');
    return;
  }

  const siteUserId = String(user.user_id);
  const nick = user.nickname || user.email || siteUserId;

  const { data: existing, error: selectError } = await getSupabase()
    .from('reports')
    .select('id')
    .eq('email', 'USER_ROLE')
    .eq('link', siteUserId)
    .eq('status', 'moderator')
    .limit(1);

  if (selectError) throw selectError;
  if (existing && existing.length) {
    await sendMessage(peerId, `ℹ️ Уже модератор: ${escapeLine(nick)}`);
    return;
  }

  const { error } = await getSupabase().from('reports').insert([{
    id: `role_mod_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    email: 'USER_ROLE',
    link: siteUserId,
    date: `Выдано через VK-бота · ${label || user.email || siteUserId} · ${moscowDateTime()}`,
    status: 'moderator',
    xp: 0,
  }]);

  if (error) throw error;
  await sendMessage(peerId, `✅ Статус модератора выдан\n👤 ${escapeLine(nick)}\n📧 ${escapeLine(user.email || '—')}\n🧩 ${siteUserId}`);
}

async function revokeModeratorByUser(peerId, vkUserId, user) {
  if (!(await canManageSiteModerators(vkUserId))) {
    await sendMessage(peerId, '⛔ Выдача/снятие модератора доступна КМ/Куратору/ЗГМ/ГМ.');
    return;
  }

  if (!user || !user.user_id) {
    await sendMessage(peerId, '⚠️ Пользователь не найден.');
    return;
  }

  const { error } = await getSupabase()
    .from('reports')
    .delete()
    .eq('email', 'USER_ROLE')
    .eq('link', String(user.user_id))
    .eq('status', 'moderator');

  if (error) throw error;
  await sendMessage(peerId, `🧹 Статус модератора снят\n👤 ${escapeLine(user.nickname || user.email || user.user_id)}\n📧 ${escapeLine(user.email || '—')}`);
}

async function grantModeratorByEmail(peerId, vkUserId, email) {
  const user = await findUserByEmail(email);
  if (!user) {
    await sendMessage(peerId, `⚠️ Email не найден в user_stats: ${escapeLine(email)}\nПользователь должен зарегистрироваться на сайте.`);
    return;
  }
  await grantModeratorByUser(peerId, vkUserId, user, `email ${email}`);
}

async function revokeModeratorByEmail(peerId, vkUserId, email) {
  const user = await findUserByEmail(email);
  if (!user) {
    await sendMessage(peerId, `⚠️ Email не найден: ${escapeLine(email)}`);
    return;
  }
  await revokeModeratorByUser(peerId, vkUserId, user);
}

async function linkByEmailCommand(peerId, vkUserId, targetVkId, email, nickname = '') {
  if (!isOwner(vkUserId)) {
    await sendMessage(peerId, ownerOnlyText());
    return;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    await sendMessage(peerId, `⚠️ Email не найден в user_stats: ${escapeLine(email)}`);
    return;
  }

  const { error } = await getSupabase().from('vk_links').upsert({
    vk_user_id: String(targetVkId),
    site_user_id: String(user.user_id),
    email: user.email || email,
    nickname: cleanText(nickname || user.nickname || ''),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vk_user_id' });

  if (error) throw error;
  await sendMessage(peerId, `✅ VK привязан к email\n🆔 VK: ${targetVkId}\n📧 ${escapeLine(user.email || email)}\n👤 ${escapeLine(nickname || user.nickname || '—')}`);
}

async function searchUsersCommand(peerId, query) {
  const users = await findUsersByQuery(query, 10);
  if (!users.length) {
    await sendMessage(peerId, `📭 Не нашёл пользователей по запросу: ${escapeLine(query)}`);
    return;
  }
  await sendMessage(peerId, `🔎 ПОЛЬЗОВАТЕЛИ\n\n${users.map(u => `• ${escapeLine(u.nickname || 'без ника')} · ${escapeLine(u.email || 'без email')}\n  ID: ${u.user_id}\n  Роль: ${u.role || 'player'} · XP: ${u.report_xp || 0}`).join('\n\n')}`);
}

async function listReports(peerId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 5, 1), 20);
  let query = getSupabase()
    .from('reports')
    .select('*')
    .not('email', 'eq', 'USER_ROLE')
    .limit(limit);

  if (options.status) query = query.eq('status', options.status);
  if (options.email) query = query.eq('email', options.email);

  const { data, error } = await query;
  if (error) throw error;
  if (!data || !data.length) {
    await sendMessage(peerId, '📭 Отчётов не найдено.');
    return;
  }

  const title = options.email
    ? `🧾 ОТЧЁТЫ: ${options.email}`
    : options.status
      ? `🧾 ОТЧЁТЫ: ${options.status}`
      : '🧾 ВСЕ ОТЧЁТЫ';

  await sendMessage(peerId, `${title}\n\n${data.map(formatReportRow).join('\n\n────────\n\n')}`);
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


function stripAiMarkdown(text) {
  return cleanText(text)
    .replace(/```[\s\S]*?```/g, block => block.replace(/```/g, ''))
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactAiAnswer(text) {
  let out = stripAiMarkdown(text);
  const max = Number(env('AI_MAX_OUTPUT_CHARS', String(AI_MAX_OUTPUT_CHARS))) || AI_MAX_OUTPUT_CHARS;
  if (out.length > max) out = out.slice(0, max - 25).trimEnd() + '\n…сократил ответ.';
  return out;
}

function normalizeRuleNumber(value) {
  return cleanText(value).toLowerCase().replace(',', '.').replace(/^m/, 'м');
}

function formatRuleByNumber(number) {
  const key = normalizeRuleNumber(number);
  const rule = DISCORD_RULES[key];
  if (rule) {
    return [
      `📘 Правило ${key}`,
      `Раздел: ${rule[0]}`,
      `Суть: ${rule[1]}`,
      `Мера: ${rule[2]}`,
    ].join('\n');
  }

  const modRule = MODERATOR_RULES[key] || MODERATOR_RULES[`м${key}`];
  if (modRule) {
    return [
      `📗 Правило модераторов ${key.startsWith('м') ? key : `м${key}`}`,
      `Суть: ${modRule}`,
    ].join('\n');
  }

  return '';
}

function findRulesByText(query, limit = 5) {
  const q = cleanText(query).toLowerCase();
  if (!q) return [];
  const hay = [];
  for (const [num, r] of Object.entries(DISCORD_RULES)) {
    hay.push({ num, text: `${r[0]} ${r[1]} ${r[2]}`, formatted: formatRuleByNumber(num) });
  }
  for (const [num, text] of Object.entries(MODERATOR_RULES)) {
    hay.push({ num, text, formatted: formatRuleByNumber(num) });
  }
  return hay.filter(x => x.text.toLowerCase().includes(q)).slice(0, limit);
}

function formatTerm(term) {
  const q = cleanText(term).toLowerCase();
  if (!q) return '';
  const exact = RULE_TERMS[q];
  if (exact) return `📙 ${q}\n${exact}`;
  const found = Object.entries(RULE_TERMS).find(([k]) => k.includes(q) || q.includes(k));
  if (!found) return '';
  return `📙 ${found[0]}\n${found[1]}`;
}

async function findUserByEmail(email) {
  const value = cleanText(email).toLowerCase();
  if (!value) return null;

  let result = await getSupabase()
    .from('user_stats')
    .select('user_id,nickname,email,role,report_xp,mod_correct,sup_correct,shop_spent,ap_spent')
    .eq('email', value)
    .maybeSingle();

  if (!result.error && result.data) return result.data;

  result = await getSupabase()
    .from('user_stats')
    .select('user_id,nickname,email,role,report_xp,mod_correct,sup_correct,shop_spent,ap_spent')
    .ilike('email', value)
    .maybeSingle();

  if (!result.error && result.data) return result.data;
  return null;
}

async function findUsersByQuery(query, limit = 8) {
  const q = cleanText(query);
  if (!q) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 15);
  const { data, error } = await getSupabase()
    .from('user_stats')
    .select('user_id,nickname,email,role,report_xp,mod_correct,sup_correct')
    .or(`email.ilike.%${q}%,nickname.ilike.%${q}%`)
    .limit(safeLimit);

  if (error) throw error;
  return data || [];
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

function googleSheetPullUrl() {
  return env('GOOGLE_APPS_SCRIPT_URL') || env('GOOGLE_SHEET_PULL_URL') || env('GOOGLE_SHEET_WEB_APP_URL');
}

function googleSheetPullSecret() {
  return env('GOOGLE_SHEET_PULL_SECRET') || env('GOOGLE_SHEET_WEBHOOK_SECRET') || env('TABLE_WEBHOOK_SECRET');
}

async function fetchGoogleSheetData(mode = 'pending', limit = 5) {
  const url = googleSheetPullUrl();
  if (!url) return null;

  const u = new URL(url);
  u.searchParams.set('mode', mode);
  if (mode === 'pending') u.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 5, 1), 25)));
  const secret = googleSheetPullSecret();
  if (secret) u.searchParams.set('secret', secret);

  const response = await fetch(u.toString(), { method: 'GET' });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text || '{}'); } catch (_) { data = { ok: false, error: text.slice(0, 400) }; }

  if (data && data.service === 'ch89-google-sheet-webhook-v6') {
    throw new Error('В GOOGLE_APPS_SCRIPT_URL стоит Vercel webhook, а нужен URL Google Apps Script Web App: https://script.google.com/macros/s/.../exec');
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || data.message || `Google Apps Script HTTP ${response.status}`);
  }
  return data;
}

async function fetchPendingGoogleSheetApplications(limit = 5) {
  return fetchGoogleSheetData('pending', limit);
}

async function googleSheetDebugCommand(peerId) {
  try {
    const url = googleSheetPullUrl();
    if (!url) {
      await sendMessage(peerId, '⚠️ GOOGLE_APPS_SCRIPT_URL не задан в Vercel.');
      return;
    }

    let data;
    let fallbackNote = '';
    try {
      data = await fetchGoogleSheetData('debug', 1);
    } catch (error) {
      if (!/unknown mode/i.test(String(error.message || error))) throw error;
      fallbackNote = '⚠️ Apps Script старой версии: mode=debug не поддерживается. Показываю проверку через /заявки.';
      data = await fetchGoogleSheetData('pending', 5);
    }

    if (!data) {
      await sendMessage(peerId, '⚠️ Google Sheet не настроен.');
      return;
    }

    if (data.service && /pending/i.test(data.service)) {
      const items = Array.isArray(data.items) ? data.items : [];
      const headers = Array.isArray(data.headers) ? data.headers : [];
      const verdictHeader = headers.find(h => /вердикт|решение|status|статус/i.test(String(h))) || '';
      await sendMessage(peerId, [
        '🧪 GOOGLE SHEET CHECK',
        fallbackNote,
        `📄 Лист: ${escapeLine(data.sheetName || '—')}`,
        `📋 Заявок без вердикта: ${items.length}`,
        `⚖️ Колонка вердикта: ${escapeLine(verdictHeader || 'не видно в старом debug')}`,
        '',
        items.length
          ? `Последняя открытая строка: #${escapeLine(items[0].rowNumber || '—')}`
          : 'Открытых строк не найдено.',
        '',
        'Чтобы включить полный debug: Apps Script → Управление развертываниями → изменить → Версия: новая → Развернуть.',
      ].filter(Boolean).join('\n'));
      return;
    }

    const recent = Array.isArray(data.recentRows) ? data.recentRows.slice(-5) : [];
    const lines = [
      '🧪 GOOGLE SHEET DEBUG',
      fallbackNote,
      `📄 Лист: ${escapeLine(data.activeSheet || '—')}`,
      `📊 Строк: ${data.lastRow || 0}, колонок: ${data.lastColumn || 0}`,
      `⚖️ Вердикт: ${escapeLine(data.verdictHeader || 'не найден')}`,
      `💬 Причина: ${escapeLine(data.reasonHeader || 'не найдена')}`,
      '',
      'Последние строки:',
      ...(recent.length ? recent.map(r => `#${r.rowNumber}: verdict="${escapeLine(r.verdict || '')}" pending=${r.pending ? 'да' : 'нет'}`) : ['—']),
    ];

    await sendMessage(peerId, lines.join('\n'));
  } catch (error) {
    await sendMessage(peerId, `⚠️ Google debug ошибка: ${escapeLine(error.message || error)}`);
  }
}

function firstNonEmpty(named, patterns) {
  const entries = Object.entries(named || {});
  for (const pattern of patterns) {
    const found = entries.find(([key, value]) => pattern.test(String(key).toLowerCase()) && cleanText(value));
    if (found) return cleanText(found[1]);
  }
  return '';
}

function formatGooglePendingApplication(item) {
  const named = item.namedValues || item.row || {};
  const nick = firstNonEmpty(named, [/nick|ник|game|игров/]);
  const nameAge = firstNonEmpty(named, [/имя|возраст|name|age/]);
  const email = firstNonEmpty(named, [/почт|email|mail/]);
  const vk = firstNonEmpty(named, [/вконтакте|vk|вк/]);
  const forum = firstNonEmpty(named, [/форум|forum/]);
  const discord = firstNonEmpty(named, [/discord|дискорд/]);
  const tg = firstNonEmpty(named, [/telegram|телеграм/]);
  const post = firstNonEmpty(named, [/пост|занимаешь|должн|роль|сервер|организац/]);
  const reason = firstNonEmpty(named, [/почему|опыт|расскаж|причин|мотивац|about/]);

  const lines = [
    '📨 ЗАЯВКА БЕЗ ВЕРДИКТА',
    `#️⃣ Строка: ${escapeLine(item.rowNumber || '—')}`,
  ];

  if (nick) lines.push(`🎮 Ник: ${escapeLine(nick)}`);
  if (nameAge) lines.push(`👤 Имя/возраст: ${escapeLine(nameAge)}`);
  if (email) lines.push(`📧 Почта: ${escapeLine(email)}`);
  if (vk) lines.push(`🔗 VK: ${escapeLine(vk)}`);
  if (forum) lines.push(`📝 Форум: ${escapeLine(forum)}`);
  if (discord) lines.push(`💬 Discord: ${escapeLine(discord)}`);
  if (tg) lines.push(`✈️ TG: ${escapeLine(tg)}`);
  if (post) lines.push(`🏷 Данные: ${escapeLine(post)}`);
  if (reason) lines.push(`💭 Ответ: ${escapeLine(reason)}`);

  const verdict = cleanText(item.verdictValue || (Array.isArray(item.lastTwoValues) ? item.lastTwoValues.map(cleanText).filter(Boolean).join(' | ') : ''));
  lines.push(`⚖️ Вердикт: ${verdict || 'нет'}`);
  return lines.join('\n');
}

async function listApplications(peerId, limit = 5) {
  const count = Math.min(Math.max(Number(limit) || 5, 1), 10);

  try {
    const googleData = await fetchPendingGoogleSheetApplications(count);
    if (googleData) {
      const items = Array.isArray(googleData.items) ? googleData.items : [];
      if (!items.length) {
        await sendMessage(peerId, `📭 В Google Sheets нет заявок без вердикта.\nЛист: ${escapeLine(googleData.sheetName || '—')}`);
        return;
      }

      await sendMessage(peerId, [
        `📋 ЗАЯВКИ БЕЗ ВЕРДИКТА: ${items.length}`,
        `📄 Лист: ${escapeLine(googleData.sheetName || '—')}`,
        '',
        items.map(formatGooglePendingApplication).join('\n\n────────────\n\n'),
      ].join('\n'));
      return;
    }
  } catch (error) {
    await sendMessage(peerId, `⚠️ Google Sheets не ответил: ${escapeLine(error.message || error)}\nПоказываю заявки из Supabase.`);
  }

  const emails = env('APPLICATION_REPORT_EMAILS', 'GOSS_PROFILE,MOD_APPLICATION,APPLICATION,INACTIVE_REQ')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  let query = getSupabase().from('reports').select('*').order('id', { ascending: false }).limit(count);
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
    return 'DeepSeek не настроен. Добавь DEEPSEEK_API_KEY в Vercel и сделай Redeploy.';
  }

  const baseUrl = env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = env('DEEPSEEK_MODEL', 'deepseek-chat');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env('DEEPSEEK_TIMEOUT_MS', '16000')) || 16000);

  const system = [
    'Ты короткий AI-помощник Discord-модерации BLACK RUSSIA / CH89.',
    'Отвечай строго по-русски и очень кратко: максимум 3-4 короткие строки.',
    'Не используй Markdown: без **, заголовков #, таблиц и длинных списков.',
    'Формат ответа: решение → пункт правил → действие. Без длинных объяснений.',
    'Не выдумывай игровые должности и фракционные роли. Если речь о Discord-модерации — не пиши про мафию, ОПГ, заместителей фракций и т.п.',
    'Если фактов недостаточно — напиши, какие 1-2 факта проверить.',
    'Всегда опирайся на правила ниже. Если подходящего пункта нет, прямо скажи: “точного пункта нет, нужно решение руководства”.',
    AI_RULE_CONTEXT,
  ].join('\n');

  const modeHint = {
    ai: 'Ответь коротко по теме модерации. Если вопрос не про модерацию, отвечай обычным кратким сообщением.',
    advice: 'Дай краткий совет модератору: что проверить и что сделать.',
    punishment: 'Определи наиболее близкий пункт правил и меру наказания. Не назначай наказание окончательно без доказательств.',
    template: 'Дай короткий готовый ответ игроку/кандидату без Markdown.',
    analyze: 'Разбери кейс в 3-5 строк: факт, правило, риск, действие.',
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
        temperature: Number(env('DEEPSEEK_TEMPERATURE', '0.2')),
        max_tokens: Number(env('DEEPSEEK_MAX_TOKENS', '220')),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `${modeHint}\n\npeer_id=${context.peerId || '—'}, vk_id=${context.vkUserId || '—'}\n\nЗапрос: ${question}` },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const details = data?.error?.message || data?.message || `HTTP ${response.status}`;
      if (/invalid|authentication|api key|unauthorized/i.test(details)) {
        return 'DeepSeek API key невалидный. Проверь DEEPSEEK_API_KEY в Vercel и сделай Redeploy.';
      }
      return `DeepSeek ошибка: ${details}`;
    }

    const answer = data?.choices?.[0]?.message?.content || '';
    return compactAiAnswer(answer) || 'DeepSeek вернул пустой ответ.';
  } catch (error) {
    if (error.name === 'AbortError') return 'DeepSeek не успел ответить. Сократи запрос.';
    return `DeepSeek недоступен: ${error.message || error}`;
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
    advice: '🧭 Совет',
    analyze: '🔎 Разбор',
    punishment: '⚖️ Наказание',
    template: '📝 Шаблон',
    ai: '💬 Ответ',
  }[mode] || '💬 Ответ';
  if (typing && cleanupEnabled()) await deleteMessagesBestEffort(peerId, [typing]);
  await sendMessage(peerId, `${title}
${compactAiAnswer(answer)}`);
  return true;
}

async function handleGroupCommand(peerId, vkUserId, text) {
  const raw = cleanText(text);
  if (!/^\/(?:group|группа|groups|группы)(?=\s|$)/i.test(raw)) return false;

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

  const type = raw.match(/^\/(?:group|группа)\s+(?:type|тип)\s+([^\s]+)$/i);
  if (type) {
    const requestedType = normalizeGroupType(type[1]);
    if (!requestedType) {
      await sendMessage(peerId, '⚠️ Тип группы не распознан. Варианты: reports/отчеты, staff/стафф, ai/ии, general/общая, off/выкл.');
      return true;
    }
    const normalized = await setGroupBinding(peerId, requestedType, vkUserId);
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
    '• /group type reports или /группа тип отчеты — сделать текущую беседу группой отчётов',
    '• /group type ai или /группа тип ии — разрешить AI-общение в этой беседе',
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


async function grantVkStaffRole(peerId, actorVkId, targetInput, roleInput, note = '') {
  const targetVkId = await resolveVkTarget(targetInput);
  const role = normalizeStaffRole(roleInput);

  if (!targetVkId) {
    await sendMessage(peerId, '⚠️ Не понял VK-пользователя. Пример: /роль @id123 Куратор');
    return;
  }
  if (!role) {
    await sendMessage(peerId, '⚠️ Роль: ГМ / ЗГМ / Куратор / КМ / Модератор');
    return;
  }
  if (role === 'gm' && !isOwner(actorVkId)) {
    await sendMessage(peerId, '⛔ ГМ может выдавать только владелец.');
    return;
  }
  if (!(await canManageStaffRoles(actorVkId, role))) {
    await sendMessage(peerId, '⛔ Недостаточно прав для выдачи этой роли.');
    return;
  }

  const { error } = await getSupabase().from('vk_staff_roles').upsert({
    vk_user_id: String(targetVkId),
    role,
    title: staffRoleTitle(role),
    note: cleanText(note),
    granted_by_vk_user_id: String(actorVkId),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vk_user_id' });
  if (error) throw error;

  await sendMessage(peerId, `✅ Роль выдана
👤 VK: ${targetVkId}
🏷 ${staffRoleTitle(role)}${note ? `
💭 ${escapeLine(note)}` : ''}`);
}

async function revokeVkStaffRole(peerId, actorVkId, targetInput) {
  const targetVkId = await resolveVkTarget(targetInput);
  if (!targetVkId) {
    await sendMessage(peerId, '⚠️ Не понял VK-пользователя. Пример: /роль снять @id123');
    return;
  }
  if (isOwner(targetVkId)) {
    await sendMessage(peerId, '⛔ Нельзя снять роль у владельца.');
    return;
  }
  const currentRole = await getVkStaffRole(targetVkId);
  if (!(await canManageStaffRoles(actorVkId, currentRole || 'moderator'))) {
    await sendMessage(peerId, '⛔ Недостаточно прав для снятия этой роли.');
    return;
  }
  const { error } = await getSupabase().from('vk_staff_roles').delete().eq('vk_user_id', String(targetVkId));
  if (error) throw error;
  await sendMessage(peerId, `🧹 Роль снята
👤 VK: ${targetVkId}`);
}

async function listVkStaffRoles(peerId) {
  const { data, error } = await getSupabase()
    .from('vk_staff_roles')
    .select('vk_user_id,role,title,note,updated_at')
    .order('role', { ascending: true })
    .limit(100);
  if (error) throw error;
  const lines = [`👑 ${ownerVkId()} — ГМ`];
  for (const row of data || []) {
    if (String(row.vk_user_id) === String(ownerVkId())) continue;
    lines.push(`• ${row.vk_user_id} — ${staffRoleTitle(row.role)}${row.note ? ` · ${escapeLine(row.note)}` : ''}`);
  }
  await sendMessage(peerId, `🛡 STAFF-РОЛИ\n${lines.join('\n')}`);
}

function parseDuration(value) {
  const raw = cleanText(value).toLowerCase();
  const m = raw.match(/^(\d{1,4})(м|мин|h|ч|д|d|day|days)?$/i);
  if (!m) return { raw, minutes: null };
  const n = Number(m[1]);
  const unit = m[2] || 'м';
  if (['ч', 'h'].includes(unit)) return { raw, minutes: n * 60 };
  if (['д', 'd', 'day', 'days'].includes(unit)) return { raw, minutes: n * 1440 };
  return { raw, minutes: n };
}


function durationSeconds(duration) {
  const minutes = Number(duration && duration.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.max(60, Math.floor(minutes * 60));
}

async function applyVkChatRestriction(peerId, targetVkId, action, duration = null) {
  if (!isGroupPeer(peerId)) {
    return { ok: false, skipped: true, message: 'не беседа VK' };
  }

  const params = {
    peer_id: String(peerId),
    member_ids: String(targetVkId),
    action,
  };

  const seconds = durationSeconds(duration);
  if (action === 'ro' && seconds) params.for = String(seconds);

  try {
    await vkApi('messages.changeConversationMemberRestrictions', params);
    return { ok: true, message: action === 'ro' ? 'VK-мут применён' : 'VK-мут снят' };
  } catch (error) {
    return { ok: false, message: error.message || String(error) };
  }
}

async function kickVkUserFromChat(peerId, targetVkId) {
  if (!isGroupPeer(peerId)) {
    return { ok: false, skipped: true, message: 'не беседа VK' };
  }
  try {
    const chatId = Number(peerId) - 2000000000;
    await vkApi('messages.removeChatUser', { chat_id: String(chatId), user_id: String(targetVkId) });
    return { ok: true, message: 'пользователь удалён из беседы' };
  } catch (error) {
    return { ok: false, message: error.message || String(error) };
  }
}

async function unmuteVkUser(peerId, actorVkId, targetInput) {
  if (!(await canUseModActions(actorVkId))) {
    await sendMessage(peerId, '⛔ Недостаточно прав.');
    return;
  }
  const targetVkId = await resolveVkTarget(targetInput);
  if (!targetVkId) {
    await sendMessage(peerId, '⚠️ Не понял пользователя. Пример: /размут @id123');
    return;
  }

  const apiResult = await applyVkChatRestriction(peerId, targetVkId, 'rw');

  await getSupabase()
    .from('vk_moderation_actions')
    .update({ status: 'cancelled', cancelled_by_vk_user_id: String(actorVkId), cancelled_at: new Date().toISOString() })
    .eq('target_vk_user_id', String(targetVkId))
    .eq('action_type', 'mute')
    .eq('status', 'active')
    .catch(() => null);

  await sendMessage(peerId, [
    '🔊 Размут',
    `👤 VK: ${targetVkId}`,
    apiResult.ok ? '✅ VK: писать разрешено' : `⚠️ VK: ${escapeLine(apiResult.message)}`,
  ].join('\n'));
}

async function createModerationAction(peerId, actorVkId, actionType, targetInput, durationText, reason = '') {
  if (!(await canUseModActions(actorVkId))) {
    const role = await actorRoleLine(actorVkId).catch(() => '—');
    await sendMessage(peerId, [
      '⛔ Нет прав на модерские команды.',
      `🛡 Ваша роль: ${role}`,
      'Нужна роль: Модератор / КМ / Куратор / ЗГМ / ГМ.',
      'ГМ может выдать роль: /роль @id123 Модератор',
    ].join('\n'));
    return;
  }
  const targetVkId = await resolveVkTarget(targetInput);
  if (!targetVkId) {
    await sendMessage(peerId, '⚠️ Не понял пользователя. Пример: /мут @id123 90м флуд');
    return;
  }
  const duration = parseDuration(durationText || '');
  const id = `act_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  let vkEffect = '';
  if (actionType === 'mute' && boolEnv('VK_USE_CHAT_RESTRICTIONS', true)) {
    const result = await applyVkChatRestriction(peerId, targetVkId, 'ro', duration);
    vkEffect = result.ok ? '✅ VK: писать запрещено' : `⚠️ VK-мут не применён: ${escapeLine(result.message)}`;
  }

  if (actionType === 'ban' && boolEnv('VK_AUTO_KICK_ON_BAN', true)) {
    const result = await kickVkUserFromChat(peerId, targetVkId);
    vkEffect = result.ok ? '✅ VK: пользователь удалён из беседы' : `⚠️ VK-бан не применён: ${escapeLine(result.message)}`;
  }

  let dbEffect = '✅ БД: наказание записано';
  const { error } = await getSupabase().from('vk_moderation_actions').insert([{
    id,
    peer_id: String(peerId),
    target_vk_user_id: String(targetVkId),
    actor_vk_user_id: String(actorVkId),
    action_type: actionType,
    duration_text: duration.raw || '',
    duration_minutes: duration.minutes,
    reason: cleanText(reason),
    status: 'active',
    created_at: new Date().toISOString(),
  }]);
  if (error) {
    dbEffect = `⚠️ БД: не записано (${escapeLine(error.message || error)})`;
  }

  const title = {
    oral_warn: 'Устное предупреждение',
    warn: 'Предупреждение',
    strict_warn: 'Строгое предупреждение',
    mute: 'Мут',
    ban: 'Бан',
    private_room_block: 'Блок приватных комнат',
    global_block: 'Глобальная блокировка',
    reset: 'Обнуление',
  }[actionType] || actionType;

  await sendMessage(peerId, [
    `✅ ${title}`,
    `👤 VK: ${targetVkId}`,
    duration.raw ? `⏱ Срок: ${duration.raw}` : '',
    reason ? `💭 Причина: ${escapeLine(reason)}` : '',
    vkEffect,
    dbEffect,
    `#️⃣ ${id}`,
  ].filter(Boolean).join('\n'));
}

async function listModerationActions(peerId, actorVkId, targetInput) {
  if (!(await canUseModActions(actorVkId))) {
    await sendMessage(peerId, '⛔ Недостаточно прав.');
    return;
  }
  const targetVkId = await resolveVkTarget(targetInput);
  if (!targetVkId) {
    await sendMessage(peerId, '⚠️ Не понял пользователя. Пример: /наказания @id123');
    return;
  }
  const { data, error } = await getSupabase()
    .from('vk_moderation_actions')
    .select('id,action_type,duration_text,reason,status,created_at,actor_vk_user_id')
    .eq('target_vk_user_id', String(targetVkId))
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  if (!data || !data.length) {
    await sendMessage(peerId, `📭 Наказаний по VK ${targetVkId} нет.`);
    return;
  }
  const lines = data.map(x => {
    const parts = [`#${x.id} · ${x.action_type} · ${x.status}`];
    if (x.duration_text) parts.push(`⏱ ${x.duration_text}`);
    if (x.reason) parts.push(`💭 ${escapeLine(x.reason)}`);
    parts.push(`👮 ${x.actor_vk_user_id}`);
    return parts.join('\n');
  });
  await sendMessage(peerId, `📋 НАКАЗАНИЯ VK ${targetVkId}\n\n${lines.join('\n\n')}`);
}

async function cancelModerationAction(peerId, actorVkId, actionId) {
  if (!(await canUseModActions(actorVkId))) {
    await sendMessage(peerId, '⛔ Недостаточно прав.');
    return;
  }
  const { error } = await getSupabase()
    .from('vk_moderation_actions')
    .update({ status: 'cancelled', cancelled_by_vk_user_id: String(actorVkId), cancelled_at: new Date().toISOString() })
    .eq('id', String(actionId));
  if (error) throw error;
  await sendMessage(peerId, `🧹 Наказание снято: ${actionId}`);
}

async function userInfoAny(peerId, query) {
  const found = await findUserByAny(query);
  if (!found.user) {
    await sendMessage(peerId, `⚠️ Пользователь не найден: ${escapeLine(query)}${found.vkUserId ? `
VK найден, но не привязан: ${found.vkUserId}` : ''}`);
    return;
  }
  const mod = await isModerator(found.user.user_id).catch(() => false);
  const staffRole = found.vkUserId ? await getVkStaffRole(found.vkUserId) : '';
  await sendMessage(peerId, [
    '👤 ПОЛЬЗОВАТЕЛЬ',
    found.vkUserId ? `🆔 VK: ${found.vkUserId}` : '',
    `👤 Ник: ${escapeLine(found.user.nickname || '—')}`,
    `📧 Email: ${escapeLine(found.user.email || '—')}`,
    `🧩 Site ID: ${found.user.user_id}`,
    `🏷 Сайт-роль: ${found.user.role || 'player'}`,
    staffRole ? `🛡 Staff: ${staffRoleTitle(staffRole)}` : '',
    `✅ Модератор сайта: ${mod ? 'да' : 'нет'}`,
  ].filter(Boolean).join('\n'));
}

function actionUsageText(action = 'mute') {
  const examples = {
    mute: [
      '⚠️ Формат мута',
      '━━━━━━━━━━━━━━━━',
      '• /мут @id123 90м флуд',
      '• /мут @id123 2ч оскорбления',
      '• /мут @id123 1д спам',
      '',
      'Алиасы: /мут, /мьют, /замутить, /mute',
      'Сроки: 30м, 2ч, 1д.',
    ],
    ban: [
      '⚠️ Формат бана',
      '━━━━━━━━━━━━━━━━',
      '• /бан @id123 7д причина',
      '',
      'Алиасы: /бан, /забанить, /кик, /ban',
    ],
  };
  return (examples[action] || examples.mute).join('\n');
}

async function sendModUsageOrNoAccess(peerId, vkUserId, action = 'mute') {
  if (!(await canUseModActions(vkUserId))) {
    const role = await actorRoleLine(vkUserId).catch(() => '—');
    await sendMessage(peerId, [
      '⛔ Нет прав на модерские команды.',
      `🛡 Ваша роль: ${role}`,
      'Нужна роль: Модератор / КМ / Куратор / ЗГМ / ГМ.',
    ].join('\n'));
    return;
  }
  await sendMessage(peerId, actionUsageText(action));
}

async function handleModCommand(peerId, vkUserId, text) {
  const raw = cleanText(text);

  if (/^\/(?:роли|roles|staff|состав|стафф)$/i.test(raw)) {
    if (!(await canUseModActions(vkUserId))) {
      await sendMessage(peerId, '⛔ Список ролей доступен staff-составу.');
      return true;
    }
    await listVkStaffRoles(peerId);
    return true;
  }

  const roleSet = raw.match(/^\/(?:роль|role|права|датьроль|staffrole)\s+(.+?)\s+(гм|gm|згм|zgm|куратор|curator|км|km|модер|модератор|mod)(?:\s+([\s\S]+))?$/i);
  if (roleSet) {
    await grantVkStaffRole(peerId, vkUserId, roleSet[1], roleSet[2], roleSet[3] || '');
    return true;
  }

  const roleClear = raw.match(/^\/(?:роль|role|права|датьроль|staffrole)\s+(?:снять|remove|del|delete|убрать)\s+(.+)$/i);
  if (roleClear) {
    await revokeVkStaffRole(peerId, vkUserId, roleClear[1]);
    return true;
  }

  const userAny = raw.match(/^\/(?:юзер|user|профиль|пользователь|инфо)\s+(.+)$/i);
  if (userAny && !/^(?:email|почта)\s+/i.test(userAny[1]) && !/^\d{2,20}$/.test(cleanText(userAny[1]))) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр пользователя доступен staff/модераторам.');
      return true;
    }
    await userInfoAny(peerId, userAny[1]);
    return true;
  }

  const statsAny = raw.match(/^\/(?:стата|stats|статистика|стат)\s+(.+)$/i);
  if (statsAny && !/^\d{2,20}$/.test(cleanText(statsAny[1]))) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Статистика доступна staff/модераторам.');
      return true;
    }
    const found = await findUserByAny(statsAny[1]);
    if (found.vkUserId) await statsCommand(peerId, found.vkUserId);
    else await userInfoAny(peerId, statsAny[1]);
    return true;
  }

  const xpAny = raw.match(/^\/xp\s+(\S+)\s+([+-]?\d+)(?:\s+([\s\S]+))?$/i);
  if (xpAny && !/^\d{2,20}$/.test(xpAny[1])) {
    const target = await resolveVkTarget(xpAny[1]);
    if (!target) await sendMessage(peerId, '⚠️ Не понял VK-пользователя. Пример: /xp @id123 +100 причина');
    else await changeUserXp(peerId, vkUserId, target, xpAny[2], xpAny[3] || '');
    return true;
  }

  const mute = raw.match(MUTE_COMMAND_RE);
  if (mute) {
    await createModerationAction(peerId, vkUserId, 'mute', mute[1], mute[2], mute[3] || '');
    return true;
  }

  if (MUTE_USAGE_RE.test(raw)) {
    await sendModUsageOrNoAccess(peerId, vkUserId, 'mute');
    return true;
  }

  const ban = raw.match(BAN_COMMAND_RE);
  if (ban) {
    await createModerationAction(peerId, vkUserId, 'ban', ban[1], ban[2], ban[3] || '');
    return true;
  }

  if (BAN_USAGE_RE.test(raw)) {
    await sendModUsageOrNoAccess(peerId, vkUserId, 'ban');
    return true;
  }

  const warn = raw.match(/^\/(?:пред|warn|предупреждение|варн)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (warn) {
    await createModerationAction(peerId, vkUserId, 'warn', warn[1], '', warn[2] || '');
    return true;
  }

  const oralWarn = raw.match(/^\/(?:устник|устное|oral|устпред)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (oralWarn) {
    await createModerationAction(peerId, vkUserId, 'oral_warn', oralWarn[1], '', oralWarn[2] || '');
    return true;
  }

  const strictWarn = raw.match(/^\/(?:строгий|строгач|strict|строг)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (strictWarn) {
    await createModerationAction(peerId, vkUserId, 'strict_warn', strictWarn[1], '', strictWarn[2] || '');
    return true;
  }

  const privBlock = raw.match(/^\/(?:приват|private)\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (privBlock) {
    await createModerationAction(peerId, vkUserId, 'private_room_block', privBlock[1], privBlock[2], privBlock[3] || '');
    return true;
  }

  const globalBlock = raw.match(/^\/(?:глобал|global)\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (globalBlock) {
    await createModerationAction(peerId, vkUserId, 'global_block', globalBlock[1], globalBlock[2], globalBlock[3] || '');
    return true;
  }

  const reset = raw.match(/^\/(?:обнулить|reset)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (reset) {
    await createModerationAction(peerId, vkUserId, 'reset', reset[1], '', reset[2] || '');
    return true;
  }

  const unmute = raw.match(UNMUTE_COMMAND_RE);
  if (unmute) {
    await unmuteVkUser(peerId, vkUserId, unmute[1]);
    return true;
  }

  const punishList = raw.match(/^\/(?:наказания|punishments|кары|муты)\s+(.+)$/i);
  if (punishList) {
    await listModerationActions(peerId, vkUserId, punishList[1]);
    return true;
  }

  const punishCancel = raw.match(/^\/(?:снятьнаказание|unpunish|снятькару)\s+(\S+)$/i);
  if (punishCancel) {
    await cancelModerationAction(peerId, vkUserId, punishCancel[1]);
    return true;
  }

  const ruleDirect = raw.match(/^\/(?:правило|rule)\s+([мm]?\d+[.,]\d+)$/i);
  if (ruleDirect) {
    const answer = formatRuleByNumber(ruleDirect[1]);
    await sendMessage(peerId, answer || `⚠️ Правило не найдено: ${escapeLine(ruleDirect[1])}`);
    return true;
  }

  const ruleSearch = raw.match(/^\/(?:правило|rule)\s+(.+)$/i);
  if (ruleSearch) {
    const found = findRulesByText(ruleSearch[1], 4);
    if (!found.length) await sendMessage(peerId, `📭 Ничего не найдено по правилам: ${escapeLine(ruleSearch[1])}`);
    else await sendMessage(peerId, `📘 НАЙДЕННЫЕ ПРАВИЛА\n\n${found.map(x => x.formatted).join('\n\n────────\n\n')}`);
    return true;
  }

  const term = raw.match(/^\/(?:термин|term)\s+(.+)$/i);
  if (term) {
    const answer = formatTerm(term[1]);
    await sendMessage(peerId, answer || `📭 Термин не найден: ${escapeLine(term[1])}`);
    return true;
  }

  const reportsAll = raw.match(/^\/(?:отчеты|отчёты|reports|репорты)\s+(?:все|all)(?:\s+(\d{1,2}))?$/i);
  if (reportsAll) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчётов доступен владельцу или модератору.');
      return true;
    }
    await listReports(peerId, { limit: Number(reportsAll[1] || 10) });
    return true;
  }

  const reportsByEmail = raw.match(/^\/(?:отчеты|отчёты|reports|репорты)\s+(?:email|почта|мыло)\s+([^\s]+)(?:\s+(\d{1,2}))?$/i);
  if (reportsByEmail) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчётов доступен владельцу или модератору.');
      return true;
    }
    await listReports(peerId, { email: reportsByEmail[1], limit: Number(reportsByEmail[2] || 10) });
    return true;
  }

  const reportsStatus = raw.match(/^\/(?:отчеты|отчёты|reports|репорты)\s+(?:статус|status)\s+([^|]+?)(?:\s+(\d{1,2}))?$/i);
  if (reportsStatus) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчётов доступен владельцу или модератору.');
      return true;
    }
    await listReports(peerId, { status: cleanText(reportsStatus[1]), limit: Number(reportsStatus[2] || 10) });
    return true;
  }

  const reports = raw.match(/^\/(?:отчеты|отчёты|reports|репорты)(?:\s+(\d{1,2}))?$/i);
  if (reports) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчётов доступен владельцу или модератору.');
      return true;
    }
    await listPendingReports(peerId, Number(reports[1] || 5));
    return true;
  }

  const repInfo = raw.match(/^\/(?:репорт|report|отчетинфо|отчётинфо)\s+([^\s]+)$/i);
  if (repInfo) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Просмотр отчёта доступен владельцу или модератору.');
      return true;
    }
    await reportInfo(peerId, repInfo[1]);
    return true;
  }

  const accept = raw.match(/^\/(?:принять|accept|одобрить)\s+([^\s]+)(?:\s+(-?\d+))?$/i);
  if (accept) {
    await updateReportStatus(peerId, vkUserId, accept[1], 'Принят', accept[2] == null ? null : Number(accept[2]));
    return true;
  }

  const decline = raw.match(/^\/(?:отклонить|reject|отказать)\s+([^\s]+)(?:\s+([\s\S]+))?$/i);
  if (decline) {
    await updateReportStatus(peerId, vkUserId, decline[1], 'Отклонено', null, decline[2] || '');
    return true;
  }

  const xpCmd = raw.match(/^\/xp\s+(\d{2,20})\s+([+-]?\d+)(?:\s+([\s\S]+))?$/i);
  if (xpCmd) {
    await changeUserXp(peerId, vkUserId, xpCmd[1], xpCmd[2], xpCmd[3] || '');
    return true;
  }

  const stat = raw.match(/^\/(?:стата|stats|статистика|стат)\s+(\d{2,20})$/i);
  if (stat) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Статистика доступна владельцу или модератору.');
      return true;
    }
    await statsCommand(peerId, stat[1]);
    return true;
  }

  const search = raw.match(/^\/(?:найти|search|users|поиск)\s+(.+)$/i);
  if (search) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Поиск пользователей доступен владельцу или модератору.');
      return true;
    }
    await searchUsersCommand(peerId, search[1]);
    return true;
  }

  if (/^\/(?:модеры|mods|модераторы)$/i.test(raw)) {
    await listModerators(peerId);
    return true;
  }

  const grantByEmail = raw.match(/^\/(?:модер|mod)\s+(?:выдать|дать|add|назначить)\s+(?:email|почта|мыло)\s+([^\s]+)$/i);
  if (grantByEmail) {
    await grantModeratorByEmail(peerId, vkUserId, grantByEmail[1]);
    return true;
  }

  const revokeByEmail = raw.match(/^\/(?:модер|mod)\s+(?:снять|remove|del|delete|убрать)\s+(?:email|почта|мыло)\s+([^\s]+)$/i);
  if (revokeByEmail) {
    await revokeModeratorByEmail(peerId, vkUserId, revokeByEmail[1]);
    return true;
  }

  const grantAny = raw.match(/^\/(?:модер|mod)\s+(?:выдать|дать|add|назначить)\s+(\S+)$/i);
  if (grantAny && !/^\d{2,20}$/.test(grantAny[1])) {
    const target = await resolveVkTarget(grantAny[1]);
    if (!target) await sendMessage(peerId, '⚠️ Не понял VK-пользователя. Пример: /модер выдать @id123');
    else await grantModerator(peerId, vkUserId, target);
    return true;
  }

  const grant = raw.match(/^\/(?:модер|mod)\s+(?:выдать|дать|add|назначить)\s+(\d{2,20})$/i);
  if (grant) {
    await grantModerator(peerId, vkUserId, grant[1]);
    return true;
  }

  const revokeAny = raw.match(/^\/(?:модер|mod)\s+(?:снять|remove|del|delete|убрать)\s+(\S+)$/i);
  if (revokeAny && !/^\d{2,20}$/.test(revokeAny[1])) {
    const target = await resolveVkTarget(revokeAny[1]);
    if (!target) await sendMessage(peerId, '⚠️ Не понял VK-пользователя. Пример: /модер снять @id123');
    else await revokeModerator(peerId, vkUserId, target);
    return true;
  }

  const revoke = raw.match(/^\/(?:модер|mod)\s+(?:снять|remove|del|delete|убрать)\s+(\d{2,20})$/i);
  if (revoke) {
    await revokeModerator(peerId, vkUserId, revoke[1]);
    return true;
  }

  const linkEmail = raw.match(/^\/(?:привязать|link)\s+(?:email|почта|мыло)\s+(\d{2,20})\s+([^\s]+)(?:\s+(.+))?$/i);
  if (linkEmail) {
    await linkByEmailCommand(peerId, vkUserId, linkEmail[1], linkEmail[2], linkEmail[3] || '');
    return true;
  }

  const userEmail = raw.match(/^\/(?:юзер|user|профиль|пользователь|инфо)\s+(?:email|почта|мыло)\s+([^\s]+)$/i);
  if (userEmail) {
    const user = await findUserByEmail(userEmail[1]);
    if (!user) await sendMessage(peerId, `⚠️ Email не найден: ${escapeLine(userEmail[1])}`);
    else await sendMessage(peerId, [
      '👤 ПОЛЬЗОВАТЕЛЬ',
      `👤 ${escapeLine(user.nickname || '—')}`,
      `📧 ${escapeLine(user.email || '—')}`,
      `🧩 ${user.user_id}`,
      `🏷 Роль: ${user.role || 'player'}`,
      `⭐ XP: ${user.report_xp || 0}`,
    ].join('\n'));
    return true;
  }

  const user = raw.match(/^\/(?:юзер|user|профиль|пользователь|инфо)\s+(\d{2,20})$/i);
  if (user) {
    await userInfo(peerId, user[1]);
    return true;
  }

  if (/^\/(?:gsheet|гугл|таблица|гшит|гтаблица)$/i.test(raw)) {
    if (!(await canUseStaffCommands(vkUserId, peerId))) {
      await sendMessage(peerId, '⛔ Google debug доступен только владельцу или модератору.');
      return true;
    }
    await googleSheetDebugCommand(peerId);
    return true;
  }

  const apps = raw.match(/^\/(?:заявки|apps|анкеты)(?:\s+(\d{1,2}))?$/i);
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

function normalizeHelpPage(value) {
  const raw = cleanText(value).toLowerCase().replace(/ё/g, 'е');
  if (!raw || ['меню', 'main', 'главная', '1'].includes(raw)) return 'main';
  if (['общие', 'общее', 'base', 'база'].includes(raw)) return 'base';
  if (['отчеты', 'отчет', 'репорты', 'reports', '2'].includes(raw)) return 'reports';
  if (['модер', 'модератор', 'км', 'moderator', 'mod', 'km', '3'].includes(raw)) return 'km';
  if (['наказания', 'мут', 'муты', 'бан', 'mute', 'ban', '4'].includes(raw)) return 'punish';
  if (['згм', 'куратор', 'zgm', 'curator', '5'].includes(raw)) return 'zgm';
  if (['гм', 'владелец', 'owner', 'gm', '6'].includes(raw)) return 'gm';
  if (['заявки', 'анкеты', 'apps', 'google', 'гугл', '7'].includes(raw)) return 'apps';
  if (['аи', 'ai', 'ии', 'нейро', '8'].includes(raw)) return 'ai';
  return raw;
}

async function helpText(vkUserId, peerId, pageInput = '') {
  const page = normalizeHelpPage(pageInput);
  const role = await getVkStaffRole(vkUserId).catch(() => '');
  const groupType = await getGroupType(peerId).catch(() => '');
  const configured = reportsPeerId();

  const header = [
    '🤖 CH89 BOT',
    '━━━━━━━━━━━━━━━━',
    `🆔 Ваш VK ID: ${vkUserId}`,
    `💬 peer_id: ${peerId}`,
    `🏷 Беседа: ${groupType ? groupTypeTitle(groupType) : 'тип не задан'}`,
    `🛡 Ваша роль: ${staffRoleTitle(role)}`,
  ];

  if (configured) header.push(`🧾 REPORTS_PEER_ID: ${configured}${String(peerId) === String(configured) ? ' ✅' : ''}`);

  const pages = {
    main: [
      ...header,
      '',
      '📚 Разделы help',
      '• /help общие — база, ID, правила',
      '• /help отчеты — сдача и проверка отчётов',
      '• /help км — команды модератора/КМ',
      '• /help наказания — мут, бан, преды',
      '• /help згм — роли и staff-права',
      '• /help гм — команды владельца',
      '• /help заявки — Google Sheets',
      '• /help ai — DeepSeek-помощник',
      '',
      'Быстрый старт:',
      '• /ид — узнать свой VK ID и peer_id',
      '• /отчет — сдать отчёт',
      '• /мут @id123 90м причина — выдать мут',
    ],
    base: [
      ...header,
      '',
      '👤 Общие команды',
      '• /help, /помощь, /команды — открыть меню',
      '• /ид, /id, /айди, /vkid — ваш VK ID и peer_id',
      '• /пинг, /ping — проверка, что бот живой',
      '• /правило 2.1 — показать пункт правил',
      '• /правило флуд — поиск по правилам',
      '• /термин мут — объяснение термина',
    ],
    reports: [
      ...header,
      '',
      '🧾 Отчёты модератора',
      '• /отчет, /отчёт, /сдать — открыть форму',
      `• /отчет работа | ${moscowDateIso()} | Норма | ссылка`,
      '• /отчет работа | Норма | ссылка — за сегодня',
      '• /отмена — отменить заполнение',
      '',
      'Важно:',
      '• команда работает в беседе отчётов',
      '• ГМ должен написать там: /group type reports',
      '• типы: Норма, Перенорма, Натяг, Герой дня',
    ],
    km: [
      ...header,
      '',
      '🛡 Модератор / КМ',
      '• /отчёты [5] — отчёты на проверке',
      '• /отчёты все 10 — последние отчёты',
      '• /отчёты почта mail@example.com — по почте',
      '• /репорт <id> — карточка отчёта',
      '• /принять <id> [xp] — принять отчёт',
      '• /отклонить <id> причина — отклонить',
      '• /юзер @id123 / email / ник — профиль',
      '• /стата @id123 — статистика',
      '• /найти ник/email — поиск пользователя',
    ],
    punish: [
      ...header,
      '',
      '⚖️ Наказания',
      '• /мут @id123 90м флуд',
      '• /мьют @id123 2ч оскорбления',
      '• /размут @id123',
      '• /бан @id123 7д реклама',
      '• /пред @id123 причина',
      '• /устник @id123 причина',
      '• /строгий @id123 причина',
      '• /приват @id123 3д причина',
      '• /глобал @id123 7д причина',
      '• /наказания @id123 — история',
      '',
      'Сроки: 30м, 2ч, 1д. Алиасы: /мут, /мьют, /замутить, /mute.',
    ],
    zgm: [
      ...header,
      '',
      '👑 ЗГМ / Куратор',
      '• /роль @id123 Модератор — выдать staff-роль',
      '• /роль @id123 КМ',
      '• /роль @id123 Куратор',
      '• /роль снять @id123',
      '• /роли — список staff',
      '• /модер выдать @id123 — права модератора сайта',
      '• /модер выдать почта mail@example.com',
      '• /модер снять @id123',
      '',
      'КМ/Куратор могут выдавать модератора, ЗГМ может управлять нижестоящими ролями.',
    ],
    gm: [
      ...header,
      '',
      '🔧 ГМ / владелец',
      '• /group type reports — беседа отчётов',
      '• /group type staff — staff-беседа для заявок',
      '• /group type ai — AI-беседа',
      '• /group info — тип текущей беседы',
      '• /groups — все привязанные беседы',
      '• /group clear — снять тип беседы',
      '• /роль @id123 ЗГМ / Куратор / КМ / Модератор',
      '• /привязать email <vk_id> <email> [ник]',
      '• /xp @id123 +100 причина',
    ],
    apps: [
      ...header,
      '',
      '📨 Заявки / Google Sheets',
      '• /заявки — показать заявки без вердикта',
      '• /заявки 10 — показать до 10 заявок',
      '• /gsheet, /гугл, /таблица — диагностика',
      '',
      'Бот ищет колонку “Вердикт”. Открытая заявка: пусто, “На рассмотрении”, “Ожидает”, pending.',
      'Для автосообщений нужна staff-беседа: /group type staff',
    ],
    ai: [
      ...header,
      '',
      '🧠 AI-помощник',
      '• /совет <ситуация>',
      '• /разбор <кейс>',
      '• /наказание <нарушение>',
      '• /шаблон <ответ>',
      '• бот, <вопрос>',
      '',
      'Ответы короткие: решение, пункт правил, действие.',
    ],
  };

  return (pages[page] || [
    ...header,
    '',
    `⚠️ Раздел не найден: ${escapeLine(pageInput)}`,
    'Доступно: /help, /help отчеты, /help км, /help наказания, /help згм, /help гм, /help заявки.',
  ]).join('\n');
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

  if (ID_COMMAND_RE.test(text)) {
    await sendMessage(peerId, `🆔 Ваш VK ID: ${vkUserId}\n💬 peer_id этого чата: ${peerId}`);
    return;
  }

  const help = text.match(HELP_COMMAND_RE);
  if (help) {
    await sendMessage(peerId, await helpText(vkUserId, peerId, help[1] || ''));
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

  if (REPORT_COMMAND_RE.test(text)) {
    const parsed = parseInlineReport(text);
    if (parsed) await startInlineReport(peerId, vkUserId, message, parsed);
    else await startReport(peerId, vkUserId, message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'ch89-vk-report-bot-vercel-v4-ai-rules', reportsPeerId: reportsPeerId() || null });
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
