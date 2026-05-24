const statusElement = document.getElementById('bookingRequestStatus');
const summaryElement = document.getElementById('bookingRequestSummary');
const sendButton = document.getElementById('sendBookingRequestButton');
const whatsappNumber = '919506745852';
let booking = null;

function getApiUrl(path) {
  const baseUrl = window.FOURSIX_CONFIG?.apiBaseUrl?.replace(/\/$/, '') || '';
  return `${baseUrl}${path}`;
}

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

async function loadBooking() {
  const bookingId = getBookingId();
  if (!bookingId) {
    statusElement.textContent = 'Booking ID is missing.';
    return;
  }

  try {
    const response = await fetch(getApiUrl(`/api/bookings/${encodeURIComponent(bookingId)}`));
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not load booking details.');
    }

    booking = result;
    renderBooking(booking);
  } catch (error) {
    statusElement.textContent = error.message || 'Could not load booking details.';
  }
}

sendButton.addEventListener('click', () => {
  if (!booking) return;
  const message = createWhatsappMessage(booking);
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

loadBooking();
