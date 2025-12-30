/**
 * ระบบจัดการจองโต๊ะ บ้านไร่ริมเขื่อน
 * Google Sheet ID: 1sCEITK6m2tivkQt6wgPXSMnr5aEMRJQ8i6APP98pu60
 */

const SPREADSHEET_ID = "1sCEITK6m2tivkQt6wgPXSMnr5aEMRJQ8i6APP98pu60";
const SHEET_NAME = "Bookings";

// 1. ส่วนรับคำสั่งจาก Browser (GET)
function doGet(e) {
  const action = e.parameter.action;
  const dateStr = e.parameter.date;

  // ถ้าเป็นการขอข้อมูลโต๊ะ
  if (action === 'get_data' && dateStr) {
    const data = getDataByDate(dateStr);
    return createResponse(data);
  }

  // ถ้าเป็นการเปิดหน้าเว็บปกติ
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('บ้านไร่ริมเขื่อน - ระบบจัดการโต๊ะ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 2. ส่วนรับคำสั่งบันทึก/แก้ไขข้อมูล (POST)
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (action === 'save_booking') {
      return createResponse(saveBooking(requestData));
    }
    
    if (action === 'update_status') {
      const { tableNo, date, status } = requestData;
      return createResponse(updateTableStatus(tableNo, date, status));
    }
  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}

// --- ฟังก์ชันจัดการข้อมูล (Internal Functions) ---

function getDataByDate(dateStr) {
  const sheet = getOrSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1)
    .filter(row => {
      const rowDate = Utilities.formatDate(new Date(row[3]), "GMT+7", "yyyy-MM-dd");
      return rowDate === dateStr;
    })
    .map(row => ({
      name: row[1],
      phone: row[2],
      date: dateStr,
      time: row[4],
      people: row[5],
      table: row[6],
      zone: row[7],
      note: row[8],
      status: row[9] || 'reserved'
    }));
}

function saveBooking(data) {
  const sheet = getOrSheet();
  sheet.appendRow([
    new Date(),        // Timestamp
    data.name,         // Name
    "'" + data.phone,  // Phone (กัน Excel ตัดเลข 0)
    data.date,         // Date
    data.time,         // Time
    data.people,       // People
    data.table,        // Table No
    data.zone,         // Zone
    data.note || '',   // Note
    'reserved'         // Status เริ่มต้น
  ]);
  return { success: true, message: "บันทึกการจองสำเร็จ" };
}

function updateTableStatus(tableNo, dateStr, newStatus) {
  const sheet = getOrSheet();
  const data = sheet.getDataRange().getValues();
  
  // ค้นหาจากแถวล่างขึ้นบน (เพื่อเจอข้อมูลล่าสุดก่อน)
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = Utilities.formatDate(new Date(data[i][3]), "GMT+7", "yyyy-MM-dd");
    const rowTable = data[i][6];

    if (rowDate === dateStr && rowTable === tableNo) {
      if (newStatus === 'available') {
        // หากสั่งให้ว่าง (ล้างโต๊ะ) ให้ลบแถวนั้นทิ้ง
        sheet.deleteRow(i + 1);
      } else {
        // หากสั่งเปลี่ยนสถานะ (เช่น Check-in เป็น occupied)
        sheet.getRange(i + 1, 10).setValue(newStatus);
      }
      return { success: true };
    }
  }
  return { success: false, message: "ไม่พบข้อมูลโต๊ะ" };
}

// ฟังก์ชันสร้าง/ดึงชีต
function getOrSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Date', 'Time', 'People', 'Table', 'Zone', 'Note', 'Status']);
  }
  return sheet;
}

// ฟังก์ชันส่ง Response กลับไปที่หน้าเว็บ
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
