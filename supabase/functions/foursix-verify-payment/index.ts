// foursix-verify-payment — verifies Razorpay signature and sends booking email
// Deploy: supabase functions deploy foursix-verify-payment
// Secrets needed: RAZORPAY_KEY_SECRET, RESEND_API_KEY (optional), RESEND_FROM (optional), BOOKING_NOTIFY_TO (optional)

import { getCorsHeaders } from '../_shared/cors.ts';

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): Promise<boolean> {
  const body = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keySecret);
  const messageData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === signature;
}

function bookingEmailHtml(booking: Record<string, unknown>): string {
  const customer = booking.customer as Record<string, string> | undefined;
  const rows: [string, string][] = [
    ['Booking ID', String(booking.bookingId ?? '-')],
    ['Name', customer?.name ?? 'Not provided'],
    ['Phone', customer?.phone ?? 'Not provided'],
    ['Service', String(booking.service ?? '-')],
    ['Package', String(booking.package ?? '-')],
    ['Vehicle Type', String(booking.vehicle ?? '-')],
    ['Total Price', String(booking.totalPrice ?? '-')],
    ['Prepaid Amount', String(booking.prepaidAmount ?? '-')],
    ['Balance After Work', String(booking.balanceAmount ?? '-')],
    ['Razorpay Order ID', String(booking.razorpayOrderId ?? '-')],
    ['Razorpay Payment ID', String(booking.razorpayPaymentId ?? '-')],
    ['Notes', String(booking.notes ?? 'None')],
  ];

  return `
    <h2>New FourSix Detailing PPF Booking</h2>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif">
      ${rows.map(([label, value]) => `<tr><th align="left" style="background:#f5f5f5">${label}</th><td>${value}</td></tr>`).join('')}
    </table>
  `;
}

async function sendBookingEmail(booking: Record<string, unknown>): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  const notifyTo = Deno.env.get('BOOKING_NOTIFY_TO');

  if (!resendKey || !resendFrom || !notifyTo) {
    console.log('[foursix-verify-payment] Email notification skipped — Resend env vars not set.');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [notifyTo],
      subject: `Paid PPF Booking ${booking.bookingId}`,
      html: bookingEmailHtml(booking),
    }),
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      return new Response(
        JSON.stringify({ error: 'Payment verification is not configured on the server.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const body = await req.json();
    const {
      booking,
      bookingId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = body;

    if (!booking || !bookingId || !orderId || !paymentId || !signature) {
      return new Response(
        JSON.stringify({ error: 'Payment verification details are incomplete.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const isValid = await verifyRazorpaySignature(orderId, paymentId, signature, keySecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Payment signature verification failed.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const confirmedBooking = {
      ...booking,
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      paidAt: new Date().toISOString(),
    };

    // Send email notification (non-blocking — don't fail the response if email fails)
    sendBookingEmail(confirmedBooking).catch((err) =>
      console.error('[foursix-verify-payment] Email error:', err)
    );

    return new Response(
      JSON.stringify({ ok: true, bookingId, booking: confirmedBooking }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[foursix-verify-payment]', error);
    return new Response(
      JSON.stringify({ error: 'Could not verify payment.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
