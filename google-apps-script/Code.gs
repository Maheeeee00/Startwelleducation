/**
 * ============================================================
 *  START WELL EDUCATION — Google Sheets backend (v2)
 * ============================================================
 *  ONE script for ALL website data. Paste it into
 *  Google Sheet -> Extensions -> Apps Script.
 *
 *  It sets up every tab and column automatically:
 *
 *  FORMS (website -> Sheet)
 *    Contact Enquiries  contact.html form
 *    Admissions         admissions.html online form, incl. student photo
 *                       + B-Form uploads (saved privately in Google Drive)
 *
 *  WEBSITE CONTENT (Sheet -> website)
 *    Gallery            photos shown on gallery.html
 *    News Ticker        moving bar on the home page
 *    Holidays           list on calendar.html
 *
 *  Menu in the Sheet:  Start Well Website ->
 *    • Set up / repair all tabs
 *    • Add photos from Drive "Website Gallery" folder
 *    • Refresh website now
 *
 *  Full step-by-step guide: GOOGLE-SHEETS-SETUP.txt
 * ============================================================
 */

// ---------- SETTINGS (you can change these) ----------
const NOTIFY_EMAIL = 'startwelleducation@gmail.com'; // receives an alert for each form submission
const SEND_EMAIL_ALERTS = true;                     // false = no alert emails
const SITE_URL = 'https://startwell.edu.pk/';       // used for photo previews in the Sheet
const TIMEZONE = 'Asia/Karachi';
const MAX_FIELD_LENGTH = 2000;                      // longer text is cut to this length
const MAX_UPLOAD_MB = 6;                            // largest file a parent can upload
const UPLOAD_FOLDER = 'Start Well Website Uploads'; // private Drive folder for admission files
const GALLERY_FOLDER = 'Start Well Website Gallery';// put gallery photos here, then use the menu
const CONTENT_CACHE_SECONDS = 600;                  // website content is cached; edits clear it instantly

const STATUS_OPTIONS = ['New', 'Contacted', 'In Progress', 'Admitted', 'Closed'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ---------- FORMS ----------
// fields: [form field name, column title].  files: [upload field name, column title].
// Add a field here (and in the website form) and a new column appears automatically.
const FORMS = {
  contact: {
    sheet: 'Contact Enquiries', prefix: 'ENQ', color: '#0f1f4b', title: 'New website enquiry',
    fields: [
      ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['subject', 'Enquiry About'],
      ['class', 'Class (if admission)'], ['message', 'Message'],
    ],
    files: [],
    required: ['name', 'phone', 'message'],
  },
  admission: {
    sheet: 'Admissions', prefix: 'ADM', color: '#f2711c', title: 'New online admission application',
    fields: [
      ['student_name', 'Student Name'], ['gender', 'Gender'], ['date_of_birth', 'Date of Birth'],
      ['class_applying', 'Class Applying For'], ['department', 'Department'],
      ['previous_school', 'Previous School'], ['guardian_name', 'Father / Guardian Name'],
      ['guardian_phone', 'Guardian Phone'], ['guardian_email', 'Guardian Email'],
      ['address', 'Home Address'], ['notes', 'Notes'],
    ],
    files: [['student_photo', 'Student Photo'], ['bform', 'B-Form / Birth Certificate']],
    required: ['student_name', 'class_applying', 'guardian_name', 'guardian_phone'],
  },
};
const LEAD_COLUMNS = ['Reference', 'Date & Time', 'Status'];
const TAIL_COLUMNS = ['Submitted From'];

// ---------- WEBSITE CONTENT TABS ----------
// Seed rows are the site's current content, so nothing changes on day one.
const CONTENT = {
  gallery: {
    sheet: 'Gallery', color: '#1f3a8a',
    headers: ['Show on Website', 'Preview', 'Image Link', 'Title', 'Category', 'Order'],
    note: 'Image Link: a Google Drive photo link (shared "Anyone with the link") or a website path like images/photo.jpg. Use the menu "Add photos from Drive" to fill this automatically.',
    seed: [
      ['Yes', '', 'images/group-photo.jpg', 'Students & Staff Together', 'Events', 1],
      ['Yes', '', 'images/principal-speech.jpg', 'Principal Addressing the Ceremony', 'Events', 2],
      ['Yes', '', 'images/back-to-school.jpg', 'Back to School', 'Students', 3],
      ['Yes', '', 'images/award-ceremony.jpg', 'Award Presentation', 'Events', 4],
      ['Yes', '', 'images/welcome-ceremony.jpg', 'Welcome Ceremony', 'Events', 5],
      ['Yes', '', 'images/guests-ceremony.jpg', 'Honourable Guests', 'Events', 6],
      ['Yes', '', 'images/guest-portrait.jpg', 'Sir Khalid Mehmood — Principal, Bhotosial Campus', 'People', 7],
      ['Yes', '', 'images/principal.jpg', 'Ali Hussnain — Principal', 'People', 8],
      ['Yes', '', 'images/logo.jpg', 'Our Emblem', 'People', 9],
    ],
  },
  news: {
    sheet: 'News Ticker', color: '#e2600d',
    headers: ['Show on Website', 'Headline', 'Link (page)', 'Order'],
    note: 'Each row is one headline in the moving bar on the home page. Link: a page like admissions.html (optional).',
    seed: [
      ['Yes', 'Admissions Open for Session 2026–27 — Playgroup to Class 10', 'admissions.html', 1],
      ['Yes', 'Start Well to End Well', 'aboutus.html', 2],
      ['Yes', 'Youm-e-Tasees AJK holiday — 24 October 2026', 'calendar.html', 3],
      ['Yes', 'Meet our Junior Media Team — student anchors & reporters', 'junior-media-team.html', 4],
      ['Yes', 'StartWell Spelling Bee — get ready to spell!', 'spelling-bee.html', 5],
      ['Yes', '4 Campuses · 40+ Qualified Teaching Staff', 'faculty.html', 6],
      ['Yes', 'Hifz Department — admissions open', 'admissions.html', 7],
      ['Yes', 'Follow us on TikTok @startwell.edu', 'online-activities.html', 8],
    ],
  },
  holidays: {
    sheet: 'Holidays', color: '#c62828',
    headers: ['Show on Website', 'Holiday', 'Date (as shown)', 'Last Day (date)'],
    note: '"Last Day" is a real date — the website greys out past holidays and highlights the next one automatically.',
    seed: [
      ['Yes', 'Kashmir Solidarity Day', '5 Feb 2026', '2026-02-05'],
      ['Yes', 'Pakistan Day', '23 Mar 2026', '2026-03-23'],
      ['Yes', 'Eid-ul-Fitr', '21–23 Mar 2026', '2026-03-23'],
      ['Yes', 'Labour Day', '1 May 2026', '2026-05-01'],
      ['Yes', 'Youm-e-Takbeer', '28 May 2026', '2026-05-28'],
      ['Yes', 'Eid-ul-Azha', '27–29 May 2026', '2026-05-29'],
      ['Yes', 'Ashura', '24–25 Jun 2026', '2026-06-25'],
      ['Yes', 'Youm-e-Shuhada-e-Kashmir', '13 Jul 2026', '2026-07-13'],
      ['Yes', 'Independence Day (Pakistan)', '14 Aug 2026', '2026-08-14'],
      ['Yes', 'Eid Milad-un-Nabi', '25 Aug 2026', '2026-08-25'],
      ['Yes', 'Yom-e-Istehsal', '8 Oct 2026', '2026-10-08'],
      ['Yes', 'Youm-e-Tasees AJK', '24 Oct 2026', '2026-10-24'],
      ['Yes', 'Allama Iqbal Day', '9 Nov 2026', '2026-11-09'],
      ['Yes', 'Quaid-e-Azam Day / Christmas', '25 Dec 2026', '2026-12-25'],
      ['Yes', 'Day after Christmas', '26 Dec 2026', '2026-12-26'],
    ],
  },
};

/* ============================================================
 *  WEB APP ENTRY POINTS
 * ============================================================ */

/** Website forms POST here. */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return json_({ ok: true, ref: 'OK' });          // spam trap

    const form = FORMS[p.form_type];
    if (!form) return json_({ ok: false, error: 'Unknown form.' });

    const missing = form.required.filter(k => !String(p[k] || '').trim());
    if (missing.length) {
      return json_({ ok: false, error: 'Please fill in: ' + missing.map(k => labelFor_(form, k)).join(', ') });
    }
    // Check uploads before saving anything
    for (const [key, title] of form.files) {
      const err = checkUpload_(p, key, title);
      if (err) return json_({ ok: false, error: err });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    let ref;
    try {
      const sheet = getFormSheet_(form);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      ref = form.prefix + '-' + String(sheet.getLastRow()).padStart(4, '0');

      const byTitle = {};
      form.fields.forEach(([key, title]) => (byTitle[title] = clean_(p[key])));
      byTitle['Reference'] = ref;
      byTitle['Date & Time'] = Utilities.formatDate(new Date(), TIMEZONE, 'dd MMM yyyy, hh:mm a');
      byTitle['Status'] = 'New';
      byTitle['Submitted From'] = clean_(p.page);

      sheet.appendRow(headers.map(h => (h in byTitle ? byTitle[h] : '')));
      const rowNum = sheet.getLastRow();
      sheet.getRange(rowNum, 1, 1, headers.length).setVerticalAlignment('middle');

      // Save uploads to Drive and put them in the row
      const who = clean_(p.student_name || p.name || '');
      form.files.forEach(([key, title]) => {
        if (!p['file_' + key]) return;
        const file = saveUpload_(p, key, form, ref, who);
        const fileCol = headers.indexOf(title + ' File') + 1;
        if (fileCol) sheet.getRange(rowNum, fileCol).setFormula('=HYPERLINK("' + file.getUrl() + '","Open ' + title.split(' /')[0] + '")');
        const picCol = headers.indexOf(title) + 1;
        if (picCol) placePreview_(sheet, rowNum, picCol, p, key, file, title);
      });
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

/** Website reads its content here:  WEB_APP_URL?action=content */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'content') {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('content');
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
    const out = JSON.stringify(buildContent_());
    try { cache.put('content', out, CONTENT_CACHE_SECONDS); } catch (x) { /* too big to cache */ }
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
  }
  return json_({ ok: true, service: 'Start Well Education website', forms: Object.keys(FORMS), content: Object.keys(CONTENT) });
}

/* ============================================================
 *  SHEET MENU, SETUP & TRIGGERS
 * ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Start Well Website')
    .addItem('Set up / repair all tabs', 'setup')
    .addItem('Add photos from Drive "Website Gallery" folder', 'importGalleryFromDrive')
    .addItem('Refresh website now', 'refreshWebsite')
    .addToUi();
}

/** Simple trigger: any edit in the Sheet updates the website immediately. */
function onEdit() {
  try { CacheService.getScriptCache().remove('content'); } catch (x) {}
}

/** Creates every tab and column. Safe to run again any time — it never deletes your data. */
function setup() {
  Object.keys(FORMS).forEach(k => getFormSheet_(FORMS[k]));
  Object.keys(CONTENT).forEach(k => getContentSheet_(CONTENT[k]));
  ensureFolder_(UPLOAD_FOLDER);
  ensureFolder_(GALLERY_FOLDER);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  refreshWebsite();
  safeAlert_('All tabs and columns are ready.\n\nNext: Deploy → New deployment → Web app (see the setup guide).');
}

function refreshWebsite() {
  try { CacheService.getScriptCache().remove('content'); } catch (x) {}
}

/**
 * Menu: adds every photo in the Drive folder "Start Well Website Gallery"
 * to the Gallery tab (skips ones already added) and makes them viewable on the website.
 */
function importGalleryFromDrive() {
  const cfg = CONTENT.gallery;
  const sheet = getContentSheet_(cfg);
  const folder = ensureFolder_(GALLERY_FOLDER);
  const linkCol = cfg.headers.indexOf('Image Link');
  const existing = sheet.getLastRow() > 1
    ? sheet.getRange(2, linkCol + 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0]))
    : [];
  const have = id => existing.some(v => v.indexOf(id) !== -1);
  let order = sheet.getLastRow();
  let added = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (String(f.getMimeType()).indexOf('image/') !== 0 || have(f.getId())) continue;
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { console.warn(x); }
    const title = f.getName().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    sheet.appendRow(['Yes', '', 'https://drive.google.com/file/d/' + f.getId() + '/view', title, 'Events', order++]);
    added++;
  }
  addPreviewFormulas_(sheet, cfg);
  refreshWebsite();
  safeAlert_(added ? added + ' photo(s) added to the Gallery tab. Edit their Title and Category if you like.'
                   : 'No new photos found in the Drive folder "' + GALLERY_FOLDER + '".');
}

/* ============================================================
 *  TAB / COLUMN SET-UP HELPERS
 * ============================================================ */

/** Form tab: creates it, or adds any missing columns without touching old data. */
function getFormSheet_(form) {
  const wanted = LEAD_COLUMNS.concat(
    form.files.map(f => f[1]),                       // photo preview column(s) near the front
    form.fields.map(f => f[1]),
    form.files.map(f => f[1] + ' File'),
    TAIL_COLUMNS
  );
  const isNew = !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(form.sheet);
  const sheet = ensureColumns_(form.sheet, wanted, form.color);
  if (isNew) {
    sheet.setFrozenColumns(1);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
    sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  return sheet;
}

/** Content tab: creates it with sample rows the first time. */
function getContentSheet_(cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const isNew = !ss.getSheetByName(cfg.sheet);
  const sheet = ensureColumns_(cfg.sheet, cfg.headers, cfg.color);
  if (isNew) {
    if (cfg.seed.length) sheet.getRange(2, 1, cfg.seed.length, cfg.headers.length).setValues(cfg.seed);
    sheet.getRange(1, 1).setNote(cfg.note);
    const yesNo = SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).build();
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setDataValidation(yesNo);
    if (cfg === CONTENT.gallery) {
      const cats = SpreadsheetApp.newDataValidation().requireValueInList(['Events', 'Students', 'People', 'Campus', 'Sports'], false).build();
      sheet.getRange(2, cfg.headers.indexOf('Category') + 1, sheet.getMaxRows() - 1, 1).setDataValidation(cats);
      addPreviewFormulas_(sheet, cfg);
    }
    if (cfg === CONTENT.holidays) {
      sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
    }
  }
  return sheet;
}

/** Makes sure a tab exists with these columns (adds missing ones at the end). */
function ensureColumns_(name, wanted, color) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, wanted.length).setValues([wanted]);
    styleHeader_(sheet, wanted.length, color);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
  const toAdd = wanted.filter(h => existing.indexOf(h) === -1);
  if (toAdd.length) {
    sheet.getRange(1, existing.length + 1, 1, toAdd.length).setValues([toAdd]);
    styleHeader_(sheet, existing.length + toAdd.length, color);
  }
  return sheet;
}

function styleHeader_(sheet, cols, color) {
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setFontColor('#ffffff').setBackground(color)
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, cols, 160);
}

/** Gallery "Preview" column: shows each photo inside the Sheet. */
function addPreviewFormulas_(sheet, cfg) {
  const prevCol = cfg.headers.indexOf('Preview') + 1;
  const linkCol = cfg.headers.indexOf('Image Link') + 1;
  const last = sheet.getLastRow();
  if (!prevCol || last < 2) return;
  const formulas = [];
  for (let r = 2; r <= last; r++) {
    const L = columnLetter_(linkCol) + r;
    formulas.push(['=IF(' + L + '="","",IMAGE(IF(REGEXMATCH(' + L + ',"/d/([\\w-]{20,})"),' +
      '"https://lh3.googleusercontent.com/d/"&REGEXEXTRACT(' + L + ',"/d/([\\w-]{20,})")&"=w400",' +
      'IF(REGEXMATCH(' + L + ',"^https?://"),' + L + ',"' + SITE_URL + '"&' + L + '))))']);
  }
  sheet.getRange(2, prevCol, formulas.length, 1).setFormulas(formulas);
  sheet.setColumnWidth(prevCol, 110);
  sheet.setRowHeights(2, last - 1, 70);
}

/* ============================================================
 *  CONTENT FOR THE WEBSITE
 * ============================================================ */

function buildContent_() {
  const rows = cfg => {
    const sheet = getContentSheet_(cfg);
    const last = sheet.getLastRow();
    if (last < 2) return [];
    const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return sheet.getRange(2, 1, last - 1, head.length).getValues()
      .map(r => { const o = {}; head.forEach((h, i) => (o[h] = r[i])); return o; })
      .filter(o => String(o['Show on Website']).trim().toLowerCase() !== 'no');
  };
  const ord = v => (v === '' || v == null || isNaN(Number(v)) ? 9999 : Number(v));
  const byOrder = (a, b) => ord(a.Order) - ord(b.Order);

  const gallery = rows(CONTENT.gallery).filter(o => String(o['Image Link']).trim()).sort(byOrder)
    .map(o => ({ src: imageUrl_(o['Image Link']), title: String(o.Title || ''), category: String(o.Category || 'Events') }));
  const news = rows(CONTENT.news).filter(o => String(o.Headline).trim()).sort(byOrder)
    .map(o => ({ text: String(o.Headline), link: String(o['Link (page)'] || '') }));
  const holidays = rows(CONTENT.holidays).filter(o => String(o.Holiday).trim())
    .map(o => ({ name: String(o.Holiday), when: String(o['Date (as shown)'] || ''), end: isoDate_(o['Last Day (date)']) }))
    .sort((a, b) => (a.end || '9999').localeCompare(b.end || '9999'));
  return { ok: true, updated: new Date().toISOString(), gallery, news, holidays };
}

/** Turns a Google Drive share link into a direct image link the website can show. */
function imageUrl_(link) {
  const s = String(link).trim();
  const m = s.match(/(?:\/d\/|[?&]id=)([\w-]{20,})/);
  if (m && /google\.com/.test(s)) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w1600';
  return s;
}

function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/* ============================================================
 *  UPLOAD HELPERS (admission photo / B-Form)
 * ============================================================ */

function checkUpload_(p, key, title) {
  const data = p['file_' + key];
  if (!data) return '';
  const type = String(p['file_' + key + '_type'] || '');
  if (ALLOWED_TYPES.indexOf(type) === -1) return title + ': please upload a photo (JPG/PNG) or PDF.';
  if (data.length * 0.75 > MAX_UPLOAD_MB * 1024 * 1024) return title + ': file is too large (max ' + MAX_UPLOAD_MB + ' MB).';
  return '';
}

/** Saves an upload privately in Drive: Start Well Website Uploads / Admissions / ADM-0001 Name / file */
function saveUpload_(p, key, form, ref, who) {
  const type = String(p['file_' + key + '_type']);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[type];
  const root = ensureFolder_(UPLOAD_FOLDER);
  const formFolder = subFolder_(root, form.sheet);
  const folder = subFolder_(formFolder, (ref + ' ' + who).trim().slice(0, 80));
  const blob = Utilities.newBlob(Utilities.base64Decode(p['file_' + key]), type, key + '.' + ext);
  return folder.createFile(blob);   // private: only you (and people you share the folder with)
}

/** Shows the student photo inside the cell (private — not shared publicly). Falls back to a link. */
function placePreview_(sheet, row, col, p, key, file, title) {
  const thumb = String(p['thumb_' + key] || '');
  const cell = sheet.getRange(row, col);
  if (/^data:image\/(jpeg|png|webp);base64,/.test(thumb) && thumb.length < 60000) {
    try {
      const img = SpreadsheetApp.newCellImage().setSourceUrl(thumb).setAltTextTitle(title).build();
      cell.setValue(img);
      sheet.setRowHeight(row, 80);
      return;
    } catch (x) { console.warn('Cell image failed, using link', x); }
  }
  cell.setFormula('=HYPERLINK("' + file.getUrl() + '","View")');
}

function ensureFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ============================================================
 *  GENERAL HELPERS
 * ============================================================ */

function sendAlert_(form, p, ref) {
  const rows = form.fields
    .filter(([key]) => String(p[key] || '').trim())
    .map(([key, title]) =>
      '<tr><td style="padding:8px 12px;background:#f6f4ef;font-weight:bold;width:180px">' + esc_(title) +
      '</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + esc_(clean_(p[key])).replace(/\n/g, '<br>') + '</td></tr>')
    .join('');
  const uploads = form.files.filter(([key]) => p['file_' + key]).map(f => f[1]);
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:620px">' +
    '<div style="background:' + form.color + ';color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
    '<b style="font-size:18px">' + esc_(form.title) + '</b><br><span style="opacity:.85">Reference ' + ref + '</span></div>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    (uploads.length ? '<p>📎 Uploaded: ' + esc_(uploads.join(', ')) + ' (saved in Google Drive → ' + esc_(UPLOAD_FOLDER) + ')</p>' : '') +
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

function columnLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeAlert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

/* ============================================================
 *  OPTIONAL TEST — adds one sample row to each form tab
 * ============================================================ */
function testSubmission() {
  // 1x1 orange pixel as a sample "photo"
  const px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  doPost({ parameter: { form_type: 'contact', name: 'Test Parent', phone: '0300 0000000', subject: 'Admission', class: 'Prep', message: 'This is a test from setup.', page: 'Apps Script test' } });
  doPost({ parameter: { form_type: 'admission', student_name: 'Test Student', gender: 'Male', date_of_birth: '2019-05-01', class_applying: 'Class 1', department: 'Regular', guardian_name: 'Test Guardian', guardian_phone: '0300 0000000', page: 'Apps Script test',
    file_student_photo: px, file_student_photo_type: 'image/png', thumb_student_photo: 'data:image/png;base64,' + px } });
}
