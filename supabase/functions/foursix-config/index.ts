// foursix-config — returns the Razorpay public key ID to the frontend
// Deploy: supabase functions deploy foursix-config
// Secrets needed: RAZORPAY_KEY_ID

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
  const isConfigured = Boolean(razorpayKeyId);
  const isTestMode = razorpayKeyId.startsWith('rzp_test_');

  return new Response(
    JSON.stringify({
      razorpayKeyId,
      paymentMode: isTestMode ? 'test' : 'live',
      isRazorpayConfigured: isConfigured,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});
