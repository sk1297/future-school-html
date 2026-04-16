const SHEET_NAME = 'Admissions';
const NOTIFY_EMAIL = 'swapnilks1297@gmail.com';

const SCHOOL_NAME = 'Future Pre-Primary School';
const SCHOOL_NAME_MR = 'फ्युचर प्री-प्रायमरी स्कूल';
const SCHOOL_TAGLINE = 'First Digital School in Dhule';
const ADMISSION_YEAR = '2026-27';
const SCHOOL_PHONE = '8830507689';
const SCHOOL_ALT_PHONE = '8830507869';
const SCHOOL_WHATSAPP = '918830507689';
const SCHOOL_ADDRESS = '94, Satya Sai Baba Society, Sakri Road, Dhule - 424001';
const SCHOOL_HOURS = 'Mon-Sat: 9:00 AM - 5:00 PM';
const SCHOOL_WEBSITE = ''; // TODO: Set your actual website URL after deployment, e.g. 'https://futureschooldhule.in'
// Email clients can only load publicly accessible logo URLs (local file paths won't work in email).
// Use your hosted logo URL after site deployment, for example: https://yourdomain.com/logo.png.jpeg
const SCHOOL_LOGO_URL = '';

const BRAND_PRIMARY = '#0f766e';
const BRAND_ACCENT = '#ff7a59';
const BRAND_BG = '#f8fbff';

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const clean = normalizeData_(data);
    const receivedAt = new Date();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss, SHEET_NAME);
    ensureHeader_(sheet);
    sheet.appendRow(toSheetRow_(clean, receivedAt));

    sendAdminNotification_(clean, receivedAt);
    sendParentAutoReply_(clean, receivedAt);

    return jsonResponse_({ ok: true, message: 'Saved successfully' });
  } catch (err) {
    return jsonResponse_({ ok: false, message: String(err) });
  }
}

function normalizeData_(data) {
  return {
    parentName: value_(data.parentName),
    phone: value_(data.phone),
    email: value_(data.email),
    childName: value_(data.childName),
    dob: value_(data.dob),
    program: formatProgram_(value_(data.program)),
    startDate: value_(data.startDate),
    visitDate: value_(data.visitDate),
    source: formatSource_(value_(data.source)),
    comments: value_(data.comments),
    sourcePage: value_(data.sourcePage),
    submittedAt: value_(data.submittedAt),
  };
}

function toSheetRow_(data, receivedAt) {
  return [
    receivedAt,
    data.parentName,
    data.phone,
    data.email,
    data.childName,
    data.dob,
    data.program,
    data.startDate,
    data.visitDate,
    data.source,
    data.comments,
    data.sourcePage,
    data.submittedAt,
  ];
}

function sendAdminNotification_(data, receivedAt) {
  if (!isValidEmail_(NOTIFY_EMAIL) || NOTIFY_EMAIL === 'your-email@example.com') return;

  const subject = 'New Admission Enquiry (' + ADMISSION_YEAR + ') - ' + SCHOOL_NAME;
  const textBody = [
    'New admission enquiry received.',
    '',
    'Parent/Guardian Name: ' + safeDash_(data.parentName),
    'Phone: ' + safeDash_(data.phone),
    'Email: ' + safeDash_(data.email),
    'Child Name: ' + safeDash_(data.childName),
    'Child DOB: ' + safeDash_(data.dob),
    'Program Interest: ' + safeDash_(data.program),
    'Preferred Start Date: ' + safeDash_(data.startDate),
    'Preferred Visit Date: ' + safeDash_(data.visitDate),
    'Lead Source: ' + safeDash_(data.source),
    'Comments: ' + safeDash_(data.comments),
    '',
    'Page URL: ' + safeDash_(data.sourcePage),
    'Submitted At (browser): ' + safeDash_(data.submittedAt),
    'Received At (server): ' + receivedAt.toISOString(),
  ].join('\n');

  const htmlBody = [
    '<div style="font-family:Segoe UI,Arial,sans-serif;background:' + BRAND_BG + ';padding:24px;color:#0f172a;">',
    '<div style="max-width:760px;margin:0 auto;border:1px solid #dbe7f2;border-radius:14px;background:#ffffff;overflow:hidden;">',
    '<div style="background:linear-gradient(120deg,' + BRAND_PRIMARY + ',' + BRAND_ACCENT + ');padding:18px 22px;color:#ffffff;">',
    logoHtml_(),
    '<h2 style="margin:10px 0 2px;font-size:22px;">New Admission Enquiry</h2>',
    '<div style="opacity:0.95;font-size:13px;">' + escapeHtml_(SCHOOL_TAGLINE) + '</div>',
    '<div style="opacity:0.95;font-size:13px;">Academic Year: ' + escapeHtml_(ADMISSION_YEAR) + '</div>',
    '</div>',
    '<div style="padding:18px 22px;">',
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">',
    rowHtml_('Parent/Guardian Name', data.parentName),
    rowHtml_('Phone', data.phone),
    rowHtml_('Email', data.email),
    rowHtml_('Child Name', data.childName),
    rowHtml_('Child DOB', data.dob),
    rowHtml_('Program Interest', data.program),
    rowHtml_('Preferred Start Date', data.startDate),
    rowHtml_('Preferred Visit Date', data.visitDate),
    rowHtml_('Lead Source', data.source),
    rowHtml_('Comments', data.comments),
    rowHtml_('Page URL', data.sourcePage),
    rowHtml_('Submitted At (browser)', data.submittedAt),
    rowHtml_('Received At (server)', receivedAt.toISOString()),
    '</table>',
    '<div style="margin-top:14px;font-size:12px;color:#64748b;">Reply to this email to contact the parent directly.</div>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');

  const emailPayload = {
    to: NOTIFY_EMAIL,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody,
    name: SCHOOL_NAME + ' Website',
  };
  if (isValidEmail_(data.email)) emailPayload.replyTo = data.email;

  MailApp.sendEmail(emailPayload);
}

function sendParentAutoReply_(data, receivedAt) {
  if (!isValidEmail_(data.email)) return;

  const subject = 'Admission Enquiry Received - ' + SCHOOL_NAME;
  const greetingName = data.parentName || 'Parent';

  const textBody = [
    'Dear ' + greetingName + ',',
    '',
    'Thank you for your admission enquiry at ' + SCHOOL_NAME + '.',
    'We have received your form for academic year ' + ADMISSION_YEAR + '.',
    'Our admissions team will contact you within 24 hours.',
    '',
    'आपला प्रवेश चौकशी फॉर्म आम्हाला प्राप्त झाला आहे.',
    'आमची टीम 24 तासांच्या आत आपल्याशी संपर्क करेल.',
    '',
    'Submitted details:',
    'Child Name: ' + safeDash_(data.childName),
    'Program: ' + safeDash_(data.program),
    'Phone: ' + safeDash_(data.phone),
    '',
    'School Contact:',
    'Phone: ' + SCHOOL_PHONE + ' / ' + SCHOOL_ALT_PHONE,
    'WhatsApp: https://wa.me/' + SCHOOL_WHATSAPP,
    'Office Hours: ' + SCHOOL_HOURS,
    'Address: ' + SCHOOL_ADDRESS,
    '',
    'Thank you,',
    SCHOOL_NAME,
  ].join('\n');

  const htmlBody = [
    '<div style="font-family:Segoe UI,Arial,sans-serif;background:' + BRAND_BG + ';padding:24px;color:#0f172a;">',
    '<div style="max-width:680px;margin:0 auto;border:1px solid #dbe7f2;border-radius:14px;background:#ffffff;overflow:hidden;">',
    '<div style="background:linear-gradient(120deg,' + BRAND_PRIMARY + ',' + BRAND_ACCENT + ');padding:18px 22px;color:#ffffff;">',
    logoHtml_(),
    '<h2 style="margin:10px 0 2px;font-size:22px;">Thank you for your enquiry</h2>',
    '<div style="opacity:0.95;font-size:13px;">' + escapeHtml_(SCHOOL_TAGLINE) + '</div>',
    '<div style="opacity:0.95;font-size:13px;">Admission Year: ' + escapeHtml_(ADMISSION_YEAR) + '</div>',
    '</div>',
    '<div style="padding:20px 22px;">',
    '<p style="margin:0 0 10px;">Dear <strong>' + escapeHtml_(greetingName) + '</strong>,</p>',
    '<p style="margin:0 0 10px;">Thank you for contacting <strong>' + escapeHtml_(SCHOOL_NAME) + '</strong>. We have received your admission enquiry and our team will call you within <strong>24 hours</strong>.</p>',
    '<p style="margin:0 0 14px;">नमस्कार, <strong>' + escapeHtml_(SCHOOL_NAME_MR) + '</strong> मध्ये प्रवेश चौकशी केल्याबद्दल धन्यवाद. आपला फॉर्म प्राप्त झाला आहे. आमची टीम 24 तासांच्या आत संपर्क करेल.</p>',
    '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#f9fcff;">',
    '<div style="font-weight:700;margin-bottom:8px;">Submitted Details</div>',
    '<div style="font-size:14px;line-height:1.7;">',
    '<div><strong>Child Name:</strong> ' + escapeHtml_(safeDash_(data.childName)) + '</div>',
    '<div><strong>Program:</strong> ' + escapeHtml_(safeDash_(data.program)) + '</div>',
    '<div><strong>Phone:</strong> ' + escapeHtml_(safeDash_(data.phone)) + '</div>',
    '<div><strong>Preferred Visit Date:</strong> ' + escapeHtml_(safeDash_(data.visitDate)) + '</div>',
    '<div><strong>Received At:</strong> ' + escapeHtml_(receivedAt.toISOString()) + '</div>',
    '</div>',
    '</div>',
    '<div style="margin-top:14px;padding:12px 14px;border-left:4px solid ' + BRAND_PRIMARY + ';background:#f0fdfa;border-radius:8px;">',
    '<div style="font-weight:700;margin-bottom:6px;">Need immediate assistance?</div>',
    '<div style="font-size:14px;line-height:1.7;">',
    'Phone: <a href="tel:' + escapeHtml_(SCHOOL_PHONE) + '">' + escapeHtml_(SCHOOL_PHONE) + '</a> / ' + escapeHtml_(SCHOOL_ALT_PHONE) + '<br>',
    'WhatsApp: <a href="https://wa.me/' + escapeHtml_(SCHOOL_WHATSAPP) + '">Chat Now</a><br>',
    'Office Hours: ' + escapeHtml_(SCHOOL_HOURS) + '<br>',
    'Address: ' + escapeHtml_(SCHOOL_ADDRESS),
    '</div>',
    '</div>',
    websiteLineHtml_(),
    '<p style="margin:16px 0 0;">Warm regards,<br><strong>' + escapeHtml_(SCHOOL_NAME) + '</strong></p>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');

  const emailPayload = {
    to: data.email,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody,
    name: SCHOOL_NAME + ' Admissions',
  };
  if (isValidEmail_(NOTIFY_EMAIL) && NOTIFY_EMAIL !== 'your-email@example.com') {
    emailPayload.replyTo = NOTIFY_EMAIL;
  }

  MailApp.sendEmail(emailPayload);
}

function logoHtml_() {
  if (!SCHOOL_LOGO_URL) return '';
  return '<img src="' + escapeHtml_(SCHOOL_LOGO_URL) + '" alt="School Logo" style="height:44px;max-width:180px;display:block;">';
}

function websiteLineHtml_() {
  if (!SCHOOL_WEBSITE || SCHOOL_WEBSITE === 'https://example.com') return '';
  return '<p style="margin:12px 0 0;font-size:13px;color:#475569;">Website: <a href="' + escapeHtml_(SCHOOL_WEBSITE) + '">' + escapeHtml_(SCHOOL_WEBSITE) + '</a></p>';
}

function formatProgram_(programValue) {
  const map = {
    playgroup: 'Play Group (1.5-2.5 yrs)',
    nursery: 'Nursery (2.5-3.5 yrs)',
    jrkg: 'Jr. KG (3.5-4.5 yrs)',
    srkg: 'Sr. KG (4.5-5.5 yrs)',
  };
  return map[programValue] || programValue;
}

function formatSource_(sourceValue) {
  const map = {
    google: 'Google Search',
    facebook: 'Facebook',
    friend: 'Friend / Family Referral',
    walkin: 'Walk-in',
    other: 'Other',
  };
  return map[sourceValue] || sourceValue;
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value_(email));
}

function rowHtml_(label, value) {
  return '<tr>' +
    '<td style="border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:34%;padding:9px 10px;vertical-align:top;">' + escapeHtml_(label) + '</td>' +
    '<td style="border:1px solid #e2e8f0;padding:9px 10px;">' + escapeHtml_(safeDash_(value)) + '</td>' +
    '</tr>';
}

function safeDash_(value) {
  const s = value_(value);
  return s || '-';
}

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getOrCreateSheet_(ss, sheetName) {
  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;
  return ss.insertSheet(sheetName);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'received_at',
    'parent_name',
    'phone',
    'email',
    'child_name',
    'dob',
    'program',
    'preferred_start_date',
    'preferred_visit_date',
    'lead_source',
    'comments',
    'source_page',
    'submitted_at_browser',
  ]);
}

function value_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
