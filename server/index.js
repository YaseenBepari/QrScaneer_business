// server/index.js — Express backend with 4 security layers
import 'dotenv/config';   // loads .env in local dev (no-op on Render where env vars are set via dashboard)
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Admin key — loaded from env (set in Render dashboard for production)
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-2024';

// CORS — origins loaded from ALLOWED_ORIGINS env var (comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(o => o.trim());

// --- Middleware ---
app.use(express.json());
app.use(cors({ origin: allowedOrigins }));

// Trust proxy to get real IPs (important behind Nginx/Vite proxy)
app.set('trust proxy', 1);

// ── Security Layer 4: IP Rate Limiting ─────────────────────────────────────
// Max 3 claim attempts per IP per 15 minutes
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_ATTEMPTS',
    message: '❌ Too many attempts from your network. Try again in 15 minutes.'
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/claim
 * Body: { token, name, mobile, fingerprint }
 *
 * Security checks (in order):
 *  1. QR token validation
 *  2. IP rate limit (middleware above)
 *  3. Device fingerprint check
 *  4. Mobile number check
 */
app.post('/api/claim', claimLimiter, async (req, res) => {
  const { token, name, mobile, fingerprint } = req.body;

  // Basic input validation
  if (!token || !name || !mobile || !fingerprint) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: '❌ All fields are required.'
    });
  }

  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({
      error: 'INVALID_MOBILE',
      message: '❌ Please enter a valid 10-digit mobile number.'
    });
  }

  await db.read();

  // ── Layer 1: QR Token Validation ──────────────────────────────────────
  const tokenRecord = db.data.tokens.find(t => t.token === token);
  if (!tokenRecord) {
    return res.status(403).json({
      error: 'INVALID_TOKEN',
      message: '❌ Invalid QR code. Please scan the correct QR code.'
    });
  }
  if (tokenRecord.useCount >= tokenRecord.maxUses) {
    return res.status(403).json({
      error: 'TOKEN_EXHAUSTED',
      message: '❌ This QR code has reached its maximum number of claims.'
    });
  }

  const ip = req.ip || req.connection.remoteAddress;

  // ── Layer 3: Device Fingerprint Check ─────────────────────────────────
  const fingerprintExists = db.data.claims.some(c => c.fingerprint === fingerprint);
  if (fingerprintExists) {
    return res.status(409).json({
      error: 'DEVICE_ALREADY_CLAIMED',
      message: '❌ You have already claimed your free pani puri from this device.'
    });
  }

  // ── Layer 4: Mobile Number Check ──────────────────────────────────────
  const mobileExists = db.data.claims.some(c => c.mobile === mobile);
  if (mobileExists) {
    return res.status(409).json({
      error: 'MOBILE_ALREADY_CLAIMED',
      message: '❌ This mobile number has already been used to claim the offer.'
    });
  }

  // ── All checks passed — record the claim ──────────────────────────────
  const claim = {
    id: uuidv4(),
    token,
    name: name.trim(),
    mobile,
    fingerprint,
    ip,
    claimedAt: new Date().toISOString()
  };

  db.data.claims.push(claim);

  // Increment token use count
  tokenRecord.useCount += 1;

  await db.write();

  return res.status(200).json({
    success: true,
    message: `✅ Congratulations ${name.trim()}! Enjoy your free pani puri! 🎉`
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES  (protected by ADMIN_KEY header)
// ═══════════════════════════════════════════════════════════════════════════

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin key.' });
  }
  next();
}

/**
 * POST /api/admin/generate-token
 * Body: { maxUses }  (optional, default 1)
 * Headers: x-admin-key: <ADMIN_KEY>
 *
 * Returns the token and a base64 QR code image.
 */
app.post('/api/admin/generate-token', requireAdmin, async (req, res) => {
  const maxUses = parseInt(req.body.maxUses) || 10000;
  const token = uuidv4();

  // The URL that the QR code will point to (Vite dev server)
  const baseUrl = req.body.baseUrl || 'http://localhost:5173';
  const claimUrl = `${baseUrl}/?token=${token}`;

  // Generate QR code as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(claimUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#ff7043', light: '#ffffff' },
    width: 300
  });

  const tokenRecord = {
    id: uuidv4(),
    token,
    createdAt: new Date().toISOString(),
    maxUses,
    useCount: 0
  };

  await db.read();
  db.data.tokens.push(tokenRecord);
  await db.write();

  return res.status(201).json({
    token,
    claimUrl,
    qrCode: qrDataUrl,
    maxUses
  });
});

/**
 * GET /api/admin/claims
 * Returns all claim records.
 */
app.get('/api/admin/claims', requireAdmin, async (req, res) => {
  await db.read();
  return res.json({
    tokens: db.data.tokens,
    claims: db.data.claims
  });
});

/**
 * DELETE /api/admin/tokens/:token
 * Revokes a QR token.
 */
app.delete('/api/admin/tokens/:token', requireAdmin, async (req, res) => {
  await db.read();
  const before = db.data.tokens.length;
  db.data.tokens = db.data.tokens.filter(t => t.token !== req.params.token);
  await db.write();
  if (db.data.tokens.length < before) {
    return res.json({ success: true, message: 'Token revoked.' });
  }
  return res.status(404).json({ error: 'NOT_FOUND', message: 'Token not found.' });
});

// ── Serve Vite frontend (production) ────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

// Serve static files (JS, CSS, images, etc.)
app.use(express.static(distDir));

// Catch-all: serve index.html for any non-API route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

// ── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 QR Scanner running on port ${PORT}`);
  console.log(`🔑 Admin key loaded from env: ${ADMIN_KEY ? 'YES' : 'NO (using default!)'}`);
  console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`📋 Admin panel: /admin.html\n`);
});
