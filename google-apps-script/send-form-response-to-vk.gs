/**
 * CH89 Google Forms → VK staff bridge.
 * 1. Открой Google Sheet с ответами формы.
 * 2. Расширения → Apps Script.
 * 3. Вставь этот код.
 * 4. Заполни CH89_WEBHOOK_URL.
 * 5. Слева «Триггеры» → Add Trigger → onFormSubmit → From spreadsheet → On form submit.
 */

const CH89_WEBHOOK_URL = 'https://YOUR-VERCEL-PROJECT.vercel.app/api/google-sheet-webhook?secret=YOUR_SECRET';
const CH89_TARGET_SHEET_NAME = 'Ответы на формы (3)';

function onFormSubmit(e) {
  const range = e && e.range;
  const sheet = range ? range.getSheet() : SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  if (CH89_TARGET_SHEET_NAME && sheetName !== CH89_TARGET_SHEET_NAME) {
    return;
  }

  const rowNumber = range ? range.getRow() : sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = e && e.values ? e.values : sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];

  const namedValues = {};
  headers.forEach((header, index) => {
    const key = String(header || `Поле ${index + 1}`).trim();
    if (key) namedValues[key] = values[index] == null ? '' : String(values[index]);
  });

  const payload = {
    sheetName,
    rowNumber,
    headers,
    values,
    namedValues,
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    submittedAt: new Date().toISOString(),
  };

  UrlFetchApp.fetch(CH89_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function testSendLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CH89_TARGET_SHEET_NAME);
  const rowNumber = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  onFormSubmit({ range: sheet.getRange(rowNumber, 1), values });
}
