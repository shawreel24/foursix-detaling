import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import Razorpay from 'razorpay';
import { Resend } from 'resend';

const app = express();
const port = process.env.PORT || 3000;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const isRazorpayTestMode = razorpayKeyId?.startsWith('rzp_test_') || false;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;
const bookingNotifyTo = process.env.BOOKING_NOTIFY_TO;

if (!razorpayKeyId || !razorpayKeySecret) {
  console.warn('Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const paidBookings = new Map();

app.use(express.json());
app.use(express.static('.'));

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

  if (expected.length !== received.length) {
    return false;
  }

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

app.get('/api/config', (_req, res) => {
  res.json({
    razorpayKeyId,
    paymentMode: isRazorpayTestMode ? 'test' : 'live',
    isRazorpayConfigured: Boolean(razorpay)
  });
});

app.post('/api/create-ppf-order', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay is not configured.' });
    }

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
      notes: {
        bookingId,
        service: booking.service,
        package: booking.package,
        vehicle: booking.vehicle
      }
    });

    res.json({
      bookingId,
      amount: prepaidAmount,
      orderId: order.id,
      currency: order.currency
    });
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
      paidAt: new Date().toISOString()
    };

    paidBookings.set(bookingId, paidBooking);
    const emailResult = await notifyBooking(paidBooking);

    res.json({
      ok: true,
      bookingId,
      email: emailResult?.skipped ? emailResult : { sent: true }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not verify payment.' });
  }
});

app.get('/api/bookings/:bookingId', (req, res) => {
  const booking = paidBookings.get(req.params.bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  res.json(booking);
});

app.listen(port, () => {
  console.log(`FourSix Detailing server running on http://localhost:${port}`);
});
