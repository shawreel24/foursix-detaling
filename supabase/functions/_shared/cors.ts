// Shared CORS headers for all FourSix Detailing Edge Functions
// Allows requests from GitHub Pages and localhost dev

const allowedOrigins = [
  'https://shawreel24.github.io',
  'https://www.foursixdetailing.in',
  'https://foursixdetailing.in',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[1]; // fallback to custom domain
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

// For simple usage without request context (preflight responses)
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://www.foursixdetailing.in',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
