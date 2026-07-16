// Vercel gives every deployment its own throwaway URL (e.g.
// finhive-pwzgcrd4e-taiglobal.vercel.app) in addition to the stable aliases
// (finhive-app-taiglobal.vercel.app). Those per-deployment URLs sit behind
// Vercel's own team login by default -- so if an admin happens to be browsing
// one when they send a magic-link/invite email, `window.location.origin`
// bakes that protected URL into the link, and the recipient hits a Vercel
// sign-in wall instead of FinHive.
//
// Set NEXT_PUBLIC_SITE_URL in the Vercel project's environment variables to
// one of the stable aliased domains to pin every generated link to it,
// regardless of which URL the sender happens to be on. Falls back to
// window.location.origin so local dev keeps working without extra setup.
export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
}
