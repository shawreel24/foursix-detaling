import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Razorpay from 'razorpay';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// ─── Razorpay ────────────────────────────────────────────────────────────────
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const isRazorpayTestMode = razorpayKeyId?.startsWith('rzp_test_') || false;

// ─── Resend ───────────────────────────────────────────────────────────────────
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;
const bookingNotifyTo = process.env.BOOKING_NOTIFY_TO;

// ─── Admin auth ───────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'valapclawmkima81@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'foursix@admin2024';
const adminSessions = new Set(); // stores valid tokens

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ─── Persistent data files ────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const PRICING_FILE = path.join(DATA_DIR, 'pricing.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// In-memory mirror of persistent bookings
let bookingsStore = readJson(BOOKINGS_FILE, {});

// Default pricing (mirrors booking.js — single source of truth here; admin can override)
const defaultPricing = {
  detailing: {
    label: 'Car Detailing',
    packages: [
      { label: 'Mini Detailing', prices: { small: 2000, sedan: 2500, suv: '2500-3000' } },
      { label: 'Full Detailing', prices: { small: 3500, sedan: 4000, suv: '4000-5000' } }
    ]
  },
  paintCorrection: {
    label: 'Paint Correction',
    packages: [
      { label: '1 Step Paint Correction', prices: { small: 2000, sedan: 2500, suv: 3000 } },
      { label: '2 Step Paint Correction', prices: { small: 3000, sedan: 3500, suv: 4000 } },
      { label: '3 Step Paint Correction', prices: { small: 6000, sedan: 7000, suv: 8000 } }
    ]
  },
  ceramicCoating: {
    label: 'Ceramic Coating',
    packages: [
      { label: '3 Years Warranty', prices: { small: 15000, sedan: 17000, suv: 18000 } },
      { label: '5 Years Warranty', prices: { small: 25000, sedan: 27000, suv: 30000 } }
    ]
  },
  chasisCoating: {
    label: 'Chasis Coating',
    packages: [
      { label: 'Chasis Coating', prices: { small: 4000, sedan: 4500, suv: 5000 } }
    ]
  },
  elastomerCoating: {
    label: 'Elastomer Coating',
    packages: [
      { label: '3 Years Warranty', prices: { small: 18000, sedan: 21000, suv: 25000 } },
      { label: '5 Years Warranty', prices: { small: 28000, sedan: 30000, suv: 35000 } }
    ]
  },
  paintProtectionFilm: {
    label: 'Paint Protection Film (PPF)',
    packages: [
      { label: 'No Warranty', prices: { small: 70000, sedan: 75000, suv: 80000 } },
      { label: '3 Years Warranty', prices: { small: 100000, sedan: 110000, suv: 120000 } },
      { label: '5 Years Warranty', prices: { small: 120000, sedan: 130000, suv: 140000 } },
      { label: '7 Years Warranty', prices: { small: 150000, sedan: 170000, suv: 180000 } }
    ]
  },
  windowTinting: {
    label: 'Window Tinting / Ceramic Tint',
    packages: [
      { label: 'Sun Control', prices: { small: 3000, sedan: 3500, suv: 3500 } },
      { label: 'Ceramic Tint', prices: { small: 8000, sedan: 8000, suv: 8500 } },
      { label: 'Windshield Tint', prices: { small: 4500, sedan: 4500, suv: 4500 } },
      { label: 'Ceramic + Windshield Tint Combine', prices: { small: 12000, sedan: 12000, suv: 12000 } }
    ]
  },
  carWrapping: {
    label: 'Car Wrapping',
    packages: [
      { label: 'Custom Wrap Consultation', prices: { small: 'Custom quote', sedan: 'Custom quote', suv: 'Custom quote' } }
    ]
  }
};

let pricingStore = readJson(PRICING_FILE, defaultPricing);

// ─── Service clients ──────────────────────────────────────────────────────────
if (!razorpayKeyId || !razorpayKeySecret) {
  console.warn('Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ─── CORS middleware ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use(express.json());
app.use(express.static('.'));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createBookingId() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FS-${stamp}-${suffix}`;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(body)
    .digest('hex');
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

function bookingEmailHtml(booking) {
  const rows = [
    ['Booking ID', booking.bookingId],
    ['Name', booking.customer?.name || 'Not provided'],
    ['Phone', booking.customer?.phone || 'Not provided'],
    ['Service', booking.service],
    ['Package', booking.package],
    ['Vehicle Type', booking.vehicle],
    ['Total Price', booking.totalPrice],
    ['Prepaid Amount', booking.prepaidAmount],
    ['Balance After Work', booking.balanceAmount],
    ['Razorpay Order ID', booking.razorpayOrderId],
    ['Razorpay Payment ID', booking.razorpayPaymentId],
    ['Notes', booking.notes || 'None']
  ];
  return `
    <h2>New FourSix Detailing Booking</h2>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse">
      ${rows.map(([label, value]) => `<tr><th align="left">${label}</th><td>${value}</td></tr>`).join('')}
    </table>
  `;
}

async function notifyBooking(booking) {
  if (!resend || !resendFrom || !bookingNotifyTo) {
    return { skipped: true, reason: 'Resend notification env vars are not fully configured.' };
  }
  return resend.emails.send({
    from: resendFrom,
    to: [bookingNotifyTo],
    subject: `Paid PPF Booking ${booking.bookingId}`,
    html: bookingEmailHtml(booking)
  });
}

function saveBookingsToDisk() {
  writeJson(BOOKINGS_FILE, bookingsStore);
}

// ─── Admin auth middleware ────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

// ─── Public API ───────────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    razorpayKeyId,
    paymentMode: isRazorpayTestMode ? 'test' : 'live',
    isRazorpayConfigured: Boolean(razorpay)
  });
});

app.post('/api/create-ppf-order', async (req, res) => {
  try {
    if (!razorpay) return res.status(500).json({ error: 'Razorpay is not configured.' });

    const { booking } = req.body;
    if (!booking || booking.serviceKey !== 'paintProtectionFilm') {
      return res.status(400).json({ error: 'PPF booking details are required.' });
    }

    const bookingId = createBookingId();
    const prepaidAmount = 10000;
    const order = await razorpay.orders.create({
      amount: prepaidAmount * 100,
      currency: 'INR',
      receipt: bookingId,
      notes: { bookingId, service: booking.service, package: booking.package, vehicle: booking.vehicle }
    });

    res.json({ bookingId, amount: prepaidAmount, orderId: order.id, currency: order.currency });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create payment order.' });
  }
});

app.post('/api/verify-ppf-payment', async (req, res) => {
  try {
    const {
      booking,
      bookingId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    } = req.body;

    if (!booking || !bookingId || !orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Payment verification details are incomplete.' });
    }

    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    const paidBooking = {
      ...booking,
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    bookingsStore[bookingId] = paidBooking;
    saveBookingsToDisk();

    const emailResult = await notifyBooking(paidBooking);
    res.json({ ok: true, bookingId, email: emailResult?.skipped ? emailResult : { sent: true } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not verify payment.' });
  }
});

app.get('/api/bookings/:bookingId', (req, res) => {
  const booking = bookingsStore[req.params.bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  res.json(booking);
});

// ─── Admin API ────────────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.add(token);
  // Auto-expire session after 8 hours
  setTimeout(() => adminSessions.delete(token), 8 * 60 * 60 * 1000);
  res.json({ ok: true, token });
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', requireAdmin, (_req, res) => {
  const bookings = Object.values(bookingsStore).sort((a, b) => {
    return new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0);
  });
  res.json({ bookings });
});

// PATCH /api/admin/bookings/:bookingId  — edit a booking's details/price
app.patch('/api/admin/bookings/:bookingId', requireAdmin, (req, res) => {
  const { bookingId } = req.params;
  if (!bookingsStore[bookingId]) return res.status(404).json({ error: 'Booking not found.' });

  const allowedFields = ['customer', 'service', 'package', 'vehicle', 'totalPrice', 'prepaidAmount', 'balanceAmount', 'notes'];
  const updates = req.body;

  for (const key of allowedFields) {
    if (key in updates) {
      bookingsStore[bookingId][key] = updates[key];
    }
  }

  bookingsStore[bookingId].updatedAt = new Date().toISOString();
  saveBookingsToDisk();
  res.json({ ok: true, booking: bookingsStore[bookingId] });
});

// DELETE /api/admin/bookings/:bookingId
app.delete('/api/admin/bookings/:bookingId', requireAdmin, (req, res) => {
  const { bookingId } = req.params;
  if (!bookingsStore[bookingId]) return res.status(404).json({ error: 'Booking not found.' });
  delete bookingsStore[bookingId];
  saveBookingsToDisk();
  res.json({ ok: true });
});

// GET /api/admin/pricing
app.get('/api/admin/pricing', requireAdmin, (_req, res) => {
  res.json({ pricing: pricingStore });
});

// PUT /api/admin/pricing  — replace full pricing structure
app.put('/api/admin/pricing', requireAdmin, (req, res) => {
  const { pricing } = req.body;
  if (!pricing || typeof pricing !== 'object') {
    return res.status(400).json({ error: 'Invalid pricing data.' });
  }
  pricingStore = pricing;
  writeJson(PRICING_FILE, pricingStore);
  res.json({ ok: true });
});

// POST /api/admin/bookings  — manually add a WhatsApp/walk-in booking
app.post('/api/admin/bookings', requireAdmin, (req, res) => {
  const { booking } = req.body;
  if (!booking) return res.status(400).json({ error: 'Booking data required.' });

  const bookingId = booking.bookingId || createBookingId();
  const newBooking = {
    ...booking,
    bookingId,
    createdAt: new Date().toISOString()
  };

  bookingsStore[bookingId] = newBooking;
  saveBookingsToDisk();
  res.json({ ok: true, booking: newBooking });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`FourSix Detailing server running on http://localhost:${port}`);
  console.log(`Admin login: http://localhost:${port}/admin-login.html`);
  console.log(`Admin password: ${ADMIN_PASSWORD} (set ADMIN_PASSWORD in .env to change)`);
});
