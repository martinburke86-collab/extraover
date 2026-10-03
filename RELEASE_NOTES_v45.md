# ExtraOver v45 - Security patch: Next.js 14.2.35

Framework security update ahead of founding users. No functional changes,
no schema changes.

## Next.js 14.1.0 to 14.2.35
Latest patched 14.x release. Clears the critical middleware authorization
bypass (GHSA-f82v-jwr5-mffw), which mattered here because every page is
gated by `src/middleware.ts`, plus the Server Actions SSRF, cache
poisoning and Server Components denial-of-service advisories fixed across
14.1 to 14.2.

## next-auth 4.24.14 to 4.24.15
Patch release clearing a critical email normalisation advisory and a
crash on malformed Bearer headers.

## Image optimizer disabled
`images.unoptimized: true` in `next.config.js`. The app only uses plain
`<img>` tags, so nothing changes visually, but `/_next/image` now returns
404 and the built-in optimizer never runs. This closes the image optimizer
advisories (including an AVIF remote code execution) that are only patched
in Next 15.5.24+.

## Verification
- `npm run build` and `tsc --noEmit` clean, no new warnings
- Every page and GET API route smoke-tested on 14.1.0 and 14.2.35 against
  the same data: identical status codes and identical JSON bodies; Excel
  export sheets byte-identical, PDF report renders the same 6 pages
- Middleware still redirects missing and forged session cookies to login

## Still flagged by npm audit
- `next` remains listed as critical: the Windows-hosting RCE does not apply
  (Vercel runs Linux) and the image optimizer RCE is closed by the config
  above. Full clearance needs the Next 15 / React 19 migration.
- `xlsx` (SheetJS) has no npm fix; the patched build is only published on
  the SheetJS CDN. Used for imports, so worth replacing.

## Deferred
- API route authorisation: 17 project data routes (dashboard, export,
  report, cost codes, prelims, periods/lock, import and others) have no
  session check, and `/api/projects` GET/DELETE are open. Middleware
  deliberately skips `/api/*`. Must be closed before founding users.
- Demo seed (`src/lib/seed.ts`) fails on a positional INSERT into
  projects; fix alongside the demo-seed button.
