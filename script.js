// Same-origin: frontend is served by the same Express server on Render
// so relative URLs like /api/... work perfectly.
const API_BASE = '';

// ── Device Fingerprint ─────────────────────────────────────────────────────
// Generates a stable device fingerprint from canvas, screen, and browser info.
// This is NOT 100% unbeatable, but blocks casual/average duplicate claims.
function generateFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 50;

  // Draw text — different fonts/rendering per GPU/OS leaves unique pixel data
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#ff7043';
  ctx.fillText('🍽 PaniPuri-Fingerprint', 2, 2);
  ctx.fillStyle = '#fcb69f';
  ctx.fillRect(100, 30, 80, 10);

  const canvasData = canvas.toDataURL();

  const components = [
    canvasData,
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency || '',
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform || '',
  ].join('|||');

  // Simple djb2 hash → hex string
  let hash = 5381;
  for (let i = 0; i < components.length; i++) {
    hash = ((hash << 5) + hash) ^ components.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') +
    Math.abs(components.length).toString(16);
}

// ── QR Token from URL ──────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const form = document.getElementById('offerForm');
const invalidBox = document.getElementById('invalidToken');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');

// Show form only if token is present in URL
if (token) {
  form.style.display = 'block';
  invalidBox.style.display = 'none';
} else {
  form.style.display = 'none';
  invalidBox.style.display = 'block';
}

// ── Form Submit ────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const fingerprint = generateFingerprint();

  if (!name || !mobile) {
    showMessage('❌ Please fill in all fields.', 'error');
    return;
  }

  // Show loading state
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  submitBtn.disabled = true;
  message.textContent = '';

  try {
    const response = await fetch(`${API_BASE}/api/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, mobile, fingerprint })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage(data.message, 'success');
      form.style.display = 'none'; // Hide form after success
    } else {
      showMessage(data.message || '❌ Something went wrong. Please try again.', 'error');
    }
  } catch (err) {
    showMessage('❌ Server unreachable. Please try again later.', 'error');
  } finally {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled = false;
  }
});

function showMessage(text, type) {
  message.textContent = text;
  message.style.color = type === 'success' ? '#2e7d32' : '#c62828';
}
