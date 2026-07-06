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
  return `=ГИПЕРССЫЛКА("${formulaString_(cleanUrl)}";"${formulaString_(label || cleanUrl)}")`;
}

function daysFormula_(dateCell) {
  return `=ЕСЛИ(${dateCell}="";"";СЕГОДНЯ()-${dateCell})`;
}

function setLocalizedFormula_(range, formula) {
  range.setValue(formula);
}

function setRichHyperlink_(range, url, label) {
  const cleanUrl = clean_(url);
  if (!cleanUrl || cleanUrl === '—') {
    range.setValue('—');
    return;
  }

  range.setRichTextValue(
    SpreadsheetApp.newRichTextValue()
      .setText(label || cleanUrl)
      .setLinkUrl(cleanUrl)
      .build()
  );
}

function richTextUrl_(range) {
  const rich = range.getRichTextValue();
  if (!rich) return '';
  const direct = rich.getLinkUrl();
  if (direct) return clean_(direct);
  const runs = rich.getRuns();
  for (const run of runs) {
    const url = run.getLinkUrl();
    if (url) return clean_(url);
  }
  return '';
}

function applyStaffDropdowns_(sheet, rowNumber) {
  sheet.getRange(rowNumber, 7).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['0/2', '1/2', '2/2'], true)
      .setAllowInvalid(false)
      .build()
  );
  sheet.getRange(rowNumber, 8).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['0/3', '1/3', '2/3', '3/3'], true)
      .setAllowInvalid(false)
      .build()
  );
}

function parseRuDate_(value) {
  const raw = clean_(value);
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function normalizeExistingUrl_(value, type) {
  let raw = clean_(value);
  if (!raw) return '';

  const formulaMatch = raw.match(/(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*"([^"]+)"/i);
  if (formulaMatch) raw = clean_(formulaMatch[1]);

  raw = raw
    .replace(/^https:\/\/vk\.com\/(?:https?:\/\/)?vk\.com\//i, 'https://vk.com/')
    .replace(/^https:\/\/vk\.com\/(?:https?:\/\/)?vk\.ru\//i, 'https://vk.ru/')
    .replace(/^https:\/\/t\.me\/(?:https?:\/\/)?t\.me\//i, 'https://t.me/')
    .replace(/^https:\/\/t\.me\/@/i, 'https://t.me/');

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(?:vk\.com|vk\.ru|t\.me|telegram\.me)\//i.test(raw)) return `https://${raw}`;
  if (type === 'vk' && raw && raw !== '—') return `https://vk.com/${raw.replace(/^@/, '')}`;
  if (type === 'telegram' && raw && raw !== '—') return `https://t.me/${raw.replace(/^@/, '')}`;
  if (type === 'forum' && raw.includes('.')) return `https://${raw}`;
  return raw;
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
  return findHeaderIndex_(headers, [/причин.*отказ/, /^причин/, /отказ/, /коммент/, /comment/, /reason/]);
}

function ensureDecisionColumns_(sheet, headers) {
  const result = {
    verdictIndex: verdictIndex_(headers),
    reasonIndex: reasonIndex_(headers),
  };
  let lastColumn = Math.max(sheet.getLastColumn(), headers.length);

  if (result.verdictIndex < 0) {
    lastColumn += 1;
    sheet.getRange(1, lastColumn).setValue('Вердикт');
    result.verdictIndex = lastColumn - 1;
    headers[result.verdictIndex] = 'Вердикт';
  }

  if (result.reasonIndex < 0) {
    lastColumn += 1;
    sheet.getRange(1, lastColumn).setValue('Комментарий');
    result.reasonIndex = lastColumn - 1;
    headers[result.reasonIndex] = 'Комментарий';
  }

  return result;
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

function formulaUrl_(formula) {
  const raw = clean_(formula);
  if (!raw) return '';
  const match = raw.match(/(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*"([^"]+)"/i);
  return match ? clean_(match[1]) : '';
}

function buildNamedValuesWithFormulas_(headers, row, formulas) {
  const namedValues = {};
  headers.forEach((header, index) => {
    const formulaUrl = formulaUrl_(formulas[index]);
    namedValues[header] = formulaUrl || (row[index] == null ? '' : row[index]);
  });
  return namedValues;
}

function firstNamed_(named, patterns) {
  const entries = Object.entries(named || {});
  for (const pattern of patterns) {
    const found = entries.find(([key, value]) => pattern.test(low_(key)) && clean_(value));
    if (found) return clean_(found[1]);
  }
  return '';
}

function applicationRowPayload_(sheet, rowNumber) {
  const n = Number(rowNumber);
  if (!Number.isFinite(n) || n < 2) {
    return { ok: false, error: 'bad rowNumber' };
  }

  const headers = headersFor_(sheet);
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const rowValues = sheet.getRange(n, 1, 1, lastColumn).getValues()[0];
  const rowFormulas = sheet.getRange(n, 1, 1, lastColumn).getFormulas()[0];
  return {
    ok: true,
    sheetName: sheet.getName(),
    rowNumber: n,
    headers,
    values: rowValues,
    namedValues: buildNamedValuesWithFormulas_(headers, rowValues, rowFormulas),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  };
}

function staffRowFromApplication_(named) {
  const nickName = firstNamed_(named, [/nick|ник|game|игров/]);
  const nameAge = firstNamed_(named, [/имя|возраст|name|age/]);
  const name = clean_(nameAge.split(/[,\n|]/)[0] || nameAge);
  const ageMatch = nameAge.match(/\b(\d{1,2})\b/);
  return {
    nickName,
    position: 'ММ',
    name,
    timezone: 'МСК',
    vkUrl: firstNamed_(named, [/вконтакте|vk|вк/]),
    forumUrl: firstNamed_(named, [/форум|forum|фа/]),
    warnings: '0/2',
    reprimands: '0/3',
    discordId: firstNamed_(named, [/discord.*id|дискорд.*id|дс.*id|discord/]),
    discordTag: firstNamed_(named, [/discord.*tag|дискорд.*tag|tag|тег/]),
    telegramUrl: firstNamed_(named, [/telegram|телеграм|tg/]),
    placementDate: new Date(),
    promotionDate: new Date(),
    age: ageMatch ? ageMatch[1] : '',
  };
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

function rowLabel_(row) {
  return row.map(value => low_(value)).join(' ');
}

function findJuniorModeratorSection_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const lastColumn = Math.max(sheet.getLastColumn(), 15);
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  let headerRow = 0;

  for (let i = 0; i < values.length; i++) {
    const label = rowLabel_(values[i]);
    if (label.includes('младш') && label.includes('модератор')) {
      headerRow = i + 1;
      break;
    }
  }

  if (!headerRow) {
    const fallbackRow = findFirstEmptyStaffRow_(sheet);
    return { headerRow: 0, insertRow: fallbackRow, templateRow: Math.max(2, fallbackRow - 1), fallback: true };
  }

  let lastDataRow = headerRow;
  for (let row = headerRow + 1; row <= lastRow; row++) {
    const valuesRow = values[row - 1] || [];
    const label = rowLabel_(valuesRow);
    const firstCell = clean_(valuesRow[0]);
    const position = clean_(valuesRow[1]);
    const hasNick = !!firstCell && firstCell !== '—';
    const looksLikeSection = row > headerRow + 1 && label.includes('модератор') && !hasNick;

    if (looksLikeSection) break;
    if (hasNick || /^м?м$/i.test(position)) lastDataRow = row;
  }

  return {
    headerRow,
    insertRow: lastDataRow + 1,
    templateRow: Math.max(headerRow + 1, lastDataRow),
    fallback: false,
  };
}

function prepareStaffInsertRow_(sheet) {
  const section = findJuniorModeratorSection_(sheet);
  const lastColumn = Math.max(sheet.getLastColumn(), 15);

  if (!section.fallback) {
    sheet.insertRowsBefore(section.insertRow, 1);
    sheet
      .getRange(section.templateRow, 1, 1, lastColumn)
      .copyTo(sheet.getRange(section.insertRow, 1, 1, lastColumn), { formatOnly: true });

    const validations = sheet.getRange(section.templateRow, 1, 1, lastColumn).getDataValidations();
    sheet.getRange(section.insertRow, 1, 1, lastColumn).setDataValidations(validations);
    return section.insertRow;
  }

  return section.insertRow;
}

function fillStaffRow_(row) {
  const sheet = getStaffSheet_();
  const rowNumber = prepareStaffInsertRow_(sheet);
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
    '',
    clean_(row.age),
  ]];

  sheet.getRange(rowNumber, 1, 1, values[0].length).setValues(values);
  setRichHyperlink_(sheet.getRange(rowNumber, 5), row.vkUrl, 'VK ↗');
  setRichHyperlink_(sheet.getRange(rowNumber, 6), row.forumUrl, 'ФА ↗');
  setRichHyperlink_(sheet.getRange(rowNumber, 11), row.telegramUrl, 'TG ↗');
  setLocalizedFormula_(sheet.getRange(rowNumber, 13), daysFormula_(`L${rowNumber}`));
  setLocalizedFormula_(sheet.getRange(rowNumber, 15), daysFormula_(`N${rowNumber}`));
  sheet.getRange(rowNumber, 12).setNumberFormat('dd.MM.yyyy');
  sheet.getRange(rowNumber, 14).setNumberFormat('dd.MM.yyyy');
  applyStaffDropdowns_(sheet, rowNumber);

  return {
    ok: true,
    service: 'ch89-staff-sheet-fill-v26-section-aware',
    sheetName: sheet.getName(),
    rowNumber,
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  };
}

function fillStaffRowFromApplication_(sheet, rowNumber) {
  const payload = applicationRowPayload_(sheet, rowNumber);
  if (!payload.ok) return payload;

  const staffRow = staffRowFromApplication_(payload.namedValues);
  if (!clean_(staffRow.nickName)) return { ok: false, error: 'missing Nick_Name in application row', application: payload };
  if (!clean_(staffRow.vkUrl)) return { ok: false, error: 'missing VK in application row', application: payload };
  if (!clean_(staffRow.forumUrl)) return { ok: false, error: 'missing Forum/FA in application row', application: payload };

  const result = fillStaffRow_(staffRow);
  return {
    ...result,
    service: 'ch89-application-to-staff-v26',
    applicationSheetName: payload.sheetName,
    applicationRowNumber: payload.rowNumber,
    staffRow,
    application: payload,
  };
}

function repairStaffRow_(rowNumber) {
  const sheet = getStaffSheet_();
  const n = Number(rowNumber);
  if (!Number.isFinite(n) || n < 2) {
    return { ok: false, error: 'bad rowNumber' };
  }

  const vkCell = sheet.getRange(n, 5);
  const forumCell = sheet.getRange(n, 6);
  const tgCell = sheet.getRange(n, 11);

  const vkUrl = richTextUrl_(vkCell) || normalizeExistingUrl_(vkCell.getFormula() || vkCell.getDisplayValue(), 'vk');
  const forumUrl = richTextUrl_(forumCell) || normalizeExistingUrl_(forumCell.getFormula() || forumCell.getDisplayValue(), 'forum');
  const tgUrl = richTextUrl_(tgCell) || normalizeExistingUrl_(tgCell.getFormula() || tgCell.getDisplayValue(), 'telegram');

  if (vkUrl && vkUrl !== '—') setRichHyperlink_(vkCell, vkUrl, 'VK ↗');
  if (forumUrl && forumUrl !== '—') setRichHyperlink_(forumCell, forumUrl, 'ФА ↗');
  if (tgUrl && tgUrl !== '—') setRichHyperlink_(tgCell, tgUrl, 'TG ↗');
  setLocalizedFormula_(sheet.getRange(n, 13), daysFormula_(`L${n}`));
  setLocalizedFormula_(sheet.getRange(n, 15), daysFormula_(`N${n}`));
  sheet.getRange(n, 12).setNumberFormat('dd.MM.yyyy');
  sheet.getRange(n, 14).setNumberFormat('dd.MM.yyyy');
  applyStaffDropdowns_(sheet, n);

  return {
    ok: true,
    service: 'ch89-staff-sheet-repair-v26-section-aware',
    sheetName: sheet.getName(),
    rowNumber: n,
    fixed: {
      vk: vkUrl || '',
      forum: forumUrl || '',
      telegram: tgUrl || '',
    },
  };
}

function setApplicationVerdict_(sheet, rowNumber, verdict, reason, actor) {
  const n = Number(rowNumber);
  if (!Number.isFinite(n) || n < 2) {
    return { ok: false, error: 'bad rowNumber' };
  }

  const cleanVerdict = clean_(verdict);
  if (!cleanVerdict) {
    return { ok: false, error: 'missing verdict' };
  }

  const headers = headersFor_(sheet);
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const rowValues = sheet.getRange(n, 1, 1, lastColumn).getValues()[0];
  const rowFormulas = sheet.getRange(n, 1, 1, lastColumn).getFormulas()[0];
  const decision = ensureDecisionColumns_(sheet, headers);
  const verdictCell = sheet.getRange(n, decision.verdictIndex + 1);
  const reasonCell = sheet.getRange(n, decision.reasonIndex + 1);
  const previousVerdict = clean_(verdictCell.getDisplayValue());
  const isReturnToPending = low_(cleanVerdict).includes('рассмотр') || low_(cleanVerdict) === 'pending';

  if (previousVerdict && !isPendingVerdictValue_(previousVerdict) && !isReturnToPending) {
    return {
      ok: false,
      error: 'already_decided',
      message: `row already has verdict: ${previousVerdict}`,
      sheetName: sheet.getName(),
      rowNumber: n,
      previousVerdict,
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    };
  }

  const stamp = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss');
  const actorText = clean_(actor) || 'VK staff';

  verdictCell.setValue(cleanVerdict);
  verdictCell.setNote(`${actorText} · ${stamp}`);
  reasonCell.setValue(clean_(reason));
  reasonCell.setNote(`${actorText} · ${stamp}`);

  return {
    ok: true,
    service: 'ch89-google-sheets-verdict-v26',
    sheetName: sheet.getName(),
    rowNumber: n,
    verdict: cleanVerdict,
    reason: clean_(reason),
    previousVerdict,
    headers,
    values: rowValues,
    namedValues: buildNamedValuesWithFormulas_(headers, rowValues, rowFormulas),
    verdictColumn: headers[decision.verdictIndex] || 'Вердикт',
    reasonColumn: headers[decision.reasonIndex] || 'Комментарий',
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

  const rawRow = getParam_(e, 'row', '');
  if (mode === 'staff_debug' || mode === 'staff_test') {
    const staffSheet = getStaffSheet_();
    return json_({
      ok: true,
      service: 'ch89-staff-sheet-v26-section-aware',
      staffFill: true,
      staffSheetName: staffSheet.getName(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    });
  }

  if (mode === 'staff_fix' || mode === 'staff_repair') {
    return json_(repairStaffRow_(getParam_(e, 'rowNumber', getParam_(e, 'row', ''))));
  }

  if (mode === 'staff_fill' || mode === 'staff' || mode === 'fill_staff' || mode === 'состав' || rawRow) {
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

  if (mode === 'verdict' || mode === 'set_verdict' || mode === 'application_verdict' || mode === 'app_verdict') {
    return json_(setApplicationVerdict_(
      sheet,
      getParam_(e, 'rowNumber', getParam_(e, 'row', '')),
      getParam_(e, 'verdict', ''),
      getParam_(e, 'reason', ''),
      getParam_(e, 'actor', '')
    ));
  }

  if (mode === 'application_to_staff' || mode === 'app_to_staff' || mode === 'to_staff' || mode === 'staff_from_application') {
    return json_(fillStaffRowFromApplication_(
      sheet,
      getParam_(e, 'rowNumber', getParam_(e, 'row', ''))
    ));
  }

  if (mode === 'debug' || mode === 'gsheet' || mode === 'diag') {
    return json_({ ok: true, service: 'ch89-google-sheets-v26-debug', ...debugInfo_(sheet) });
  }

  if (mode !== 'pending') {
    return json_({ ok: false, error: 'unknown mode', mode });
  }

  const result = getPendingRows_(sheet, limit);
  return json_({
    ok: true,
    service: 'ch89-google-sheets-pending-v26',
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

  if (mode === 'verdict' || mode === 'set_verdict' || mode === 'application_verdict' || mode === 'app_verdict') {
    const sheet = getTargetSheet_(payload.sheetName || payload.sheet || '');
    return json_(setApplicationVerdict_(
      sheet,
      payload.rowNumber || payload.row,
      payload.verdict,
      payload.reason || '',
      payload.actor || ''
    ));
  }

  if (mode === 'application_to_staff' || mode === 'app_to_staff' || mode === 'to_staff' || mode === 'staff_from_application') {
    const sheet = getTargetSheet_(payload.sheetName || payload.sheet || '');
    return json_(fillStaffRowFromApplication_(sheet, payload.rowNumber || payload.row));
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
