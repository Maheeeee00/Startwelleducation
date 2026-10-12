/**
 * ============================================================
 *  START WELL EDUCATION — Google Sheets backend
 * ============================================================
 *  One script that saves EVERY form on the website into this
 *  Google Sheet (one tab per form) and emails the school.
 *
 *  Forms handled:
 *    contact    -> tab "Contact Enquiries"   (contact.html)
 *    admission  -> tab "Admissions"          (admissions.html)
 *
 *  SETUP (full guide in GOOGLE-SHEETS-SETUP.txt):
 *    1. Create a Google Sheet -> Extensions -> Apps Script
 *    2. Paste this whole file into Code.gs and Save
 *    3. Run the function  setup  once (allow permissions)
 *    4. Deploy -> New deployment -> Web app
 *         Execute as: Me      Who has access: Anyone
 *    5. Copy the Web app URL into  js/config.js  on the website
 * ============================================================
 */

// ---------- SETTINGS (you can change these) ----------
const NOTIFY_EMAIL = 'startwelleducation@gmail.com'; // who receives an alert for each submission
const SEND_EMAIL_ALERTS = true;                     // set to false to stop alert emails
const TIMEZONE = 'Asia/Karachi';
const MAX_FIELD_LENGTH = 2000;                      // longer text is cut to this length

// Status choices shown as a drop-down in every tab, for staff to track follow-up
const STATUS_OPTIONS = ['New', 'Contacted', 'In Progress', 'Admitted', 'Closed'];

// ---------- FORMS ----------
// Each form: the tab it saves to, its columns (field name -> column title),
// and which fields are required. Add a new form here and it just works.
const FORMS = {
  contact: {
    sheet: 'Contact Enquiries',
    prefix: 'ENQ',
    color: '#0f1f4b',
    title: 'New website enquiry',
    fields: [
      ['name', 'Name'],
      ['phone', 'Phone'],
      ['email', 'Email'],
      ['subject', 'Enquiry About'],
      ['class', 'Class (if admission)'],
      ['message', 'Message'],
    ],
    required: ['name', 'phone', 'message'],
  },
  admission: {
    sheet: 'Admissions',
    prefix: 'ADM',
    color: '#f2711c',
    title: 'New online admission application',
    fields: [
      ['student_name', 'Student Name'],
      ['gender', 'Gender'],
      ['date_of_birth', 'Date of Birth'],
      ['class_applying', 'Class Applying For'],
      ['department', 'Department'],
      ['previous_school', 'Previous School'],
      ['guardian_name', 'Father / Guardian Name'],
      ['guardian_phone', 'Guardian Phone'],
      ['guardian_email', 'Guardian Email'],
      ['address', 'Home Address'],
      ['notes', 'Notes'],
    ],
    required: ['student_name', 'class_applying', 'guardian_name', 'guardian_phone'],
  },
};

// Columns added automatically to every tab
const LEAD_COLUMNS = ['Reference', 'Date & Time', 'Status'];
const TAIL_COLUMNS = ['Submitted From'];

/* ============================================================
 *  WEB APP ENTRY POINTS
 * ============================================================ */

/** Website forms POST here. */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Spam trap: real visitors never fill this hidden field
    if (p.website) return json_({ ok: true, ref: 'OK' });

    const form = FORMS[p.form_type];
    if (!form) return json_({ ok: false, error: 'Unknown form.' });

    const missing = form.required.filter(k => !String(p[k] || '').trim());
    if (missing.length) {
      const names = missing.map(k => labelFor_(form, k)).join(', ');
      return json_({ ok: false, error: 'Please fill in: ' + names });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);                     // avoid two submissions writing the same row
    let ref;
    try {
      const sheet = getSheet_(form);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      ref = form.prefix + '-' + String(sheet.getLastRow()).padStart(4, '0');
      const now = Utilities.formatDate(new Date(), TIMEZONE, 'dd MMM yyyy, hh:mm a');

      const byTitle = {};
      form.fields.forEach(([key, title]) => (byTitle[title] = clean_(p[key])));
      byTitle['Reference'] = ref;
      byTitle['Date & Time'] = now;
      byTitle['Status'] = 'New';
      byTitle['Submitted From'] = clean_(p.page);

      const row = headers.map(h => (h in byTitle ? byTitle[h] : ''));
      sheet.appendRow(row);
      sheet.getRange(sheet.getLastRow(), 1, 1, row.length).setVerticalAlignment('top');
    } finally {
      lock.releaseLock();
    }

    if (SEND_EMAIL_ALERTS) {
      try { sendAlert_(form, p, ref); } catch (mailErr) { console.error(mailErr); }
    }

    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error. Please try again or call us.' });
  }
}

/** Opening the Web app URL in a browser shows this — handy to confirm it is live. */
function doGet() {
  return json_({ ok: true, service: 'Start Well Education forms', forms: Object.keys(FORMS) });
}

/* ============================================================
 *  ONE-TIME SETUP — run this once from the Apps Script editor
 * ============================================================ */
function setup() {
  Object.keys(FORMS).forEach(k => getSheet_(FORMS[k]));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  SpreadsheetApp.getUi && safeAlert_('Setup complete. Tabs are ready. Now Deploy → New deployment → Web app.');
}

/* ============================================================
 *  HELPERS
 * ============================================================ */

/** Returns the tab for a form, creating and formatting it if needed. */
function getSheet_(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(form.sheet);
  const wanted = LEAD_COLUMNS.concat(form.fields.map(f => f[1]), TAIL_COLUMNS);

  if (!sheet) {
    sheet = ss.insertSheet(form.sheet);
    sheet.getRange(1, 1, 1, wanted.length).setValues([wanted]);
    styleSheet_(sheet, form, wanted.length);
    return sheet;
  }

  // Add any new columns (e.g. a field added to FORMS later) without touching old data
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
  const toAdd = wanted.filter(h => existing.indexOf(h) === -1);
  if (toAdd.length) {
    sheet.getRange(1, existing.length + 1, 1, toAdd.length).setValues([toAdd]);
    styleSheet_(sheet, form, existing.length + toAdd.length);
  }
  return sheet;
}

function styleSheet_(sheet, form, cols) {
  sheet.getRange(1, 1, 1, cols)
    .setFontWeight('bold').setFontColor('#ffffff').setBackground(form.color)
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidths(1, cols, 170);
  // Status drop-down for the whole column
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

/** Emails the school a neat summary; Reply goes straight to the parent if they gave an email. */
function sendAlert_(form, p, ref) {
  const rows = form.fields
    .filter(([key]) => String(p[key] || '').trim())
    .map(([key, title]) =>
      '<tr><td style="padding:8px 12px;background:#f6f4ef;font-weight:bold;width:180px">' + esc_(title) +
      '</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + esc_(clean_(p[key])).replace(/\n/g, '<br>') + '</td></tr>')
    .join('');
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:620px">' +
    '<div style="background:' + form.color + ';color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
    '<b style="font-size:18px">' + esc_(form.title) + '</b><br><span style="opacity:.85">Reference ' + ref + '</span></div>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    '<p style="margin-top:18px"><a href="' + sheetUrl + '" style="background:#f2711c;color:#fff;padding:10px 18px;border-radius:20px;text-decoration:none">Open Google Sheet</a></p>' +
    '<p style="color:#888;font-size:12px">Sent automatically by the Start Well Education website.</p></div>';

  const replyTo = [p.email, p.guardian_email].find(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()));
  const who = p.name || p.student_name || '';
  const options = { htmlBody: html, name: 'Start Well Website' };
  if (replyTo) options.replyTo = String(replyTo).trim();
  MailApp.sendEmail(NOTIFY_EMAIL, '[' + ref + '] ' + form.title + (who ? ' — ' + clean_(who) : ''), 'See HTML version.', options);
}

/** Trims, limits length and blocks spreadsheet-formula injection (=, +, -, @). */
function clean_(v) {
  let s = String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim();
  if (s.length > MAX_FIELD_LENGTH) s = s.slice(0, MAX_FIELD_LENGTH) + '…';
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function labelFor_(form, key) {
  const f = form.fields.find(x => x[0] === key);
  return f ? f[1] : key;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeAlert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

/* ============================================================
 *  OPTIONAL: run testSubmission once to check everything works
 *  (adds one sample row to each tab and sends sample emails)
 * ============================================================ */
function testSubmission() {
  doPost({ parameter: { form_type: 'contact', name: 'Test Parent', phone: '0300 0000000', email: '', subject: 'Admission', class: 'Prep', message: 'This is a test from setup.', page: 'Apps Script test' } });
  doPost({ parameter: { form_type: 'admission', student_name: 'Test Student', gender: 'Male', date_of_birth: '2019-05-01', class_applying: 'Class 1', department: 'Regular', guardian_name: 'Test Guardian', guardian_phone: '0300 0000000', page: 'Apps Script test' } });
}
