// ============================================================
// HYRULEAN TREASURY - Google Apps Script Backend
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Create a new Google Sheet
// 2. In the sheet, go to Extensions > Apps Script
// 3. Delete all existing code and paste this entire file
// 4. Click "Deploy" > "New deployment"
// 5. Type: Web app
// 6. Execute as: Me
// 7. Who has access: Anyone
// 8. Click Deploy, copy the Web App URL
// 9. Paste the URL into the Hyrulean Treasury settings
// ============================================================

const SHEET_NAME_KIDS = 'Kids';
const SHEET_NAME_TX = 'Transactions';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getData';
  try {
    if (action === 'getData')            return getData();
    if (action === 'addTransaction')     return addTransaction(e.parameter);
    if (action === 'editTransaction')    return editTransaction(e.parameter);
    if (action === 'deleteTransaction')  return deleteTransaction(e.parameter);
    if (action === 'addKid')             return addKid(e.parameter);
    if (action === 'deleteKid')          return deleteKid(e.parameter);
    if (action === 'setGoal')            return setGoal(e.parameter);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
  return jsonResponse({ error: 'Unknown action' });
}

// ── Read all data ──────────────────────────────────────────
function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS,
    ['Name', 'Balance', 'Color', 'Goal', 'GoalName']);
  const txSheet = getOrCreateSheet(ss, SHEET_NAME_TX,
    ['Timestamp', 'Kid', 'Amount', 'Description']);

  const kidsRaw = kidsSheet.getDataRange().getValues();
  const txRaw   = txSheet.getDataRange().getValues();

  const kids = [];
  for (let i = 1; i < kidsRaw.length; i++) {
    if (kidsRaw[i][0]) {
      kids.push({
        name:     kidsRaw[i][0],
        balance:  parseFloat(kidsRaw[i][1]) || 0,
        color:    kidsRaw[i][2] || 'green',
        goal:     parseFloat(kidsRaw[i][3]) || 0,
        goalName: kidsRaw[i][4] || ''
      });
    }
  }

  const transactions = [];
  for (let i = 1; i < txRaw.length; i++) {
    if (txRaw[i][0]) {
      transactions.push({
        rowIndex:    i + 1,
        timestamp:   txRaw[i][0],
        kid:         txRaw[i][1],
        amount:      parseFloat(txRaw[i][2]),
        description: txRaw[i][3]
      });
    }
  }
  transactions.reverse();

  return jsonResponse({ kids, transactions: transactions.slice(0, 50) });
}

// ── Add / subtract rupees ──────────────────────────────────
function addTransaction(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet   = getOrCreateSheet(ss, SHEET_NAME_TX,   ['Timestamp','Kid','Amount','Description']);
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const amount      = parseFloat(params.amount);
  const kid         = params.kid;
  const description = params.description || 'Transaction';

  if (isNaN(amount)) return jsonResponse({ error: 'Invalid amount' });

  txSheet.appendRow([new Date(), kid, amount, description]);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === kid) {
      const newBalance = (parseFloat(kidsData[i][1]) || 0) + amount;
      kidsSheet.getRange(i + 1, 2).setValue(newBalance);
      return jsonResponse({ success: true, newBalance });
    }
  }
  return jsonResponse({ error: 'Hero not found' });
}

// ── Edit an existing transaction ───────────────────────────
function editTransaction(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet   = getOrCreateSheet(ss, SHEET_NAME_TX,   ['Timestamp','Kid','Amount','Description']);
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const rowIndex  = parseInt(params.rowIndex);
  const newAmount = parseFloat(params.amount);
  const newDesc   = params.description || '';

  if (isNaN(rowIndex) || isNaN(newAmount)) return jsonResponse({ error: 'Invalid parameters' });

  const oldAmount = parseFloat(txSheet.getRange(rowIndex, 3).getValue());
  const kid       = txSheet.getRange(rowIndex, 2).getValue();
  const diff      = newAmount - oldAmount;

  txSheet.getRange(rowIndex, 3).setValue(newAmount);
  txSheet.getRange(rowIndex, 4).setValue(newDesc);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === kid) {
      const newBalance = (parseFloat(kidsData[i][1]) || 0) + diff;
      kidsSheet.getRange(i + 1, 2).setValue(newBalance);
      return jsonResponse({ success: true, newBalance });
    }
  }
  return jsonResponse({ error: 'Hero not found' });
}

// ── Delete a transaction ───────────────────────────────────
function deleteTransaction(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet   = getOrCreateSheet(ss, SHEET_NAME_TX,   ['Timestamp','Kid','Amount','Description']);
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const rowIndex = parseInt(params.rowIndex);
  if (isNaN(rowIndex) || rowIndex < 2) return jsonResponse({ error: 'Invalid row index' });

  const amount = parseFloat(txSheet.getRange(rowIndex, 3).getValue());
  const kid    = txSheet.getRange(rowIndex, 2).getValue();

  txSheet.deleteRow(rowIndex);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === kid) {
      const newBalance = (parseFloat(kidsData[i][1]) || 0) - amount;
      kidsSheet.getRange(i + 1, 2).setValue(newBalance);
      return jsonResponse({ success: true, newBalance });
    }
  }
  return jsonResponse({ error: 'Hero not found' });
}

// ── Add a new kid ──────────────────────────────────────────
function addKid(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === params.name) {
      return jsonResponse({ error: 'Hero already exists' });
    }
  }

  kidsSheet.appendRow([params.name, 0, params.color || 'green',
    parseFloat(params.goal) || 0, params.goalName || '']);
  return jsonResponse({ success: true });
}

// ── Remove a kid ───────────────────────────────────────────
function deleteKid(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === params.name) {
      kidsSheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'Hero not found' });
}

// ── Update savings goal ────────────────────────────────────
function setGoal(params) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const kidsSheet = getOrCreateSheet(ss, SHEET_NAME_KIDS, ['Name','Balance','Color','Goal','GoalName']);

  const kidsData = kidsSheet.getDataRange().getValues();
  for (let i = 1; i < kidsData.length; i++) {
    if (kidsData[i][0] === params.name) {
      kidsSheet.getRange(i + 1, 4).setValue(parseFloat(params.goal) || 0);
      kidsSheet.getRange(i + 1, 5).setValue(params.goalName || '');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'Hero not found' });
}

// ── Helpers ────────────────────────────────────────────────
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#2d4a22')
         .setFontColor('#ffd700');
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
