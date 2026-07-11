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

const vehicleLabels = {
  small: 'Small Car',
  sedan: 'Sedan',
  suv: 'SUV'
};

const serviceSelect = document.getElementById('serviceSelect');
const packageSelect = document.getElementById('packageSelect');
const vehicleSelect = document.getElementById('vehicleSelect');
const priceValue = document.getElementById('priceValue');
const priceDetail = document.getElementById('priceDetail');
const summaryService = document.getElementById('summaryService');
const summaryPackage = document.getElementById('summaryPackage');
const summaryVehicle = document.getElementById('summaryVehicle');
const bookingForm = document.getElementById('bookingForm');
const paymentStructure = document.getElementById('paymentStructure');
const prepaidAmount = document.getElementById('prepaidAmount');
const balanceAmount = document.getElementById('balanceAmount');
const bookingSubmit = document.querySelector('.booking-submit');
const ppfPaymentButton = document.getElementById('ppfPaymentButton');
const paymentStatus = document.getElementById('paymentStatus');
const ppfPrepaidAmount = 10000;
let razorpayKeyId = '';
let cachedOrderPromise = null;

function prefetchPpfOrder() {
  if (cachedOrderPromise) return;
  const booking = createBookingPayload();
  cachedOrderPromise = fetch(getApiUrl('/api/create-ppf-order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ booking })
  }).then(async (response) => {
    const order = await parseJsonResponse(response, 'Payment server is not available. Please try again later.');
    if (!response.ok) throw new Error(order.error || 'Could not create payment order.');
    return order;
  }).catch(err => {
    cachedOrderPromise = null;
    throw err;
  });
}

function getApiUrl(path) {
  const baseUrl = window.FOURSIX_CONFIG?.apiBaseUrl?.replace(/\/$/, '') || '';
  // Map Express-style paths to Supabase Edge Function names when using cloud backend
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

// Returns Authorization and apikey headers for Supabase Edge Function calls.
function getAuthHeaders() {
  const headers = {};
  const anonKey = window.FOURSIX_CONFIG?.supabaseAnonKey;
  if (anonKey) {
    headers['apikey'] = anonKey;
  }
  return headers;
}

function formatPrice(price) {
  if (typeof price === 'number') {
    return `Rs. ${price.toLocaleString('en-IN')}`;
  }

  if (/^\d+-\d+$/.test(price)) {
    return price
      .split('-')
      .map((item) => `Rs. ${Number(item).toLocaleString('en-IN')}`)
      .join(' - ');
  }

  return price;
}

function getSelection() {
  const service = bookingPrices[serviceSelect.value];
  const selectedPackage = service.packages[Number(packageSelect.value)];
  const vehicle = vehicleSelect.value;
  const price = selectedPackage.prices[vehicle];

  return { service, selectedPackage, vehicle, price };
}

function getCustomerDetails() {
  return {
    name: document.getElementById('customerName').value.trim() || 'Not provided',
    phone: document.getElementById('customerPhone').value.trim() || 'Not provided'
  };
}

function createBookingPayload(extra = {}) {
  const { service, selectedPackage, vehicle, price } = getSelection();
  const balance = typeof price === 'number' ? Math.max(price - ppfPrepaidAmount, 0) : 'Custom quote';

  return {
    serviceKey: serviceSelect.value,
    service: service.label,
    package: selectedPackage.label,
    vehicle: vehicleLabels[vehicle],
    totalPrice: formatPrice(price),
    prepaidAmount: formatPrice(ppfPrepaidAmount),
    balanceAmount: formatPrice(balance),
    customer: getCustomerDetails(),
    notes: document.getElementById('bookingNotes').value.trim() || 'None',
    ...extra
  };
}

function populateServices() {
  serviceSelect.innerHTML = Object.entries(bookingPrices)
    .map(([value, service]) => `<option value="${value}">${service.label}</option>`)
    .join('');

  const selectedService = new URLSearchParams(window.location.search).get('service');
  if (selectedService && bookingPrices[selectedService]) {
    serviceSelect.value = selectedService;
  }
}

function populatePackages() {
  const service = bookingPrices[serviceSelect.value];
  packageSelect.innerHTML = service.packages
    .map((item, index) => `<option value="${index}">${item.label}</option>`)
    .join('');
}

function updatePrice() {
  const { service, selectedPackage, vehicle, price } = getSelection();
  const formattedPrice = formatPrice(price);
  const isPpf = serviceSelect.value === 'paintProtectionFilm' && typeof price === 'number';

  priceValue.textContent = formattedPrice;
  priceDetail.textContent = `${service.label} / ${selectedPackage.label} / ${vehicleLabels[vehicle]}`;
  summaryService.textContent = service.label;
  summaryPackage.textContent = selectedPackage.label;
  summaryVehicle.textContent = vehicleLabels[vehicle];

  paymentStructure.classList.toggle('is-active', isPpf);
  bookingSubmit.classList.toggle('is-hidden', isPpf);
  paymentStatus.textContent = '';
  if (isPpf) {
    prepaidAmount.textContent = formatPrice(ppfPrepaidAmount);
    balanceAmount.textContent = formatPrice(Math.max(price - ppfPrepaidAmount, 0));
    ppfPaymentButton.disabled = false;
    prefetchPpfOrder();
  } else {
    prepaidAmount.textContent = '-';
    balanceAmount.textContent = '-';
    ppfPaymentButton.disabled = true;
  }
}

async function loadPaymentConfig() {
  try {
    const response = await fetch(getApiUrl('/api/config'), {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return;
    }
    const config = await parseJsonResponse(response, 'Payment server is not returning valid configuration.');
    razorpayKeyId = config.razorpayKeyId || '';
  } catch {
    razorpayKeyId = '';
  }
}

async function parseJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

async function startPpfPayment() {
  const { price } = getSelection();
  if (serviceSelect.value !== 'paintProtectionFilm' || typeof price !== 'number') {
    return;
  }

  if (!window.Razorpay) {
    paymentStatus.textContent = 'Payment gateway script could not load. Please try again.';
    return;
  }

  if (!razorpayKeyId) {
    await loadPaymentConfig();
  }

  if (!razorpayKeyId) {
    paymentStatus.textContent = 'Payment is not configured yet. Please contact FourSix Detailing.';
    return;
  }

  ppfPaymentButton.disabled = true;
  paymentStatus.textContent = 'Creating secure payment...';

  try {
    const booking = createBookingPayload();
    
    if (!cachedOrderPromise) {
      prefetchPpfOrder();
    }
    const order = await cachedOrderPromise;

    const checkout = new Razorpay({
      key: razorpayKeyId,
      amount: order.amount * 100,
      currency: order.currency,
      name: 'FourSix Detailing',
      description: `PPF prepaid booking ${order.bookingId}`,
      order_id: order.orderId,
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: false,
        cardless_emi: false,
        paylater: false
      },
      config: {
        display: {
          blocks: {
            paymentOptions: {
              name: 'Payment Options',
              instruments: [
                { method: 'upi' },
                { method: 'card' },
                { method: 'wallet' },
                { method: 'netbanking' }
              ]
            }
          },
          hide: [
            { method: 'emi' },
            { method: 'cardless_emi' },
            { method: 'paylater' }
          ],
          sequence: ['block.paymentOptions'],
          preferences: {
            show_default_blocks: false
          }
        }
      },
      prefill: {
        name: booking.customer.name === 'Not provided' ? '' : booking.customer.name,
        contact: booking.customer.phone === 'Not provided' ? '' : booking.customer.phone
      },
      notes: {
        bookingId: order.bookingId,
        service: booking.service,
        package: booking.package,
        vehicle: booking.vehicle
      },
      handler: async (response) => {
        paymentStatus.textContent = 'Verifying payment and creating booking request...';

        const verifyResponse = await fetch(getApiUrl('/api/verify-ppf-payment'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            booking: createBookingPayload({ bookingId: order.bookingId }),
            bookingId: order.bookingId,
            ...response
          })
        });
        const result = await parseJsonResponse(
          verifyResponse,
          'Payment verification server is not available. Please try again later.'
        );

        if (!verifyResponse.ok) {
          throw new Error(result.error || 'Payment verification failed.');
        }

        // Store confirmed booking in sessionStorage so booking-request.html
        // can display it without needing a server-side lookup (stateless).
        try {
          sessionStorage.setItem('foursix_last_booking', JSON.stringify(result.booking || result));
        } catch (_) {
          // sessionStorage write failure is non-fatal
        }

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

function sendBookingRequest(event) {
  event.preventDefault();

  const { service, selectedPackage, vehicle, price } = getSelection();
  const customer = getCustomerDetails();
  const notes = document.getElementById('bookingNotes').value.trim() || 'None';
  const isPpf = serviceSelect.value === 'paintProtectionFilm' && typeof price === 'number';
  if (isPpf) {
    return;
  }
  const paymentLines = isPpf
    ? [
        `Prepaid to confirm: ${formatPrice(ppfPrepaidAmount)}`,
        `Balance after work: ${formatPrice(Math.max(price - ppfPrepaidAmount, 0))}`
      ]
    : [];
  const message = [
    'Hello FourSix Detailing, I want to book a service.',
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Service: ${service.label}`,
    `Package: ${selectedPackage.label}`,
    `Vehicle Type: ${vehicleLabels[vehicle]}`,
    `Price: ${formatPrice(price)}`,
    ...paymentLines,
    `Notes: ${notes}`
  ].join('\n');

  // Save booking details to Supabase database (non-blocking)
  const payload = createBookingPayload();
  fetch(getApiUrl('/api/admin/bookings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking: payload })
  }).catch(err => console.error('Failed to save booking to Supabase:', err));

  window.open(`https://wa.me/919506745852?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

// Load dynamic pricing from database
async function loadDynamicPricing() {
  try {
    const res = await fetch(getApiUrl('/api/admin/pricing'), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch pricing');
    const data = await res.json();
    if (data.pricing && Object.keys(data.pricing).length > 0) {
      bookingPrices = data.pricing;
      // Re-populate dropdowns with updated prices
      populateServices();
      populatePackages();
      updatePrice();
    }
  } catch (err) {
    console.warn('Could not load live pricing, using default offline pricing:', err);
  }
}

populateServices();
populatePackages();
loadPaymentConfig();
updatePrice();
loadDynamicPricing();

serviceSelect.addEventListener('change', () => {
  populatePackages();
  updatePrice();
});

packageSelect.addEventListener('change', updatePrice);
vehicleSelect.addEventListener('change', updatePrice);
bookingForm.addEventListener('submit', sendBookingRequest);
ppfPaymentButton.addEventListener('click', startPpfPayment);
