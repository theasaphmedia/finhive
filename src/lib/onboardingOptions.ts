// Curated but non-exhaustive lists for the signup form. Any org can still end up with
// any ISO 4217 currency or IANA timezone -- these are just sensible quick-picks.

export const CURRENCY_OPTIONS = [
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
];

export const TIMEZONE_OPTIONS = [
  { tz: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { tz: "Africa/Accra", label: "Africa/Accra (GMT)" },
  { tz: "Africa/Nairobi", label: "Africa/Nairobi (EAT)" },
  { tz: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { tz: "Europe/London", label: "Europe/London (GMT/BST)" },
  { tz: "America/New_York", label: "America/New_York (ET)" },
  { tz: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { tz: "UTC", label: "UTC" },
];
