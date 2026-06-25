/**
 * CH89 Google Forms → VK staff bridge v6.
 * Важно: этот скрипт надо ставить именно в Google Sheet, где есть лист "Ответы на формы (3)".
 * Триггер: onFormSubmit → From spreadsheet → On form submit.
 */

const CH89_WEBHOOK_URL = 'https://YOUR-VERCEL-PROJECT.vercel.app/api/google-sheet-webhook?secret=YOUR_SECRET';
const CH89_TARGET_SHEET_NAME = 'Ответы на формы (3)';

function buildPayloadFromRow_(sheet, rowNumber, valuesFromEvent) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = valuesFromEvent || sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];

  const namedValues = {};
  headers.forEach((header, index) => {
    const key = String(header || `Поле ${index + 1}`).trim();
    if (key) namedValues[key] = values[index] == null ? '' : String(values[index]);
  });

  return {
    sheetName: sheet.getName(),
    rowNumber,
    headers,
    values,
    namedValues,
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    submittedAt: new Date().toISOString(),
  };
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
  const sheet = range ? range.getSheet() : SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  if (CH89_TARGET_SHEET_NAME && sheetName !== CH89_TARGET_SHEET_NAME) {
    console.log(`Skipped sheet: ${sheetName}`);
    return;
  }

  const rowNumber = range ? range.getRow() : sheet.getLastRow();
  const values = e && e.values ? e.values : null;
  const payload = buildPayloadFromRow_(sheet, rowNumber, values);
  sendToCh89_(payload);
}

function testSendLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CH89_TARGET_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${CH89_TARGET_SHEET_NAME}`);
  const rowNumber = sheet.getLastRow();
  const payload = buildPayloadFromRow_(sheet, rowNumber, null);
  return sendToCh89_(payload);
}

function testWebhookOnly() {
  const payload = {
    sheetName: CH89_TARGET_SHEET_NAME,
    rowNumber: 0,
    namedValues: {
      'Тест': 'Проверка связи Google Sheets → Vercel → VK',
      'VK': 'https://vk.com/id628466808',
      'Форум': 'https://forum.blackrussia.online/',
    },
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    submittedAt: new Date().toISOString(),
  };
  return sendToCh89_(payload);
}
