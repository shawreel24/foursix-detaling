# FourSix Detailing — Payment Gateway Setup

The payment gateway uses **Supabase Edge Functions** as a serverless backend.
This means the site works fully on **GitHub Pages** — no separate server needed.

---

## How it Works

```
GitHub Pages (static)          Supabase Edge Functions (serverless)        Razorpay
  booking.html          →→→    foursix-config         →→→    public key returned
  (Pay button clicked)  →→→    foursix-create-order   →→→    order created with secret
  (Payment done)        →→→    foursix-verify-payment →→→    signature verified
  ↓
  sessionStorage  →  booking-request.html  →  WhatsApp
```

---

## 1. Supabase Project

Project URL: `https://jxdclevjxcgpvkjwpgow.supabase.co`  
Project Ref: `jxdclevjxcgpvkjwpgow`

---

## 2. Deploy Edge Functions

### Step A — Get a Personal Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **Generate new token**, name it `foursix-deploy`
3. Copy the token (starts with `sbp_...`)

### Step B — Login and Deploy

```powershell
cd "46 Detailing"
npx supabase login --token YOUR_SBP_TOKEN_HERE
npx supabase functions deploy foursix-config --project-ref jxdclevjxcgpvkjwpgow
npx supabase functions deploy foursix-create-order --project-ref jxdclevjxcgpvkjwpgow
npx supabase functions deploy foursix-verify-payment --project-ref jxdclevjxcgpvkjwpgow
```

---

## 3. Set Supabase Secrets

After deploying, add your Razorpay keys as Supabase secrets:

```powershell
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_XXXXXXX --project-ref jxdclevjxcgpvkjwpgow
npx supabase secrets set RAZORPAY_KEY_SECRET=YOUR_SECRET --project-ref jxdclevjxcgpvkjwpgow
```

Optional — email notifications via Resend:
```powershell
npx supabase secrets set RESEND_API_KEY=re_XXXXXXX --project-ref jxdclevjxcgpvkjwpgow
npx supabase secrets set RESEND_FROM="FourSix Detailing <you@yourdomain.com>" --project-ref jxdclevjxcgpvkjwpgow
npx supabase secrets set BOOKING_NOTIFY_TO=owner@example.com --project-ref jxdclevjxcgpvkjwpgow
```

You can also set secrets in the Supabase Dashboard:
→ Project → Edge Functions → Manage secrets

---

## 4. Verify Deployment

Test the config endpoint in your browser:

```
https://jxdclevjxcgpvkjwpgow.supabase.co/functions/v1/foursix-config
```

You should see JSON with your `razorpayKeyId`.

---

## 5. GitHub Pages

The `assets/js/site-config.js` is already configured with the Supabase URL.
Just push to GitHub — payment will work automatically on GitHub Pages.

```
https://shawreel24.github.io/<repo-name>/booking.html?service=paintProtectionFilm
```

---

## Local Development

The local Express server (`server.js`) still works for local testing.
Set `apiBaseUrl: ''` in `site-config.js` to use it, or keep the Supabase URL to test cloud functions locally.

```powershell
npm start
# Open: http://localhost:3000/booking.html?service=paintProtectionFilm
```

---

## Payment Flow

1. Customer selects **Paint Protection Film**
2. Payment Structure panel appears showing Rs. 10,000 prepaid + balance
3. Customer clicks **Pay Prepaid Amount**
4. Razorpay checkout opens (UPI, Card, Net Banking, Wallets)
5. Payment success → `foursix-verify-payment` verifies the signature
6. Booking stored in `sessionStorage` → redirect to `booking-request.html`
7. Customer clicks **Send Booking Request** → WhatsApp opens with all booking details

---

## Security

- `RAZORPAY_KEY_SECRET` never touches the browser — lives only in Supabase secrets
- Signature verification happens server-side in the Edge Function
- The publishable key in `site-config.js` is intentionally public (like a Razorpay Key ID)
