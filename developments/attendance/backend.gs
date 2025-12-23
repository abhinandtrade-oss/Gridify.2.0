/**
 * Attendance System Backend for Gridify
 * Features: Punch In/Out, Face Image Storage (Drive), Attendance Logic, Admin Edits
 */

const SHEET_NAME = 'Attendance';
const DRIVE_FOLDER_ID = '1537n9TAwBX-CQL8Do78VAZ046nLh4NW_'; // User provided folder ID

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'punch') {
      return ContentService.createTextOutput(JSON.stringify(handlePunch(data)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'fetch_user_attendance') {
      return ContentService.createTextOutput(JSON.stringify(fetchUserAttendance(data)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'fetch_all_attendance') {
      return ContentService.createTextOutput(JSON.stringify(fetchAllAttendance(data)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'edit_attendance') {
      return ContentService.createTextOutput(JSON.stringify(editAttendance(data)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'finalize_attendance') {
      return ContentService.createTextOutput(JSON.stringify(finalizeAttendance(data)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handlePunch(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'User ID', 'User Name', 'Date', 'Punch In Time', 'Punch Out Time', 
      'Total Work Duration', 'Attendance Status', 'Punch In Image URL', 
      'Punch Out Image URL', 'Edited By', 'Last Modified Timestamp'
    ]);
  }

  const { userId, userName, punchType, imageBase64 } = data;
  const targetUserId = userId.toString().trim().toLowerCase();
  
  const today = new Date();
  const dateStr = Utilities.formatDate(today, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(today, ss.getSpreadsheetTimeZone(), 'HH:mm:ss');

  // Find existing record for today
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    const sheetUserId = rows[i][0].toString().trim().toLowerCase();
    
    // Normalize date from spreadsheet
    let sheetDate = '';
    try {
      if (rows[i][2] instanceof Date) {
        sheetDate = Utilities.formatDate(rows[i][2], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      } else {
        const parsedDate = new Date(rows[i][2]);
        if (!isNaN(parsedDate.getTime())) {
          sheetDate = Utilities.formatDate(parsedDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
        } else {
          sheetDate = rows[i][2].toString();
        }
      }
    } catch(e) {
      sheetDate = rows[i][2].toString();
    }

    if (sheetUserId === targetUserId && sheetDate === dateStr) {
      rowIndex = i + 1;
      break;
    }
  }

  // Upload image to Drive
  const imageUrl = uploadImage(imageBase64, `${userId}_${punchType}_${dateStr}`);

  if (punchType === 'IN') {
    if (rowIndex !== -1) {
      return { success: false, message: 'Already punched in for today (' + dateStr + ').' };
    }
    sheet.appendRow([
      userId, userName, dateStr, timeStr, '', '', 'Incomplete', imageUrl, '', '', new Date()
    ]);
    return { success: true, message: 'Punch In successful', time: timeStr };
  } else if (punchType === 'OUT') {
    if (rowIndex === -1) {
      return { 
        success: false, 
        message: 'No Punch In found for today. Searched for User: "' + userId + '" and Date: "' + dateStr + '". Please check if your "Punch In" was successful.' 
      };
    }
    const rowData = rows[rowIndex - 1];
    if (rowData[4]) {
      return { success: false, message: 'Already punched out for today' };
    }

    const inTime = rowData[3];
    const duration = calculateDuration(inTime, timeStr);

    sheet.getRange(rowIndex, 5).setValue(timeStr);
    sheet.getRange(rowIndex, 6).setValue(duration);
    sheet.getRange(rowIndex, 7).setValue('Present');
    sheet.getRange(rowIndex, 9).setValue(imageUrl);
    sheet.getRange(rowIndex, 11).setValue(new Date());

    return { success: true, message: 'Punch Out successful', time: timeStr, duration: duration };
  }
}

function uploadImage(base64, filename) {
  try {
    if (!base64) return '';
    const contentType = base64.substring(base64.indexOf(":") + 1, base64.indexOf(";"));
    const bytes = Utilities.base64Decode(base64.split(",")[1]);
    const blob = Utilities.newBlob(bytes, contentType, filename + ".jpg");
    
    let folder;
    if (DRIVE_FOLDER_ID) {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } else {
      folder = DriveApp.getRootFolder();
    }
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // High-res thumbnail link is more reliable for direct embedding in <img> tags
    return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';
  } catch (e) {
    return 'Error uploading: ' + e.message;
  }
}

function calculateDuration(start, end) {
  if (start instanceof Date) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    start = Utilities.formatDate(start, ss.getSpreadsheetTimeZone(), 'HH:mm:ss');
  }
  if (end instanceof Date) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    end = Utilities.formatDate(end, ss.getSpreadsheetTimeZone(), 'HH:mm:ss');
  }

  if (!start || !end || typeof start !== 'string' || typeof end !== 'string') return '--';

  const s = start.split(':');
  const e = end.split(':');
  if (s.length < 2 || e.length < 2) return '--';

  const startDate = new Date(0, 0, 0, s[0], s[1], s[2] || 0);
  const endDate = new Date(0, 0, 0, e[0], e[1], e[2] || 0);
  let diff = endDate.getTime() - startDate.getTime();
  
  if (diff < 0) return '0h 0m'; // Handle overnight shifts if needed

  const hours = Math.floor(diff / 1000 / 60 / 60);
  diff -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diff / 1000 / 60);
  
  return `${hours}h ${minutes}m`;
}

function fetchUserAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: true, data: [] };

  const { userId } = data;
  const rows = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == userId) {
      results.push({
        userId: rows[i][0],
        userName: rows[i][1],
        date: rows[i][2],
        inTime: rows[i][3],
        outTime: rows[i][4],
        duration: rows[i][5],
        status: rows[i][6],
        inImage: rows[i][7],
        outImage: rows[i][8]
      });
    }
  }
  return { success: true, data: results.reverse() };
}

function fetchAllAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: true, data: [] };

  const rows = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < rows.length; i++) {
    results.push({
      userId: rows[i][0],
      userName: rows[i][1],
      date: rows[i][2],
      inTime: rows[i][3],
      outTime: rows[i][4],
      duration: rows[i][5],
      status: rows[i][6],
      inImage: rows[i][7],
      outImage: rows[i][8],
      editedBy: rows[i][9],
      lastModified: rows[i][10]
    });
  }
  return { success: true, data: results.reverse() };
}

function editAttendance(data) {
  if (!data) return { success: false, message: 'No data provided to editAttendance' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, message: 'Sheet not found' };

  const { userId, date, newInTime, newOutTime, newStatus, adminName } = data;
  const targetUserId = userId.toString().trim().toLowerCase();
  
  // Normalize target date from data
  let targetDate = '';
  try {
    const d = new Date(date);
    targetDate = Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  } catch(e) {
    targetDate = date.toString().split('T')[0];
  }

  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    const sheetUserId = rows[i][0].toString().trim().toLowerCase();
    
    // Normalize date from spreadsheet
    let sheetDate = '';
    try {
      if (rows[i][2] instanceof Date) {
        sheetDate = Utilities.formatDate(rows[i][2], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      } else {
        const parsedDate = new Date(rows[i][2]);
        sheetDate = !isNaN(parsedDate.getTime()) ? 
          Utilities.formatDate(parsedDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : 
          rows[i][2].toString();
      }
    } catch(e) {
      sheetDate = rows[i][2].toString();
    }
    
    if (sheetUserId === targetUserId && sheetDate === targetDate) {
      const rowIndex = i + 1;
      
      const finalInTime = newInTime || rows[i][3];
      const finalOutTime = newOutTime || rows[i][4];
      
      let duration = '--';
      if (finalInTime && finalOutTime) {
        duration = calculateDuration(finalInTime, finalOutTime);
      }

      sheet.getRange(rowIndex, 4).setValue(finalInTime);
      sheet.getRange(rowIndex, 5).setValue(finalOutTime);
      sheet.getRange(rowIndex, 6).setValue(duration);
      sheet.getRange(rowIndex, 7).setValue(newStatus || rows[i][6]);
      sheet.getRange(rowIndex, 10).setValue(adminName);
      sheet.getRange(rowIndex, 11).setValue(new Date());

      return { success: true, message: 'Record updated successfully' };
    }
  }
  return { success: false, message: 'Record not found for user ' + userId + ' on ' + targetDate };
}

function finalizeAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, message: 'Sheet not found' };

  const { date } = data; // Target date to finalize
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    const rowDate = rows[i][2] instanceof Date ? Utilities.formatDate(rows[i][2], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : rows[i][2];
    if (rowDate == date) {
      if (rows[i][6] == 'Incomplete') {
        sheet.getRange(i + 1, 7).setValue('Leave');
      }
    }
  }
  return { success: true, message: 'Attendance finalized for ' + date };
}
