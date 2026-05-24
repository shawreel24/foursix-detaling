// booking-request.js
// Reads the confirmed booking from sessionStorage (set by booking.js after payment verification).
// This is fully static — no server call needed — so it works on GitHub Pages.

const statusElement = document.getElementById('bookingRequestStatus');
const summaryElement = document.getElementById('bookingRequestSummary');
const sendButton = document.getElementById('sendBookingRequestButton');
const whatsappNumber = '919506745852';
let booking = null;

function getBookingId() {
  return new URLSearchParams(window.location.search).get('bookingId');
}

function bookingRows(item) {
  return [
    ['Booking ID', item.bookingId],
    ['Name', item.customer?.name || 'Not provided'],
    ['Phone', item.customer?.phone || 'Not provided'],
    ['Service', item.service],
    ['Package', item.package],
    ['Vehicle Type', item.vehicle],
    ['Total Price', item.totalPrice],
    ['Prepaid Paid', item.prepaidAmount],
    ['Balance After Work', item.balanceAmount],
    ['Payment ID', item.razorpayPaymentId],
    ['Notes', item.notes || 'None']
  ];
}

function renderBooking(item) {
  summaryElement.innerHTML = bookingRows(item)
    .map(([label, value]) => `
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `)
    .join('');

  summaryElement.hidden = false;
  sendButton.hidden = false;
  statusElement.textContent = `Booking ID: ${item.bookingId}`;
}

function createWhatsappMessage(item) {
  return [
    'Hello FourSix Detailing, my PPF prepaid payment is completed.',
    `Booking ID: ${item.bookingId}`,
    `Name: ${item.customer?.name || 'Not provided'}`,
    `Phone: ${item.customer?.phone || 'Not provided'}`,
    `Service: ${item.service}`,
    `Package: ${item.package}`,
    `Vehicle Type: ${item.vehicle}`,
    `Total Price: ${item.totalPrice}`,
    `Prepaid Paid: ${item.prepaidAmount}`,
    `Balance After Work: ${item.balanceAmount}`,
    `Payment ID: ${item.razorpayPaymentId}`,
    `Notes: ${item.notes || 'None'}`
  ].join('\n');
}

function loadBooking() {
  const bookingId = getBookingId();
  if (!bookingId) {
    statusElement.textContent = 'Booking ID is missing.';
    return;
  }

  // Primary: read from sessionStorage (set by booking.js after payment — works on GitHub Pages)
  try {
    const stored = sessionStorage.getItem('foursix_last_booking');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Verify it matches the bookingId in the URL
      if (parsed && (parsed.bookingId === bookingId || !parsed.bookingId)) {
        booking = parsed.bookingId ? parsed : { ...parsed, bookingId };
        renderBooking(booking);
        // Clear from sessionStorage after rendering (one-time use)
        sessionStorage.removeItem('foursix_last_booking');
        return;
      }
    }
  } catch (_) {
    // sessionStorage not available — fall through
  }

  // Fallback: try the local Node server API (only works on localhost:3000)
  const apiBase = window.FOURSIX_CONFIG?.apiBaseUrl || '';
  if (!apiBase || apiBase.includes('supabase.co')) {
    // Cloud mode — no server-side booking store; session storage is the only source
    statusElement.textContent = `Booking confirmed! ID: ${bookingId} — Please copy your Payment ID from your payment receipt and include it when you send the WhatsApp message below.`;
    // Create a minimal booking object so the button still appears
    booking = {
      bookingId,
      customer: { name: 'Provided during booking', phone: 'Provided during booking' },
      service: 'Paint Protection Film (PPF)',
      package: '-',
      vehicle: '-',
      totalPrice: '-',
      prepaidAmount: 'Rs. 10,000',
      balanceAmount: '-',
      razorpayPaymentId: '(see your payment receipt)',
      notes: 'None',
    };
    renderBooking(booking);
    return;
  }

  // Local dev fallback — fetch from Express server
  fetch(`${apiBase}/api/bookings/${encodeURIComponent(bookingId)}`)
    .then((r) => r.json())
    .then((result) => {
      if (!result || result.error) throw new Error(result?.error || 'Booking not found.');
      booking = result;
      renderBooking(booking);
    })
    .catch((err) => {
      statusElement.textContent = err.message || 'Could not load booking details.';
    });
}

sendButton.addEventListener('click', () => {
  if (!booking) return;
  const message = createWhatsappMessage(booking);
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

loadBooking();
