const bookingPrices = {
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
const ppfPrepaidAmount = 10000;

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
  if (isPpf) {
    prepaidAmount.textContent = formatPrice(ppfPrepaidAmount);
    balanceAmount.textContent = formatPrice(Math.max(price - ppfPrepaidAmount, 0));
  } else {
    prepaidAmount.textContent = '-';
    balanceAmount.textContent = '-';
  }
}

function sendBookingRequest(event) {
  event.preventDefault();

  const { service, selectedPackage, vehicle, price } = getSelection();
  const name = document.getElementById('customerName').value.trim() || 'Not provided';
  const phone = document.getElementById('customerPhone').value.trim() || 'Not provided';
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
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${service.label}`,
    `Package: ${selectedPackage.label}`,
    `Vehicle Type: ${vehicleLabels[vehicle]}`,
    `Price: ${formatPrice(price)}`,
    ...paymentLines,
    `Notes: ${notes}`
  ].join('\n');

  window.open(`https://wa.me/919506745852?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

populateServices();
populatePackages();
updatePrice();

serviceSelect.addEventListener('change', () => {
  populatePackages();
  updatePrice();
});

packageSelect.addEventListener('change', updatePrice);
vehicleSelect.addEventListener('change', updatePrice);
bookingForm.addEventListener('submit', sendBookingRequest);
