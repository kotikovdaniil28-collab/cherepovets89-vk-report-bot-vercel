/**
 * CH89 Google Sheets bridge v7.
 * Что делает:
 * 1) /заявки в VK-боте может забрать из Google Sheets все строки без вердикта.
 * 2) Строка считается заявкой без вердикта, если в последних 2 столбцах строки пусто.
 * 3) onFormSubmit можно оставить как авто-уведомление, но основной режим теперь pull через /заявки.
 *
 * Установка:
 * - Код вставлять в Apps Script именно этой Google-таблицы.
 * - Deploy → New deployment → Web app.
 * - Execute as: Me.
 * - Who has access: Anyone with the link.
 * - URL Web App вставить в Vercel как GOOGLE_APPS_SCRIPT_URL.
 */

const CH89_WEBHOOK_URL = 'https://YOUR-VERCEL-PROJECT.vercel.app/api/google-sheet-webhook?secret=YOUR_SECRET';
const CH89_PULL_SECRET = 'YOUR_SECRET';
const CH89_TARGET_SHEET_NAME = 'Ответы на форму (3)';
const CH89_FALLBACK_SHEET_NAMES = ['Ответы на форму (3)', 'Ответы на формы (3)', 'Form Responses 1'];
const CH89_VERDICT_COLUMNS_FROM_END = 2;
const CH89_DEFAULT_LIMIT = 10;
const CH89_SCAN_LIMIT = 500;

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getParam_(e, name, fallback) {
  return e && e.parameter && e.parameter[name] != null ? String(e.parameter[name]) : fallback;
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

  return ss.getActiveSheet();
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

function lastTwoVerdictValues_(row) {
  const cols = Math.max(CH89_VERDICT_COLUMNS_FROM_END, 1);
  const start = Math.max(row.length - cols, 0);
  return row.slice(start).map(clean_);
}

function isPendingByVerdict_(row) {
  const verdictValues = lastTwoVerdictValues_(row);
  return verdictValues.every(value => value === '');
}

function buildNamedValues_(headers, row) {
  const namedValues = {};
  headers.forEach((header, index) => {
    namedValues[header] = row[index] == null ? '' : row[index];
  });
  return namedValues;
}

function buildRowPayload_(sheet, rowNumber, headers, row) {
  return {
    source: 'google_sheet_pending_pull',
    sheetName: sheet.getName(),
    rowNumber,
    headers,
    values: row,
    namedValues: buildNamedValues_(headers, row),
    lastTwoValues: lastTwoVerdictValues_(row),
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    pulledAt: new Date().toISOString(),
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
    if (!isPendingByVerdict_(row)) continue;
    items.push(buildRowPayload_(sheet, rowNumber, headers, row));
    if (items.length >= limit) break;
  }

  return { headers, items };
}

function doGet(e) {
  const expected = clean_(CH89_PULL_SECRET);
  const received = clean_(getParam_(e, 'secret', ''));
  if (expected && received !== expected) {
    return json_({ ok: false, error: 'bad secret' });
  }

  const mode = clean_(getParam_(e, 'mode', 'pending'));
  const limit = Math.max(1, Math.min(Number(getParam_(e, 'limit', CH89_DEFAULT_LIMIT)) || CH89_DEFAULT_LIMIT, 25));
  const sheet = getTargetSheet_(getParam_(e, 'sheet', ''));

  if (mode !== 'pending') {
    return json_({ ok: false, error: 'unknown mode', mode });
  }

  const result = getPendingRows_(sheet, limit);
  return json_({
    ok: true,
    service: 'ch89-google-sheets-pending-v7',
    sheetName: sheet.getName(),
    limit,
    count: result.items.length,
    verdictRule: 'pending means both last 2 columns are empty',
    headers: result.headers,
    items: result.items,
  });
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

  // Если в последних двух столбцах уже есть вердикт/комментарий — не отправляем.
  if (!isPendingByVerdict_(row)) {
    console.log(`Skipped row ${rowNumber}: verdict exists`);
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
  if (!result.items.length) throw new Error('No pending rows: last 2 columns are filled or sheet is empty.');
  return sendToCh89_(result.items[0]);
}

function testWebhookOnly() {
  const payload = {
    source: 'google_form_test',
    sheetName: CH89_TARGET_SHEET_NAME,
    rowNumber: 0,
    namedValues: {
      'Тест': 'Проверка связи Google Sheets → Vercel → VK',
      'VK': 'https://vk.com/id628466808',
      'Форум': 'https://forum.blackrussia.online/',
    },
    lastTwoValues: ['', ''],
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    submittedAt: new Date().toISOString(),
  };
  return sendToCh89_(payload);
}
