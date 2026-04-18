/**
 * Cloudflare Pages Worker — Future Pre-Primary School
 * Handles POST /api/enquiry → sends emails via Resend API
 * All other requests → serves static assets (index.html, logo, etc.)
 *
 * Environment Variables (set in Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY  →  re_xxxxxxxxxxxxxxxxx  (from resend.com)
 */

const SCHOOL_NAME     = 'Future Pre-Primary School';
const SCHOOL_TAGLINE  = 'First Digital School in Dhule';
const SCHOOL_PHONE    = '8830507689';
const SCHOOL_PHONE2   = '8830507869';
const SCHOOL_WA       = '918830507689';
const SCHOOL_ADDRESS  = '94, Satya Sai Baba Society, Sakri Road, Dhule – 424001';
const SCHOOL_HOURS    = 'Mon–Sat: 9:00 AM – 5:00 PM';
const ADMISSION_YEAR  = '2026-27';
const ADMIN_EMAIL     = 'swapnilks1297@gmail.com';
const BRAND_PRIMARY   = '#0f766e';
const BRAND_ACCENT    = '#ff7a59';

const PROGRAM_MAP = {
  playgroup : 'Play Group (1.5–2.5 yrs)',
  nursery   : 'Nursery (2.5–3.5 yrs)',
  jrkg      : 'Jr. KG (3.5–4.5 yrs)',
  srkg      : 'Sr. KG (4.5–5.5 yrs)',
};
const SOURCE_MAP = {
  google   : 'Google Search',
  facebook : 'Facebook',
  friend   : 'Friend / Family Referral',
  walkin   : 'Walk-in',
  other    : 'Other',
};

// ─────────────────────────────────────────────
// MAIN FETCH HANDLER
// ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    if (url.pathname === '/api/enquiry' && request.method === 'POST') {
      return handleEnquiry(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

// ─────────────────────────────────────────────
// ENQUIRY HANDLER
// ─────────────────────────────────────────────
async function handleEnquiry(request, env) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ ok: false, message: 'Server misconfigured: RESEND_API_KEY missing.' }, 500);
  }

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400);
  }

  // Honeypot check
  if (payload._hp) return json({ ok: true }, 200);

  // Validate
  const name      = (payload.parentName || '').trim();
  const phone     = (payload.phone      || '').trim();
  const email     = (payload.email      || '').trim();
  const childName = (payload.childName  || '').trim();

  if (!name || !childName)                   return json({ ok: false, message: 'Missing required fields.' }, 400);
  if (!/^[6-9]\d{9}$/.test(phone))          return json({ ok: false, message: 'Invalid phone number.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, message: 'Invalid email.' }, 400);

  const data = {
    parentName : name,
    phone,
    email,
    childName,
    dob        : payload.dob       || '',
    program    : PROGRAM_MAP[payload.program] || payload.program || '—',
    startDate  : payload.startDate || '',
    visitDate  : payload.visitDate || '',
    source     : SOURCE_MAP[payload.source]   || payload.source  || '—',
    comments   : payload.comments  || '—',
    sourcePage : payload.sourcePage || '—',
    submittedAt: payload.submittedAt || new Date().toISOString(),
  };

  const receivedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Send both emails in parallel
  const [adminRes, parentRes] = await Promise.allSettled([
    sendEmail(apiKey, {
      from    : `${SCHOOL_NAME} <onboarding@resend.dev>`,
      to      : [ADMIN_EMAIL],
      replyTo : email,
      subject : `🏫 New Admission Enquiry (${ADMISSION_YEAR}) — ${data.parentName}`,
      html    : adminEmailHtml(data, receivedAt),
    }),
    sendEmail(apiKey, {
      from    : `${SCHOOL_NAME} <onboarding@resend.dev>`,
      to      : [email],
      replyTo : ADMIN_EMAIL,
      subject : `Admission Enquiry Received — ${SCHOOL_NAME}`,
      html    : parentEmailHtml(data, receivedAt),
    }),
  ]);

  const adminOk  = adminRes.status  === 'fulfilled' && adminRes.value.ok;
  const parentOk = parentRes.status === 'fulfilled' && parentRes.value.ok;

  if (!adminOk) {
    console.error('Admin email failed:', adminRes.reason || adminRes.value?.error);
    return json({ ok: false, message: 'Email delivery failed. Please try again.' }, 502);
  }

  return json({ ok: true, parentEmailSent: parentOk }, 200);
}

// ─────────────────────────────────────────────
// RESEND API CALL
// ─────────────────────────────────────────────
async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method  : 'POST',
    headers : {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, error: await res.text() };
}

// ─────────────────────────────────────────────
// ADMIN EMAIL TEMPLATE
// ─────────────────────────────────────────────
function adminEmailHtml(d, receivedAt) {
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px;background:#f8fafc;font-weight:600;font-size:13px;color:#374151;width:36%;border:1px solid #e5e7eb;vertical-align:top;">${label}</td>
      <td style="padding:10px 14px;font-size:14px;color:#111827;border:1px solid #e5e7eb;">${value || '—'}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);border:1px solid #dbe7f2;">

  <!-- HEADER -->
  <div style="background:linear-gradient(120deg,${BRAND_PRIMARY},${BRAND_ACCENT});padding:28px 32px;color:#fff;">
    <div style="font-size:28px;margin-bottom:6px;">🏫</div>
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;">New Admission Enquiry</h1>
    <div style="font-size:13px;opacity:0.92;">${SCHOOL_TAGLINE} &nbsp;|&nbsp; Academic Year: ${ADMISSION_YEAR}</div>
  </div>

  <!-- ALERT BANNER -->
  <div style="background:#fefce8;border-bottom:2px solid #fde68a;padding:12px 32px;font-size:13px;color:#92400e;">
    ⚡ <strong>Action Required:</strong> New admission enquiry received. Please call the parent within 24 hours.
  </div>

  <!-- BODY -->
  <div style="background:#ffffff;padding:28px 32px;">

    <!-- PARENT INFO -->
    <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:1px;">👤 Parent / Guardian</h3>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Parent Name', d.parentName)}
      ${row('Phone', `<a href="tel:${d.phone}" style="color:${BRAND_PRIMARY};font-weight:600;">${d.phone}</a>`)}
      ${row('Email', `<a href="mailto:${d.email}" style="color:${BRAND_PRIMARY};">${d.email}</a>`)}
    </table>

    <!-- CHILD INFO -->
    <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:1px;">👶 Child Details</h3>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Child Name', d.childName)}
      ${row('Date of Birth', d.dob)}
      ${row('Program Interest', `<strong>${d.program}</strong>`)}
      ${row('Preferred Start Date', d.startDate)}
      ${row('Preferred Visit Date', d.visitDate)}
    </table>

    <!-- ENQUIRY INFO -->
    <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:1px;">📋 Enquiry Details</h3>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Lead Source', d.source)}
      ${row('Comments', d.comments)}
      ${row('Page URL', `<a href="${d.sourcePage}" style="color:#6b7280;font-size:12px;">${d.sourcePage}</a>`)}
      ${row('Submitted At', d.submittedAt)}
      ${row('Received At (IST)', receivedAt)}
    </table>

    <!-- QUICK ACTIONS -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
      <a href="tel:${d.phone}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">📞 Call Parent</a>
      <a href="https://wa.me/${SCHOOL_WA}?text=Hello%20${encodeURIComponent(d.parentName)}%2C%20this%20is%20Future%20School%20Dhule..." style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">💬 WhatsApp</a>
      <a href="mailto:${d.email}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">📧 Reply Email</a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      💡 Tip: Click "Reply" in your email client to reply directly to the parent's email.
    </p>
  </div>

  <!-- FOOTER -->
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">${SCHOOL_NAME} &nbsp;•&nbsp; ${SCHOOL_ADDRESS}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">📞 ${SCHOOL_PHONE} / ${SCHOOL_PHONE2} &nbsp;•&nbsp; ${SCHOOL_HOURS}</p>
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// PARENT AUTO-REPLY EMAIL TEMPLATE
// ─────────────────────────────────────────────
function parentEmailHtml(d, receivedAt) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:640px;margin:32px auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);border:1px solid #dbe7f2;">

  <!-- HEADER -->
  <div style="background:linear-gradient(120deg,${BRAND_PRIMARY},${BRAND_ACCENT});padding:28px 32px;color:#fff;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">🎉</div>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;">Thank You for Your Enquiry!</h1>
    <div style="font-size:13px;opacity:0.92;">${SCHOOL_NAME} — ${SCHOOL_TAGLINE}</div>
  </div>

  <!-- BODY -->
  <div style="background:#ffffff;padding:28px 32px;">
    <p style="margin:0 0 14px;font-size:15px;color:#111827;">Dear <strong>${d.parentName}</strong>,</p>

    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7;">
      Thank you for contacting <strong>${SCHOOL_NAME}</strong>. We have successfully received your admission enquiry for academic year <strong>${ADMISSION_YEAR}</strong>. Our admissions team will get in touch with you within <strong>24 hours</strong>.
    </p>

    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.7;">
        🙏 <strong>नमस्कार ${d.parentName}!</strong><br>
        आपला प्रवेश चौकशी फॉर्म <strong>${SCHOOL_NAME}</strong> ला प्राप्त झाला आहे. आमची टीम 24 तासांच्या आत आपल्याशी संपर्क करेल. धन्यवाद!
      </p>
    </div>

    <!-- SUBMITTED DETAILS -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 14px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};">📋 Your Submitted Details</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;width:45%;">Child Name</td><td style="padding:7px 0;font-size:13px;color:#111827;font-weight:600;">${d.childName}</td></tr>
        <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #f0f0f0;">Program</td><td style="padding:7px 0;font-size:13px;color:#111827;font-weight:600;border-top:1px solid #f0f0f0;">${d.program}</td></tr>
        <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #f0f0f0;">Phone</td><td style="padding:7px 0;font-size:13px;color:#111827;font-weight:600;border-top:1px solid #f0f0f0;">${d.phone}</td></tr>
        <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #f0f0f0;">Preferred Visit</td><td style="padding:7px 0;font-size:13px;color:#111827;font-weight:600;border-top:1px solid #f0f0f0;">${d.visitDate || '—'}</td></tr>
        <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #f0f0f0;">Received At</td><td style="padding:7px 0;font-size:13px;color:#111827;border-top:1px solid #f0f0f0;">${receivedAt} IST</td></tr>
      </table>
    </div>

    <!-- CONTACT INFO -->
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 14px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};">📞 Need Immediate Assistance?</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#374151;">
            📱 <strong>Call Us:</strong>
            <a href="tel:${SCHOOL_PHONE}" style="color:${BRAND_PRIMARY};font-weight:600;text-decoration:none;">${SCHOOL_PHONE}</a> /
            <a href="tel:${SCHOOL_PHONE2}" style="color:${BRAND_PRIMARY};font-weight:600;text-decoration:none;">${SCHOOL_PHONE2}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#374151;">
            💬 <strong>WhatsApp:</strong>
            <a href="https://wa.me/${SCHOOL_WA}" style="color:#22c55e;font-weight:600;text-decoration:none;">Click to Chat</a>
          </td>
        </tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;">🕐 <strong>Hours:</strong> ${SCHOOL_HOURS}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;">📍 <strong>Address:</strong> ${SCHOOL_ADDRESS}</td></tr>
      </table>
    </div>

    <!-- CTA BUTTON -->
    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://wa.me/${SCHOOL_WA}" style="display:inline-block;background:#22c55e;color:#fff;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(34,197,94,0.35);">
        💬 Chat on WhatsApp
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:14px;color:#374151;">
      Warm regards,<br>
      <strong>${SCHOOL_NAME}</strong><br>
      <span style="font-size:12px;color:${BRAND_PRIMARY};">${SCHOOL_TAGLINE}</span>
    </p>
  </div>

  <!-- FOOTER -->
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">${SCHOOL_NAME} &nbsp;•&nbsp; ${SCHOOL_ADDRESS}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">You received this email because you submitted an enquiry on our website.</p>
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
