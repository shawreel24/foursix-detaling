/* ============================================================
   booking.js — multi-service booking logic for FourSix Detailing
   ============================================================ */

const defaultBookingPrices = {
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

let bookingPrices = JSON.parse(JSON.stringify(defaultBookingPrices));

const vehicleLabels = { small: 'Small Car', sedan: 'Sedan', suv: 'SUV' };

/* ---- DOM refs ---- */
const vehicleSelect    = document.getElementById('vehicleSelect');
const priceValue       = document.getElementById('priceValue');
const priceDetail      = document.getElementById('priceDetail');
const priceBreakdown   = document.getElementById('priceBreakdown');
const summaryVehicle   = document.getElementById('summaryVehicle');
const bookingForm      = document.getElementById('bookingForm');
const servicesList     = document.getElementById('servicesList');
const addServiceBtn    = document.getElementById('addServiceBtn');
const paymentStructure = document.getElementById('paymentStructure');
const prepaidAmount    = document.getElementById('prepaidAmount');
const balanceAmount    = document.getElementById('balanceAmount');
const bookingSubmit    = document.querySelector('.booking-submit');
const ppfPaymentButton = document.getElementById('ppfPaymentButton');
const paymentStatus    = document.getElementById('paymentStatus');

const ppfPrepaidAmount = 10000;
let razorpayKeyId = '';
let cachedOrderPromise = null;
let slotCounter = 0;

/* ---- Utility ---- */
function formatPrice(price) {
  if (typeof price === 'number') return `Rs. ${price.toLocaleString('en-IN')}`;
  if (/^\d+-\d+$/.test(price)) {
    return price.split('-').map(n => `Rs. ${Number(n).toLocaleString('en-IN')}`).join(' – ');
  }
  return price;
}

function getApiUrl(path) {
  const baseUrl = window.FOURSIX_CONFIG?.apiBaseUrl?.replace(/\/$/, '') || '';
  if (baseUrl.includes('supabase.co')) {
    const edgeFunctionMap = {
      '/api/config': '/foursix-config',
      '/api/create-ppf-order': '/foursix-create-order',
      '/api/verify-ppf-payment': '/foursix-verify-payment',
      '/api/admin/bookings': '/foursix-admin/bookings',
      '/api/admin/pricing': '/foursix-admin/pricing',
    };
    const edgePath = edgeFunctionMap[path];
    if (edgePath) return `${baseUrl}${edgePath}`;
  }
  return `${baseUrl}${path}`;
}

function getAuthHeaders() {
  const headers = {};
  const anonKey = window.FOURSIX_CONFIG?.supabaseAnonKey;
  if (anonKey) headers['apikey'] = anonKey;
  return headers;
}

async function parseJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(fallbackMessage);
  return response.json();
}

function getCustomerDetails() {
  return {
    name:  document.getElementById('customerName').value.trim()  || 'Not provided',
    phone: document.getElementById('customerPhone').value.trim() || 'Not provided'
  };
}

/* ---- Service slot management ---- */

/**
 * Build the package <options> HTML for a given service key.
 */
function buildPackageOptions(serviceKey) {
  return bookingPrices[serviceKey].packages
    .map((pkg, idx) => `<option value="${idx}">${pkg.label}</option>`)
    .join('');
}

/**
 * Build the service <options> HTML.
 */
function buildServiceOptions() {
  return Object.entries(bookingPrices)
    .map(([key, svc]) => `<option value="${key}">${svc.label}</option>`)
    .join('');
}

/**
 * Create a new service slot DOM node and append it to #servicesList.
 * @param {string|null} preselectedService – serviceKey to preselect (e.g. from URL param)
 */
function addSlot(preselectedService = null) {
  const id = slotCounter++;
  const slot = document.createElement('div');
  slot.className = 'service-slot';
  slot.dataset.slotId = id;

  const firstServiceKey = Object.keys(bookingPrices)[0];
  const defaultServiceKey = preselectedService && bookingPrices[preselectedService]
    ? preselectedService
    : firstServiceKey;

  slot.innerHTML = `
    <div class="service-slot-field">
      <label for="slotService_${id}">Service</label>
      <select id="slotService_${id}" class="slot-service-select">
        ${buildServiceOptions()}
      </select>
    </div>
    <div class="service-slot-field">
      <label for="slotPackage_${id}">Package</label>
      <select id="slotPackage_${id}" class="slot-package-select">
        ${buildPackageOptions(defaultServiceKey)}
      </select>
    </div>
    <button type="button" class="slot-remove-btn" aria-label="Remove service" title="Remove">
      &times;
    </button>
  `;

  // Set preselected service
  const svcSel = slot.querySelector('.slot-service-select');
  svcSel.value = defaultServiceKey;

  servicesList.appendChild(slot);

  // Wire up change handlers
  svcSel.addEventListener('change', () => {
    const pkgSel = slot.querySelector('.slot-package-select');
    pkgSel.innerHTML = buildPackageOptions(svcSel.value);
    updatePrice();
  });
  slot.querySelector('.slot-package-select').addEventListener('change', updatePrice);

  // Remove button
  slot.querySelector('.slot-remove-btn').addEventListener('click', () => {
    slot.remove();
    syncRemoveButtons();
    updatePrice();
  });

  syncRemoveButtons();
  updatePrice();
}

/**
 * Disable the remove button when only one slot remains.
 */
function syncRemoveButtons() {
  const slots = servicesList.querySelectorAll('.service-slot');
  slots.forEach(s => {
    s.querySelector('.slot-remove-btn').disabled = slots.length === 1;
  });
}

/**
 * Read all currently selected services from the slots.
 * Returns array of { serviceKey, serviceLabel, packageLabel, price }
 */
function getSelectedServices() {
  const vehicle = vehicleSelect.value;
  const slots = servicesList.querySelectorAll('.service-slot');
  return Array.from(slots).map(slot => {
    const serviceKey  = slot.querySelector('.slot-service-select').value;
    const packageIdx  = Number(slot.querySelector('.slot-package-select').value);
    const service     = bookingPrices[serviceKey];
    const pkg         = service.packages[packageIdx];
    const price       = pkg.prices[vehicle];
    return {
      serviceKey,
      serviceLabel: service.label,
      packageLabel: pkg.label,
      price
    };
  });
}

/* ---- Price panel ---- */
function updatePrice() {
  const vehicle = vehicleSelect.value;
  summaryVehicle.textContent = vehicleLabels[vehicle];

  const selections = getSelectedServices();

  // Re-build per-service breakdown rows (keep the Vehicle row last)
  // First clear all but the vehicle row
  const vehicleRow = priceBreakdown.querySelector('div:last-child');
  priceBreakdown.innerHTML = '';

  let numericTotal = 0;
  let hasCustom    = false;
  let hasPpf       = false;
  let ppfNumericPrice = 0;

  selections.forEach(({ serviceLabel, packageLabel, price }) => {
    const formattedPrice = formatPrice(price);
    const row = document.createElement('div');
    row.innerHTML = `<span>${serviceLabel}<br><small style="opacity:0.6">${packageLabel}</small></span><strong>${formattedPrice}</strong>`;
    priceBreakdown.appendChild(row);

    if (typeof price === 'number') {
      numericTotal += price;
    } else {
      hasCustom = true;
    }
  });

  // Add vehicle row back
  const vRow = document.createElement('div');
  vRow.innerHTML = `<span>Vehicle</span><strong id="summaryVehicle">${vehicleLabels[vehicle]}</strong>`;
  priceBreakdown.appendChild(vRow);

  // Check PPF (only if exactly one slot and it's PPF with a numeric price)
  if (selections.length === 1
    && selections[0].serviceKey === 'paintProtectionFilm'
    && typeof selections[0].price === 'number') {
    hasPpf = true;
    ppfNumericPrice = selections[0].price;
  }

  // Total display
  if (selections.length === 0) {
    priceValue.textContent = 'Rs. 0';
    priceDetail.textContent = 'Add services to view pricing.';
  } else if (hasCustom) {
    priceValue.textContent = numericTotal > 0
      ? `${formatPrice(numericTotal)} +`
      : 'Custom quote';
    priceDetail.textContent = selections.map(s => s.serviceLabel).join(' + ');
  } else {
    priceValue.textContent = formatPrice(numericTotal);
    priceDetail.textContent = selections.map(s => s.serviceLabel).join(' + ');
  }

  // PPF payment structure
  paymentStructure.classList.toggle('is-active', hasPpf);
  bookingSubmit.classList.toggle('is-hidden', hasPpf);
  paymentStatus.textContent = '';

  if (hasPpf) {
    prepaidAmount.textContent  = formatPrice(ppfPrepaidAmount);
    balanceAmount.textContent  = formatPrice(Math.max(ppfNumericPrice - ppfPrepaidAmount, 0));
    ppfPaymentButton.disabled  = false;
    prefetchPpfOrder();
  } else {
    prepaidAmount.textContent  = '-';
    balanceAmount.textContent  = '-';
    ppfPaymentButton.disabled  = true;
    cachedOrderPromise = null; // reset so a future PPF selection fetches fresh
  }
}

/* ---- Booking payload ---- */
function createBookingPayload(extra = {}) {
  const selections  = getSelectedServices();
  const vehicle     = vehicleSelect.value;
  const customer    = getCustomerDetails();
  const notes       = document.getElementById('bookingNotes').value.trim() || 'None';

  // Compute total
  let numericTotal  = 0;
  let hasCustom     = false;
  selections.forEach(({ price }) => {
    if (typeof price === 'number') numericTotal += price;
    else hasCustom = true;
  });
  const totalPriceStr = hasCustom
    ? (numericTotal > 0 ? `${formatPrice(numericTotal)} + Custom quote` : 'Custom quote')
    : formatPrice(numericTotal);

  const isPpf = selections.length === 1
    && selections[0].serviceKey === 'paintProtectionFilm'
    && typeof selections[0].price === 'number';

  return {
    // Legacy single-service fields (filled from first slot for backwards compat)
    serviceKey: selections[0]?.serviceKey  || '',
    service:    selections[0]?.serviceLabel || '',
    package:    selections[0]?.packageLabel || '',
    // Multi-service fields
    services: selections.map(s => ({
      service: s.serviceLabel,
      package: s.packageLabel,
      price:   formatPrice(s.price)
    })),
    vehicle:        vehicleLabels[vehicle],
    totalPrice:     totalPriceStr,
    prepaidAmount:  formatPrice(ppfPrepaidAmount),
    balanceAmount:  isPpf
      ? formatPrice(Math.max(selections[0].price - ppfPrepaidAmount, 0))
      : formatPrice(0),
    customer,
    notes,
    ...extra
  };
}

/* ---- PPF payment ---- */
function prefetchPpfOrder() {
  if (cachedOrderPromise) return;
  const booking = createBookingPayload();
  cachedOrderPromise = fetch(getApiUrl('/api/create-ppf-order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ booking })
  }).then(async response => {
    const order = await parseJsonResponse(response, 'Payment server is not available. Please try again later.');
    if (!response.ok) throw new Error(order.error || 'Could not create payment order.');
    return order;
  }).catch(err => {
    cachedOrderPromise = null;
    throw err;
  });
}

async function loadPaymentConfig() {
  try {
    const response = await fetch(getApiUrl('/api/config'), { headers: getAuthHeaders() });
    if (!response.ok) return;
    const config = await parseJsonResponse(response, 'Payment server is not returning valid configuration.');
    razorpayKeyId = config.razorpayKeyId || '';
  } catch {
    razorpayKeyId = '';
  }
}

async function startPpfPayment() {
  const selections = getSelectedServices();
  const isPpf = selections.length === 1
    && selections[0].serviceKey === 'paintProtectionFilm'
    && typeof selections[0].price === 'number';
  if (!isPpf) return;

  if (!window.Razorpay) {
    paymentStatus.textContent = 'Payment gateway script could not load. Please try again.';
    return;
  }
  if (!razorpayKeyId) await loadPaymentConfig();
  if (!razorpayKeyId) {
    paymentStatus.textContent = 'Payment is not configured yet. Please contact FourSix Detailing.';
    return;
  }

  ppfPaymentButton.disabled = true;
  paymentStatus.textContent = 'Creating secure payment...';

  try {
    const booking = createBookingPayload();
    if (!cachedOrderPromise) prefetchPpfOrder();
    const order = await cachedOrderPromise;

    const checkout = new Razorpay({
      key: razorpayKeyId,
      amount: order.amount * 100,
      currency: order.currency,
      name: 'FourSix Detailing',
      description: `PPF prepaid booking ${order.bookingId}`,
      order_id: order.orderId,
      method: { upi: true, card: true, netbanking: true, wallet: true, emi: false, cardless_emi: false, paylater: false },
      config: {
        display: {
          blocks: { paymentOptions: { name: 'Payment Options', instruments: [{ method: 'upi' }, { method: 'card' }, { method: 'wallet' }, { method: 'netbanking' }] } },
          hide: [{ method: 'emi' }, { method: 'cardless_emi' }, { method: 'paylater' }],
          sequence: ['block.paymentOptions'],
          preferences: { show_default_blocks: false }
        }
      },
      prefill: {
        name:    booking.customer.name  === 'Not provided' ? '' : booking.customer.name,
        contact: booking.customer.phone === 'Not provided' ? '' : booking.customer.phone
      },
      notes: { bookingId: order.bookingId, service: booking.service, package: booking.package, vehicle: booking.vehicle },
      handler: async response => {
        paymentStatus.textContent = 'Verifying payment and creating booking request...';
        const verifyResponse = await fetch(getApiUrl('/api/verify-ppf-payment'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ booking: createBookingPayload({ bookingId: order.bookingId }), bookingId: order.bookingId, ...response })
        });
        const result = await parseJsonResponse(verifyResponse, 'Payment verification server is not available. Please try again later.');
        if (!verifyResponse.ok) throw new Error(result.error || 'Payment verification failed.');
        try { sessionStorage.setItem('foursix_last_booking', JSON.stringify(result.booking || result)); } catch (_) {}
        paymentStatus.textContent = `Payment complete. Booking ID: ${result.bookingId}`;
        window.location.href = `booking-request.html?bookingId=${encodeURIComponent(result.bookingId)}`;
      },
      modal: {
        ondismiss: () => {
          paymentStatus.textContent = 'Payment was not completed.';
          ppfPaymentButton.disabled = false;
        }
      }
    });
    checkout.open();
  } catch (error) {
    paymentStatus.textContent = error.message || 'Payment could not be started.';
    ppfPaymentButton.disabled = false;
  }
}

/* ---- Submit (WhatsApp) ---- */
function sendBookingRequest(event) {
  event.preventDefault();

  const selections = getSelectedServices();
  const isPpf = selections.length === 1
    && selections[0].serviceKey === 'paintProtectionFilm'
    && typeof selections[0].price === 'number';
  if (isPpf) return;

  const customer = getCustomerDetails();
  const notes    = document.getElementById('bookingNotes').value.trim() || 'None';
  const vehicle  = vehicleSelect.value;

  const serviceLines = selections.map((s, i) =>
    `Service ${i + 1}: ${s.serviceLabel} — ${s.packageLabel} — ${formatPrice(s.price)}`
  );

  let numericTotal = 0;
  let hasCustom    = false;
  selections.forEach(({ price }) => {
    if (typeof price === 'number') numericTotal += price;
    else hasCustom = true;
  });
  const totalStr = hasCustom
    ? (numericTotal > 0 ? `${formatPrice(numericTotal)} + Custom quote` : 'Custom quote')
    : formatPrice(numericTotal);

  const message = [
    'Hello FourSix Detailing, I want to book a service.',
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Vehicle Type: ${vehicleLabels[vehicle]}`,
    ...serviceLines,
    `Total Estimate: ${totalStr}`,
    `Notes: ${notes}`
  ].join('\n');

  // Save to Supabase (non-blocking)
  const payload = createBookingPayload();
  fetch(getApiUrl('/api/admin/bookings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking: payload })
  }).catch(err => console.error('Failed to save booking to Supabase:', err));

  window.open(`https://wa.me/919506745852?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

/* ---- Dynamic pricing from DB ---- */
async function loadDynamicPricing() {
  try {
    const res = await fetch(getApiUrl('/api/admin/pricing'), { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch pricing');
    const data = await res.json();
    if (data.pricing && Object.keys(data.pricing).length > 0) {
      bookingPrices = data.pricing;
      // Rebuild all existing slot selects
      servicesList.querySelectorAll('.service-slot').forEach(slot => {
        const svcSel = slot.querySelector('.slot-service-select');
        const pkgSel = slot.querySelector('.slot-package-select');
        const prevService = svcSel.value;
        svcSel.innerHTML = buildServiceOptions();
        if (bookingPrices[prevService]) {
          svcSel.value = prevService;
          pkgSel.innerHTML = buildPackageOptions(prevService);
        }
      });
      updatePrice();
    }
  } catch (err) {
    console.warn('Could not load live pricing, using default offline pricing:', err);
  }
}

/* ---- Init ---- */
const preselectedService = new URLSearchParams(window.location.search).get('service');
addSlot(preselectedService); // start with one slot

vehicleSelect.addEventListener('change', updatePrice);
addServiceBtn.addEventListener('click', () => addSlot());
bookingForm.addEventListener('submit', sendBookingRequest);
ppfPaymentButton.addEventListener('click', startPpfPayment);

loadPaymentConfig();
loadDynamicPricing();
