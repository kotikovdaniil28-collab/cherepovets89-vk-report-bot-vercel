/**
 * CH89 Google Sheets bridge v8.
 *
 * Надёжный режим:
 * - /заявки в VK-боте сам тянет строки из Google Sheet.
 * - Заявка считается открытой, если колонка "Вердикт" пустая или равна "На рассмотрении".
 * - Если колонка "Вердикт" не найдена, используется fallback: первый из последних двух столбцов.
 * - Авто-отправка onFormSubmit тоже есть, но /заявки — основной способ.
 *
 * Установка:
 * 1) Вставь код именно в Apps Script этой Google-таблицы.
 * 2) Поставь CH89_WEBHOOK_URL и CH89_PULL_SECRET.
 * 3) Deploy → New deployment → Web app.
 * 4) Execute as: Me.
 * 5) Who has access: Anyone with the link.
 * 6) Web App URL вставь в Vercel как GOOGLE_APPS_SCRIPT_URL.
 */

const CH89_WEBHOOK_URL = 'https://cherepovets89-vk-report-bot-vercel.vercel.app/api/google-sheet-webhook?secret=ch89forms2026';
const CH89_PULL_SECRET = 'ch89pull2026';

// Можно оставить пустым: тогда скрипт сам найдёт лист с названием, где есть "ответы" и "форм".
const CH89_TARGET_SHEET_NAME = 'Ответы на форму (3)';
const CH89_FALLBACK_SHEET_NAMES = ['Ответы на форму (3)', 'Ответы на формы (3)', 'Form Responses 1'];
const CH89_STAFF_SHEET_NAME = 'Discord состав';
const CH89_STAFF_FALLBACK_SHEET_NAMES = ['Discord состав', 'VK состав', 'Состав'];

const CH89_DEFAULT_LIMIT = 10;
const CH89_SCAN_LIMIT = 700;

function clean_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function low_(value) {
  return clean_(value).toLowerCase();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJsonBody_(e) {
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { _parseError: String(error), raw };
  }
}

function formulaString_(value) {
  return String(value == null ? '' : value).replace(/"/g, '""');
}

function hyperlinkFormula_(url, label) {
  const cleanUrl = clean_(url);
  if (!cleanUrl) return '';
  return `=HYPERLINK("${formulaString_(cleanUrl)}","${formulaString_(label || cleanUrl)}")`;
}

function parseRuDate_(value) {
  const raw = clean_(value);
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function getParam_(e, name, fallback) {
  return e && e.parameter && e.parameter[name] != null ? String(e.parameter[name]) : fallback;
}

function findAutoSheet_(ss) {
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    const name = low_(sheet.getName());
    if ((name.includes('ответы') && name.includes('форм')) || name.includes('form responses')) {
      return sheet;
    }
  }
  return ss.getActiveSheet();
}

function getTargetSheet_(nameFromRequest) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidates = [];
  if (nameFromRequest) candidates.push(nameFromRequest);
  if (CH89_TARGET_SHEET_NAME) candidates.push(CH89_TARGET_SHEET_NAME);
  candidates.push.apply(candidates, CH89_FALLBACK_SHEET_NAMES);

  for (const name of candidates) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }

  return findAutoSheet_(ss);
}

function getStaffSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidates = [CH89_STAFF_SHEET_NAME].concat(CH89_STAFF_FALLBACK_SHEET_NAMES);
  for (const name of candidates) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return ss.insertSheet(CH89_STAFF_SHEET_NAME);
}

function headersFor_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map((header, index) => clean_(header) || `Поле ${index + 1}`);
}

function rowHasAnyData_(row) {
  return row.some(value => clean_(value) !== '');
}

function findHeaderIndex_(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    const h = low_(headers[i]);
    if (patterns.some(pattern => pattern.test(h))) return i;
  }
  return -1;
}

function verdictIndex_(headers) {
  return findHeaderIndex_(headers, [/^вердикт$/, /вердикт/, /решение/, /status/, /статус/]);
}

function reasonIndex_(headers) {
  return findHeaderIndex_(headers, [/причин.*отказ/, /отказ/, /коммент/, /reason/]);
}

function lastTwoValues_(row) {
  const start = Math.max(row.length - 2, 0);
  return row.slice(start).map(clean_);
}

function verdictValue_(headers, row) {
  const vi = verdictIndex_(headers);
  if (vi >= 0) return clean_(row[vi]);

  // fallback: если колонки "Вердикт" нет, считаем вердиктом первый из последних двух столбцов
  const tail = lastTwoValues_(row);
  return clean_(tail[0] || '');
}

function reasonValue_(headers, row) {
  const ri = reasonIndex_(headers);
  if (ri >= 0) return clean_(row[ri]);
  const tail = lastTwoValues_(row);
  return clean_(tail[1] || '');
}

function isPendingVerdictValue_(value) {
  const v = low_(value);
  if (!v) return true;
  if (['-', '—', 'нет', 'none', 'null'].includes(v)) return true;
  if (v.includes('на рассмотр')) return true;
  if (v.includes('ожида')) return true;
  if (v.includes('pending')) return true;
  return false;
}

function isPendingByVerdict_(headers, row) {
  return isPendingVerdictValue_(verdictValue_(headers, row));
}

function buildNamedValues_(headers, row) {
  const namedValues = {};
  headers.forEach((header, index) => {
    namedValues[header] = row[index] == null ? '' : row[index];
  });
  return namedValues;
}

function buildRowPayload_(sheet, rowNumber, headers, row) {
  const vi = verdictIndex_(headers);
  const ri = reasonIndex_(headers);
  return {
    source: 'google_sheet_pending_pull_v8',
    sheetName: sheet.getName(),
    rowNumber,
    headers,
    values: row,
    namedValues: buildNamedValues_(headers, row),
    verdictColumn: vi >= 0 ? headers[vi] : 'fallback:last_two:first',
    reasonColumn: ri >= 0 ? headers[ri] : 'fallback:last_two:second',
    verdictValue: verdictValue_(headers, row),
    reasonValue: reasonValue_(headers, row),
    lastTwoValues: lastTwoValues_(row),
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    pulledAt: new Date().toISOString(),
  };
}

function findFirstEmptyStaffRow_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const lastColumn = Math.max(sheet.getLastColumn(), 15);
  const values = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), lastColumn).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i].every(value => clean_(value) === '')) return i + 2;
  }
  return lastRow + 1;
}

function fillStaffRow_(row) {
  const sheet = getStaffSheet_();
  const rowNumber = findFirstEmptyStaffRow_(sheet);
  const placementDate = parseRuDate_(row.placementDate);
  const promotionDate = parseRuDate_(row.promotionDate || row.placementDate);

  const values = [[
    clean_(row.nickName),
    clean_(row.position || 'ММ'),
    clean_(row.name),
    clean_(row.timezone || 'МСК'),
    '',
    '',
    clean_(row.warnings || '0/2'),
    clean_(row.reprimands || '0/3'),
    clean_(row.discordId),
    clean_(row.discordTag),
    '',
    placementDate,
    '',
    promotionDate,
    '',
  ]];

  sheet.getRange(rowNumber, 1, 1, values[0].length).setValues(values);
  sheet.getRange(rowNumber, 5).setFormula(hyperlinkFormula_(row.vkUrl, 'VK ↗') || '');
  sheet.getRange(rowNumber, 6).setFormula(hyperlinkFormula_(row.forumUrl, 'ФА ↗') || '');
  sheet.getRange(rowNumber, 11).setFormula(hyperlinkFormula_(row.telegramUrl, 'TG ↗') || '');
  sheet.getRange(rowNumber, 13).setFormula(`=IF(L${rowNumber}="","",TODAY()-L${rowNumber})`);
  sheet.getRange(rowNumber, 15).setFormula(`=IF(N${rowNumber}="","",TODAY()-N${rowNumber})`);

  return {
    ok: true,
    service: 'ch89-staff-sheet-fill-v12',
    sheetName: sheet.getName(),
    rowNumber,
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  };
}

function getPendingRows_(sheet, limit) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = headersFor_(sheet);
  const items = [];

  if (lastRow < 2 || lastColumn < 1) return { headers, items };

  const scanRows = Math.min(lastRow - 1, CH89_SCAN_LIMIT);
  const firstRow = Math.max(2, lastRow - scanRows + 1);
  const values = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, lastColumn).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const rowNumber = firstRow + i;
    if (!rowHasAnyData_(row)) continue;
    if (!isPendingByVerdict_(headers, row)) continue;
    items.push(buildRowPayload_(sheet, rowNumber, headers, row));
    if (items.length >= limit) break;
  }

  return { headers, items };
}

function debugInfo_(sheet) {
  const headers = headersFor_(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const first = Math.max(2, lastRow - 4);
  const count = lastRow >= 2 ? Math.max(0, lastRow - first + 1) : 0;
  const values = count ? sheet.getRange(first, 1, count, lastColumn).getValues() : [];
  const rows = values.map((row, idx) => ({
    rowNumber: first + idx,
    hasData: rowHasAnyData_(row),
    verdict: verdictValue_(headers, row),
    reason: reasonValue_(headers, row),
    pending: isPendingByVerdict_(headers, row),
    lastTwoValues: lastTwoValues_(row),
  }));

  return {
    activeSheet: sheet.getName(),
    allSheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName()),
    lastRow,
    lastColumn,
    verdictHeader: verdictIndex_(headers) >= 0 ? headers[verdictIndex_(headers)] : null,
    reasonHeader: reasonIndex_(headers) >= 0 ? headers[reasonIndex_(headers)] : null,
    headers,
    recentRows: rows,
  };
}

function doGet(e) {
  const expected = clean_(CH89_PULL_SECRET);
  const received = clean_(getParam_(e, 'secret', ''));
  if (expected && received !== expected) {
    return json_({ ok: false, error: 'bad secret' });
  }

  const mode = clean_(getParam_(e, 'mode', 'pending'));
  const limit = Math.max(1, Math.min(Number(getParam_(e, 'limit', CH89_DEFAULT_LIMIT)) || CH89_DEFAULT_LIMIT, 25));

  if (mode === 'staff_fill') {
    const rawRow = getParam_(e, 'row', '');
    let row = {};
    try {
      row = rawRow ? JSON.parse(rawRow) : {};
    } catch (error) {
      return json_({ ok: false, error: `bad row json: ${error}` });
    }
    if (!clean_(row.nickName)) return json_({ ok: false, error: 'missing Nick_Name' });
    if (!clean_(row.vkUrl)) return json_({ ok: false, error: 'missing VK' });
    if (!clean_(row.forumUrl)) return json_({ ok: false, error: 'missing Forum/FA' });
    return json_(fillStaffRow_(row));
  }

  const sheet = getTargetSheet_(getParam_(e, 'sheet', ''));

  if (mode === 'debug' || mode === 'gsheet' || mode === 'diag') {
    return json_({ ok: true, service: 'ch89-google-sheets-v8-debug', ...debugInfo_(sheet) });
  }

  if (mode !== 'pending') {
    return json_({ ok: false, error: 'unknown mode', mode });
  }

  const result = getPendingRows_(sheet, limit);
  return json_({
    ok: true,
    service: 'ch89-google-sheets-pending-v8',
    sheetName: sheet.getName(),
    limit,
    count: result.items.length,
    verdictRule: 'pending means verdict column is empty / На рассмотрении / pending; fallback uses last 2 columns',
    headers: result.headers,
    items: result.items,
  });
}

function doPost(e) {
  const payload = parseJsonBody_(e);
  if (payload._parseError) return json_({ ok: false, error: `bad json: ${payload._parseError}` });

  const expected = clean_(CH89_PULL_SECRET);
  const received = clean_(getParam_(e, 'secret', '') || payload.secret);
  if (expected && received !== expected) {
    return json_({ ok: false, error: 'bad secret' });
  }

  const mode = clean_(payload.mode || getParam_(e, 'mode', ''));
  if (mode === 'staff_fill') {
    const row = payload.row || {};
    if (!clean_(row.nickName)) return json_({ ok: false, error: 'missing Nick_Name' });
    if (!clean_(row.vkUrl)) return json_({ ok: false, error: 'missing VK' });
    if (!clean_(row.forumUrl)) return json_({ ok: false, error: 'missing Forum/FA' });
    return json_(fillStaffRow_(row));
  }

  return json_({ ok: false, error: 'unknown post mode', mode });
}

function sendToCh89_(payload) {
  const response = UrlFetchApp.fetch(CH89_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  console.log(`CH89 webhook response: ${code} ${body}`);

  if (code < 200 || code >= 300) {
    throw new Error(`CH89 webhook failed: ${code} ${body}`);
  }

  return { code, body };
}

function onFormSubmit(e) {
  const range = e && e.range;
  const sheet = range ? range.getSheet() : getTargetSheet_('');
  const rowNumber = range ? range.getRow() : sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = headersFor_(sheet);
  const row = e && e.values ? e.values : sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];

  if (!isPendingByVerdict_(headers, row)) {
    console.log(`Skipped row ${rowNumber}: verdict exists (${verdictValue_(headers, row)})`);
    return;
  }

  sendToCh89_(buildRowPayload_(sheet, rowNumber, headers, row));
}

function testPendingRows() {
  const sheet = getTargetSheet_('');
  const result = getPendingRows_(sheet, 10);
  console.log(JSON.stringify({ sheetName: sheet.getName(), count: result.items.length, items: result.items }, null, 2));
  return result;
}

function testSendLastPendingRow() {
  const sheet = getTargetSheet_('');
  const result = getPendingRows_(sheet, 1);
  if (!result.items.length) throw new Error('No pending rows: verdict column is filled or sheet is empty. Run testPendingRows/debug.');
  return sendToCh89_(result.items[0]);
}

function testWebhookOnly() {
  const payload = {
    source: 'google_form_test_v8',
    sheetName: CH89_TARGET_SHEET_NAME || 'Ответы на форму (3)',
    rowNumber: 0,
    namedValues: {
      'Тест': 'Проверка связи Google Sheets → Vercel → VK',
      'VK': 'https://vk.com/id628466808',
      'Форум': 'https://forum.blackrussia.online/',
    },
    verdictValue: '',
    reasonValue: '',
    lastTwoValues: ['', ''],
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    submittedAt: new Date().toISOString(),
  };
  return sendToCh89_(payload);
}
