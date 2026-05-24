# FourSix Payment Setup

This project now has a Node/Express backend for PPF prepaid bookings.

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Create a `.env` file from `.env.example`:

```bash
copy .env.example .env
```

Fill in:

```bash
RAZORPAY_KEY_ID=your_razorpay_test_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RESEND_API_KEY=your_resend_api_key
RESEND_FROM=FourSix Detailing <your_verified_sender@yourdomain.com>
BOOKING_NOTIFY_TO=booking_receiver@example.com
ALLOWED_ORIGINS=https://shawreel24.github.io
PORT=3000
```

For testing, use Razorpay keys that start with `rzp_test_`. Do not put `RAZORPAY_KEY_SECRET` in browser JavaScript or commit it to GitHub.

Do not commit `.env`.

## 3. Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000/booking.html?service=paintProtectionFilm
```

## GitHub Pages

GitHub Pages cannot run `server.js`, but it can call a deployed Node backend.

1. Deploy this project to a Node host such as Render, Railway, or Vercel.
2. Add the `.env` values to that host, including:

```bash
ALLOWED_ORIGINS=https://shawreel24.github.io
```

3. In `assets/js/site-config.js`, set `apiBaseUrl` to the deployed backend URL:

```js
window.FOURSIX_CONFIG = {
  apiBaseUrl: 'https://your-backend.example.com'
};
```

Keep `apiBaseUrl` blank for local testing on `http://localhost:3000`.

## Current Flow

1. Customer selects Paint Protection Film.
2. Normal booking submit is hidden.
3. Customer pays the Rs. 10,000 prepaid amount through Razorpay UPI-only Checkout.
4. Backend verifies the Razorpay payment signature.
5. Backend creates a unique booking ID, stores the paid booking in memory, and sends a Resend email if email env vars are configured.
6. Browser opens a WhatsApp booking message with the booking ID.

## Important

The current booking store is in memory. For production, connect a database so paid bookings survive server restarts.
