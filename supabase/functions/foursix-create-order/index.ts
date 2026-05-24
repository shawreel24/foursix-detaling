// foursix-create-order — creates a Razorpay order for PPF prepaid payment
// Deploy: supabase functions deploy foursix-create-order
// Secrets needed: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { getCorsHeaders } from '../_shared/cors.ts';

const PPF_PREPAID_AMOUNT = 10000; // Rs. 10,000 in INR

function createBookingId(): string {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FS-${stamp}-${suffix}`;
}

async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  bookingId: string
): Promise<{ id: string; currency: string }> {
  const credentials = btoa(`${keyId}:${keySecret}`);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: PPF_PREPAID_AMOUNT * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: bookingId,
      notes: { bookingId },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Razorpay order creation failed: ${err}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
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
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({ error: 'Razorpay is not configured on the server.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const body = await req.json();
    const { booking } = body;

    if (!booking || booking.serviceKey !== 'paintProtectionFilm') {
      return new Response(
        JSON.stringify({ error: 'PPF booking details are required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const bookingId = createBookingId();
    const order = await createRazorpayOrder(keyId, keySecret, bookingId);

    return new Response(
      JSON.stringify({
        bookingId,
        amount: PPF_PREPAID_AMOUNT,
        orderId: order.id,
        currency: order.currency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[foursix-create-order]', error);
    return new Response(
      JSON.stringify({ error: 'Could not create payment order.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
