/**
 * Cloudflare Pages Function — Enquiry Form Proxy
 * Route: POST /api/enquiry
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// Handle form submission
export async function onRequestPost({ request, env }) {

  // 1. Check environment variable is set
  const webhookUrl = env.GAS_WEBHOOK_URL;
  if (!webhookUrl) {
    return jsonResponse({ ok: false, message: 'Server configuration error. GAS_WEBHOOK_URL not set.' }, 500);
  }

  // 2. Parse incoming JSON body
  let payload;
  try {
    const text = await request.text();
    payload = JSON.parse(text);
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid request body.' }, 400);
  }

  // 3. Honeypot check — bots fill hidden fields, humans leave empty
  if (payload._hp && payload._hp !== '') {
    return jsonResponse({ ok: true }, 200);
  }

  // 4. Basic server-side validation
  const name      = (payload.parentName || '').trim();
  const phone     = (payload.phone     || '').trim();
  const email     = (payload.email     || '').trim();
  const childName = (payload.childName || '').trim();

  if (!name || !childName) {
    return jsonResponse({ ok: false, message: 'Missing required fields.' }, 400);
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return jsonResponse({ ok: false, message: 'Invalid phone number.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, message: 'Invalid email address.' }, 400);
  }

  // 5. Remove honeypot before forwarding
  delete payload._hp;

  // 6. Forward to Google Apps Script
  try {
    const gasResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    let result = { ok: gasResponse.ok };
    const contentType = gasResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { result = await gasResponse.json(); } catch { result = { ok: gasResponse.ok }; }
    }

    if (!result.ok) {
      return jsonResponse({ ok: false, message: result.message || 'Submission failed. Please try again.' }, 502);
    }

    return jsonResponse({ ok: true }, 200);

  } catch (err) {
    return jsonResponse({ ok: false, message: 'Network error. Please try again or call us.' }, 502);
  }
}
