/**
 * Cloudflare Pages _worker.js
 * Handles /api/enquiry POST — proxies to Google Apps Script (URL hidden server-side)
 * All other requests fall through to static assets (index.html, logo, etc.)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ── API: Enquiry form proxy ──
    if (url.pathname === '/api/enquiry' && request.method === 'POST') {
      return handleEnquiry(request, env);
    }

    // ── Everything else: serve static files ──
    return env.ASSETS.fetch(request);
  },
};

async function handleEnquiry(request, env) {
  const webhookUrl = env.GAS_WEBHOOK_URL;

  // Check env variable is set
  if (!webhookUrl) {
    return json({ ok: false, message: 'Server configuration error: GAS_WEBHOOK_URL not set.' }, 500);
  }

  // Parse body
  let payload;
  try {
    const text = await request.text();
    payload = JSON.parse(text);
  } catch {
    return json({ ok: false, message: 'Invalid request body.' }, 400);
  }

  // Honeypot — bots fill this, humans don't
  if (payload._hp && payload._hp !== '') {
    return json({ ok: true }, 200);
  }

  // Server-side validation
  const name      = (payload.parentName || '').trim();
  const phone     = (payload.phone      || '').trim();
  const email     = (payload.email      || '').trim();
  const childName = (payload.childName  || '').trim();

  if (!name || !childName) {
    return json({ ok: false, message: 'Missing required fields.' }, 400);
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return json({ ok: false, message: 'Invalid phone number.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, message: 'Invalid email address.' }, 400);
  }

  // Remove honeypot before forwarding
  delete payload._hp;

  // Forward to Google Apps Script
  try {
    const gasRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    let result = { ok: gasRes.ok };
    const ct = gasRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { result = await gasRes.json(); } catch { /**/ }
    }

    if (!result.ok) {
      return json({ ok: false, message: result.message || 'Submission failed. Please try again.' }, 502);
    }

    return json({ ok: true }, 200);

  } catch (err) {
    return json({ ok: false, message: 'Network error. Please try again or call us.' }, 502);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
