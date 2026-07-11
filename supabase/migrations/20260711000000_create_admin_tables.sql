-- Create bookings table
create table if not exists public.bookings (
  booking_id text primary key,
  customer jsonb not null,
  service text not null,
  package text not null,
  vehicle text not null,
  total_price text not null,
  prepaid_amount text not null,
  balance_amount text not null,
  notes text,
  razorpay_order_id text,
  razorpay_payment_id text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone
);

-- Enable RLS but allow service role role by default
alter table public.bookings enable row level security;

-- Create policy to allow only authenticated select/insert/update/delete (or service role)
-- Since we do auth inside the Edge Function, we can just allow service role (default) or bypass RLS.
-- To allow public insertion (for WhatsApp bookings) we can add an insert policy:
create policy "Allow public insert of bookings" on public.bookings
  for insert with check (true);

-- Create pricing table
create table if not exists public.pricing (
  id integer primary key default 1,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint single_row check (id = 1)
);

-- Seed default pricing
insert into public.pricing (id, data)
values (1, '{
  "detailing": {
    "label": "Car Detailing",
    "packages": [
      { "label": "Mini Detailing", "prices": { "small": 2000, "sedan": 2500, "suv": "2500-3000" } },
      { "label": "Full Detailing", "prices": { "small": 3500, "sedan": 4000, "suv": "4000-5000" } }
    ]
  },
  "paintCorrection": {
    "label": "Paint Correction",
    "packages": [
      { "label": "1 Step Paint Correction", "prices": { "small": 2000, "sedan": 2500, "suv": 3000 } },
      { "label": "2 Step Paint Correction", "prices": { "small": 3000, "sedan": 3500, "suv": 4000 } },
      { "label": "3 Step Paint Correction", "prices": { "small": 6000, "sedan": 7000, "suv": 8000 } }
    ]
  },
  "ceramicCoating": {
    "label": "Ceramic Coating",
    "packages": [
      { "label": "3 Years Warranty", "prices": { "small": 15000, "sedan": 17000, "suv": 18000 } },
      { "label": "5 Years Warranty", "prices": { "small": 25000, "sedan": 27000, "suv": 30000 } }
    ]
  },
  "chasisCoating": {
    "label": "Chasis Coating",
    "packages": [
      { "label": "Chasis Coating", "prices": { "small": 4000, "sedan": 4500, "suv": 5000 } }
    ]
  },
  "elastomerCoating": {
    "label": "Elastomer Coating",
    "packages": [
      { "label": "3 Years Warranty", "prices": { "small": 18000, "sedan": 21000, "suv": 25000 } },
      { "label": "5 Years Warranty", "prices": { "small": 28000, "sedan": 30000, "suv": 35000 } }
    ]
  },
  "paintProtectionFilm": {
    "label": "Paint Protection Film (PPF)",
    "packages": [
      { "label": "No Warranty", "prices": { "small": 70000, "sedan": 75000, "suv": 80000 } },
      { "label": "3 Years Warranty", "prices": { "small": 100000, "sedan": 110000, "suv": 120000 } },
      { "label": "5 Years Warranty", "prices": { "small": 120000, "sedan": 130000, "suv": 140000 } },
      { "label": "7 Years Warranty", "prices": { "small": 150000, "sedan": 170000, "suv": 180000 } }
    ]
  },
  "windowTinting": {
    "label": "Window Tinting / Ceramic Tint",
    "packages": [
      { "label": "Sun Control", "prices": { "small": 3000, "sedan": 3500, "suv": 3500 } },
      { "label": "Ceramic Tint", "prices": { "small": 8000, "sedan": 8000, "suv": 8500 } },
      { "label": "Windshield Tint", "prices": { "small": 4500, "sedan": 4500, "suv": 4500 } },
      { "label": "Ceramic + Windshield Tint Combine", "prices": { "small": 12000, "sedan": 12000, "suv": 12000 } }
    ]
  },
  "carWrapping": {
    "label": "Car Wrapping",
    "packages": [
      { "label": "Custom Wrap Consultation", "prices": { "small": "Custom quote", "sedan": "Custom quote", "suv": "Custom quote" } }
    ]
  }
}')
on conflict (id) do nothing;
