/**
 * Cloudflare Pages Function — Enquiry Form Proxy
 *
 * Receives form data from the website and forwards it to Google Apps Script.
 * The real Google Apps Script URL is stored as an environment variable (GAS_WEBHOOK_URL)
 * so it is NEVER exposed in the browser's Network tab.
 *
 * Route: POST /api/enquiry
 *
 * Setup:
 *   Cloudflare Pages Dashboard → Settings → Environment Variables
 *   Add: GAS_WEBHOOK_URL = https://script.google.com/macros/s/YOUR_ID/exec
 */

const ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(localhost(:\d+)?|.+\.pages\.dev|YOUR_CUSTOM_DOMAIN)$/;

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGIN_PATTERN.test(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// Handle CORS preflight
export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// Handle form submission
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';

  // 1. Check environment variable is set
  const webhookUrl = env.GAS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('GAS_WEBHOOK_URL environment variable is not set.');
    return jsonResponse({ ok: false, message: 'Server configuration error.' }, 500, origin);
  }

  // 2. Read and parse the incoming JSON body
  let payload;
  try {
    const text = await request.text();
    payload = JSON.parse(text);
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid request body.' }, 400, origin);
  }

  // 3. Honeypot check — bots fill hidden fields, humans don't
  if (payload._hp && payload._hp !== '') {
    // Silently accept so bots think it worked
    return jsonResponse({ ok: true }, 200, origin);
  }

  // 4. Basic server-side validation
  const name = (payload.parentName || '').trim();
  const phone = (payload.phone || '').trim();
  const email = (payload.email || '').trim();
  const childName = (payload.childName || '').trim();

  if (!name || !childName) {
    return jsonResponse({ ok: false, message: 'Missing required fields.' }, 400, origin);
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return jsonResponse({ ok: false, message: 'Invalid phone number.' }, 400, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, message: 'Invalid email address.' }, 400, origin);
  }

  // 5. Remove honeypot field before forwarding
  delete payload._hp;

  // 6. Forward to Google Apps Script
  try {
    const gasResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const contentType = gasResponse.headers.get('content-type') || '';
    let result = { ok: gasResponse.ok };

    if (contentType.includes('application/json')) {
      try {
        result = await gasResponse.json();
      } catch {
        result = { ok: gasResponse.ok };
      }
    }

    if (!result.ok) {
      console.error('GAS returned error:', result.message);
      return jsonResponse({ ok: false, message: 'Submission failed. Please try again.' }, 502, origin);
    }

    return jsonResponse({ ok: true }, 200, origin);
  } catch (err) {
    console.error('Fetch to GAS failed:', err.message);
    return jsonResponse({ ok: false, message: 'Network error. Please try again.' }, 502, origin);
  }
}
