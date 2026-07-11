// foursix-admin — handles admin authentication, bookings CRUD, and pricing updates
// Deploy: supabase functions deploy foursix-admin --no-verify-jwt
// Secrets needed: ADMIN_PASSWORD

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { getCorsHeaders } from '../_shared/cors.ts';

// Cryptographic token generation & validation (stateless HMAC tokens)
async function generateToken(email: string, passwordSecret: string): Promise<string> {
  const expiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours session
  const payload = `${email}|${expiry}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(passwordSecret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return btoa(`${payload}:${signature}`);
}

async function verifyToken(token: string, passwordSecret: string): Promise<boolean> {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const [email, expiryStr] = payload.split('|');
    if (email !== 'valapclawmkima81@gmail.com') return false;
    if (Date.now() > Number(expiryStr)) return false;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(passwordSecret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, messageData);
  } catch {
    return false;
  }
}

function createBookingId(): string {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FS-${stamp}-${suffix}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean); // ["foursix-admin", "bookings" | "pricing" | "login", ...]
  const endpoint = pathParts[1];

  const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? 'foursix@admin2024';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 1. Auth Endpoint (no token validation needed)
  if (endpoint === 'login' && req.method === 'POST') {
    try {
      const { email, password } = await req.json();
      if (email !== 'valapclawmkima81@gmail.com' || password !== adminPassword) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      const token = await generateToken(email, adminPassword);
      return new Response(JSON.stringify({ ok: true, token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  }

  // Allow public POST to bookings (WhatsApp requests) and GET to pricing (catalog prices)
  const isPublicBookingCreate = (endpoint === 'bookings' && req.method === 'POST');
  const isPublicPricingRead = (endpoint === 'pricing' && req.method === 'GET');

  if (!isPublicBookingCreate && !isPublicPricingRead) {
    // 2. Token Verification for all other admin endpoints
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const isAuthorized = await verifyToken(token, adminPassword);

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
  }

  // 3. Bookings CRUD
  if (endpoint === 'bookings') {
    const bookingId = pathParts[2]; // e.g. /foursix-admin/bookings/FS-XXXXX

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        const { booking } = body;
        if (!booking) {
          return new Response(JSON.stringify({ error: 'Booking data required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const bId = booking.bookingId || createBookingId();
        const dbBooking = {
          booking_id: bId,
          customer: booking.customer || { name: 'Not provided', phone: 'Not provided' },
          service: booking.service || '-',
          package: booking.package || '-',
          vehicle: booking.vehicle || '-',
          total_price: booking.totalPrice || 'Rs. 0',
          prepaid_amount: booking.prepaidAmount || '-',
          balance_amount: booking.balanceAmount || '-',
          notes: booking.notes || 'None',
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('bookings')
          .insert(dbBooking)
          .select()
          .single();

        if (error) throw error;

        const ccBooking = {
          bookingId: data.booking_id,
          customer: data.customer,
          service: data.service,
          package: data.package,
          vehicle: data.vehicle,
          totalPrice: data.total_price,
          prepaidAmount: data.prepaid_amount,
          balanceAmount: data.balance_amount,
          notes: data.notes,
          createdAt: data.created_at
        };

        return new Response(JSON.stringify({ ok: true, bookingId: bId, booking: ccBooking }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      // Map snake_case database schema back to camelCase for the frontend if needed
      const camelCaseBookings = data.map((b: any) => ({
        bookingId: b.booking_id,
        customer: b.customer,
        service: b.service,
        package: b.package,
        vehicle: b.vehicle,
        totalPrice: b.total_price,
        prepaidAmount: b.prepaid_amount,
        balanceAmount: b.balance_amount,
        notes: b.notes,
        razorpayOrderId: b.razorpay_order_id,
        razorpayPaymentId: b.razorpay_payment_id,
        paidAt: b.paid_at,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }));

      return new Response(JSON.stringify({ bookings: camelCaseBookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'PATCH' && bookingId) {
      try {
        const body = await req.json();
        const updates: Record<string, any> = {};
        
        // Map camelCase fields to snake_case db columns
        if ('customer' in body) updates.customer = body.customer;
        if ('service' in body) updates.service = body.service;
        if ('package' in body) updates.package = body.package;
        if ('vehicle' in body) updates.vehicle = body.vehicle;
        if ('totalPrice' in body) updates.total_price = body.totalPrice;
        if ('prepaidAmount' in body) updates.prepaid_amount = body.prepaidAmount;
        if ('balanceAmount' in body) updates.balance_amount = body.balanceAmount;
        if ('notes' in body) updates.notes = body.notes;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('bookings')
          .update(updates)
          .eq('booking_id', bookingId)
          .select()
          .single();

        if (error) throw error;

        const ccBooking = {
          bookingId: data.booking_id,
          customer: data.customer,
          service: data.service,
          package: data.package,
          vehicle: data.vehicle,
          totalPrice: data.total_price,
          prepaidAmount: data.prepaid_amount,
          balanceAmount: data.balance_amount,
          notes: data.notes,
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          paidAt: data.paid_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };

        return new Response(JSON.stringify({ ok: true, booking: ccBooking }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    if (req.method === 'DELETE' && bookingId) {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('booking_id', bookingId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  }

  // 4. Pricing CRUD
  if (endpoint === 'pricing') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('pricing')
        .select('data')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ pricing: data?.data || {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'PUT') {
      try {
        const { pricing } = await req.json();
        const { error } = await supabase
          .from('pricing')
          .upsert({ id: 1, data: pricing, updated_at: new Date().toISOString() });

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint or method not found' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 404,
  });
});
