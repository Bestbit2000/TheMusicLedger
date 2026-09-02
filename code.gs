// ==========================================
// CONFIGURATION
// ==========================================
const SHEET_NAME = 'Music time'; 
const SETTINGS_SHEET = 'Settings';
const CHALLENGES_SHEET = 'Challenges';

const COLUMNS = {
  'Practise':    { yearCol: 'A', dateCol: 'B', durationCol: 'C' },
  'Rehearsal':   { yearCol: 'E', whoCol: 'F', dateCol: 'G', durationCol: 'H' },
  'Lesson':      { yearCol: 'J', whoCol: 'K', dateCol: 'L', durationCol: 'M' }, 
  'Performance': { yearCol: 'O', whoCol: 'P', dateCol: 'Q', durationCol: 'R' }
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('The Music Ledger')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDropdownOptions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) throw new Error(`Could not find a tab named "${SETTINGS_SHEET}". Check spelling!`);
  return {
    organisations: sheet.getRange('A4:A100').getValues().flat().filter(String),
    teachers: sheet.getRange('D4:D100').getValues().flat().filter(String)
  };
}

function getPracticeYear(dateObj) {
  const practiceYearEnd = (dateObj.getMonth() >= 10) ? dateObj.getFullYear() + 1 : dateObj.getFullYear();
  return `Year ${practiceYearEnd - 2024}`;
}

// === STANDARD TIME LOGGING ===
function saveRecord(category, who, dateStr, duration) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Could not find a tab named "${SHEET_NAME}".`);
  
  const cols = COLUMNS[category];
  const dateColValues = sheet.getRange(`${cols.dateCol}1:${cols.dateCol}`).getValues();
  
  let lastRow = 0;
  for (let i = dateColValues.length - 1; i >= 0; i--) {
    if (dateColValues[i][0] !== "") { lastRow = i + 1; break; }
  }
  
  const targetRow = lastRow + 1;
  const dateObj = new Date(dateStr);
  
  sheet.getRange(`${cols.yearCol}${targetRow}`).setValue(getPracticeYear(dateObj));
  sheet.getRange(`${cols.dateCol}${targetRow}`).setValue(dateObj);
  sheet.getRange(`${cols.durationCol}${targetRow}`).setValue(Number(duration));
  if (cols.whoCol && who) sheet.getRange(`${cols.whoCol}${targetRow}`).setValue(who);

  return { message: `Saved ${duration} mins!`, category: category, row: targetRow };
}

function undoRecord(category, row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const cols = COLUMNS[category];
  sheet.getRange(`${cols.yearCol}${row}`).clearContent();
  sheet.getRange(`${cols.dateCol}${row}`).clearContent();
  sheet.getRange(`${cols.durationCol}${row}`).clearContent();
  if (cols.whoCol) sheet.getRange(`${cols.whoCol}${row}`).clearContent();
}

function deleteRecord(category, row) {
  undoRecord(category, row); 
  return true;
}

function updateRecord(category, row, dateStr, duration, who) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const cols = COLUMNS[category];
  const dateObj = new Date(dateStr);
  sheet.getRange(`${cols.yearCol}${row}`).setValue(getPracticeYear(dateObj));
  sheet.getRange(`${cols.dateCol}${row}`).setValue(dateObj);
  sheet.getRange(`${cols.durationCol}${row}`).setValue(Number(duration));
  if (cols.whoCol) sheet.getRange(`${cols.whoCol}${row}`).setValue(who);
  return `Row updated!`;
}

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error("Script is not bound to a spreadsheet.");
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Could not find a tab named "${SHEET_NAME}". Check spelling!`);
  
  const data = sheet.getRange('A2:R').getValues();
  const tz = Session.getScriptTimeZone();
  
  let allRecords = [];
  const idx = {
    'Practise': { date: 1, duration: 2, who: null },
    'Rehearsal': { date: 6, duration: 7, who: 5 },
    'Lesson': { date: 11, duration: 12, who: 10 },
    'Performance': { date: 16, duration: 17, who: 15 }
  };

  for (let i = 0; i < data.length; i++) {
    for (const [cat, map] of Object.entries(idx)) {
      const dateVal = data[i][map.date];
      const dur = Number(data[i][map.duration]);
      if (dateVal instanceof Date && dur > 0) {
        allRecords.push({
          row: i + 2, category: cat, dateStr: Utilities.formatDate(dateVal, tz, "yyyy-MM-dd"),
          duration: dur, who: map.who !== null ? data[i][map.who] : ''
        });
      }
    }
  }
  return allRecords.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
}

// === SETTINGS LIST MANAGEMENT ===
function addSettingOption(type, name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  const col = type === 'teachers' ? 'D' : 'A';
  const values = sheet.getRange(`${col}4:${col}100`).getValues().flat().filter(String);
  values.push(name);
  sheet.getRange(`${col}4:${col}100`).clearContent();
  const out = values.map(v => [v]);
  sheet.getRange(4, col === 'A' ? 1 : 4, out.length, 1).setValues(out);
  return getDropdownOptions();
}

function deleteSettingOption(type, name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  const col = type === 'teachers' ? 'D' : 'A';
  let values = sheet.getRange(`${col}4:${col}100`).getValues().flat().filter(String);
  values = values.filter(v => v !== name);
  sheet.getRange(`${col}4:${col}100`).clearContent();
  if(values.length > 0) {
    const out = values.map(v => [v]);
    sheet.getRange(4, col === 'A' ? 1 : 4, out.length, 1).setValues(out);
  }
  return getDropdownOptions();
}

function renameSettingOption(type, oldName, newName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetSettings = ss.getSheetByName(SETTINGS_SHEET);
  const col = type === 'teachers' ? 'D' : 'A';
  let values = sheetSettings.getRange(`${col}4:${col}100`).getValues().flat().filter(String);
  const idx = values.indexOf(oldName);
  if (idx !== -1) {
    values[idx] = newName;
    sheetSettings.getRange(`${col}4:${col}100`).clearContent();
    const out = values.map(v => [v]);
    sheetSettings.getRange(4, col === 'A' ? 1 : 4, out.length, 1).setValues(out);
  }

  const sheetHistory = ss.getSheetByName(SHEET_NAME);
  const catsToUpdate = type === 'teachers' ? ['Lesson'] : ['Rehearsal', 'Performance'];
  catsToUpdate.forEach(cat => {
    const whoCol = COLUMNS[cat].whoCol;
    if (whoCol) {
      const range = sheetHistory.getRange(`${whoCol}2:${whoCol}`);
      const vals = range.getValues();
      let changed = false;
      for(let i=0; i<vals.length; i++) {
        if(vals[i][0] === oldName) { vals[i][0] = newName; changed = true; }
      }
      if(changed) range.setValues(vals);
    }
  });
  return getDropdownOptions();
}

// === CHALLENGES LOGIC ===
function getChallenges() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  let challenges = [];
  for (let i = 1; i < data.length; i++) {
    if(data[i][0]) { 
      challenges.push({
        row: i + 1, id: String(data[i][0]), type: data[i][1], who: data[i][2], name: data[i][3],
        piece: data[i][4], ref: data[i][5], barFrom: data[i][6], barTo: data[i][7],
        bpm: data[i][8], timeSpent: Number(data[i][9]) || 0, sessions: Number(data[i][10]) || 0, status: data[i][11] || 'To do',
        challPriority: Number(data[i][12]) || 999, itemPriority: Number(data[i][13]) || 999
      });
    }
  }
  return challenges.sort((a, b) => {
    if(a.challPriority !== b.challPriority) return a.challPriority - b.challPriority;
    return a.itemPriority - b.itemPriority;
  });
}

function saveChallengeItems(items) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  const newId = items[0].id || Date.now().toString().slice(-6); 
  
  const allExisting = getChallenges();
  let maxChallPriority = 0;
  for(let i=0; i<allExisting.length; i++){
      let p = Number(allExisting[i].challPriority);
      if(!isNaN(p) && p > maxChallPriority && p !== 999) maxChallPriority = p;
  }
  maxChallPriority += 1;

  const rows = items.map((item, idx) => [
    newId, item.type, item.who || '', item.name, item.piece, item.ref || '', item.barFrom || '', 
    item.barTo || '', item.bpm || '', 0, 0, 'To do', item.id ? item.challPriority : maxChallPriority, idx + 1
  ]);
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return newId;
}

function updateChallengeProgress(row, addTime, newStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  const currTime = Number(sheet.getRange(`J${row}`).getValue()) || 0;
  sheet.getRange(`J${row}`).setValue(currTime + Number(addTime));
  const currSess = Number(sheet.getRange(`K${row}`).getValue()) || 0;
  sheet.getRange(`K${row}`).setValue(currSess + 1);
  sheet.getRange(`L${row}`).setValue(newStatus);
  
  // NOTE: Deliberately avoiding saveRecord('Practise', ...) here so it doesn't double-log time.
  return true;
}

function updateChallengeItemDetails(row, piece, ref, barFrom, barTo, bpm) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  sheet.getRange(`E${row}:I${row}`).setValues([[piece, ref || '', barFrom || '', barTo || '', bpm || '']]);
  return true;
}

function deleteChallengeRow(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  sheet.getRange(`${row}:${row}`).clearContent(); 
  return true;
}

function deleteFullChallenge(challengeId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(challengeId)) {
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).clearContent();
    }
  }
  return true;
}

function updateChallengePriorities(orderedIds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    const priorityIndex = orderedIds.indexOf(id);
    if (priorityIndex !== -1) {
      sheet.getRange(i + 1, 13).setValue(priorityIndex + 1);
    }
  }
  return true;
}

function updateItemPriorities(orderedRows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHALLENGES_SHEET);
  orderedRows.forEach((row, idx) => {
    sheet.getRange(row, 14).setValue(idx + 1);
  });
  return true;
}