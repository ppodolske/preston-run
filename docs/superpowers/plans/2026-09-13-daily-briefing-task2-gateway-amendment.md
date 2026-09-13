# v0.11.0 Daily Briefing — Task 2 Gateway Amendment

This amendment is part of the approved implementation plan in `docs/superpowers/plans/2026-09-13-daily-briefing-integration.md` and supersedes Task 2 where the original task assumed external requests reached `server.js` directly.

## Root cause

Dose & Scale production traffic first reaches `login-wrapper.js`, which proxies to the child `server.js`. The gateway normally requires a browser session/Basic Auth and rewrites `Authorization` to internal Basic Auth. Therefore a preston.ai service Bearer token would otherwise be rejected or overwritten before reaching `server.js`.

## Approved Task 2 behavior

- Add a pure gateway policy module `lib/preston-gateway.js`.
- `/api/preston/daily-context` is a dedicated service path.
- `login-wrapper.js` validates `PRESTON_SERVICE_TOKEN` for this path before browser authentication.
- Invalid/missing service Bearer tokens receive `401` even when browser Basic Auth/session is present.
- Valid service Bearer tokens are preserved when proxying to the child server.
- Ordinary browser/API requests continue to receive the gateway's internal Basic Auth header.
- `server.js` independently validates the same service Bearer token before `app.use(auth)` and then builds the constrained daily-context response.
- `/health` remains public.
- Browser Basic Auth is neither required nor sufficient for the preston.ai service endpoint.

## Verification requirements

- Pure service auth/handler tests.
- Pure gateway classification tests.
- Proxy-header test proving service Bearer preservation and ordinary Basic Auth rewriting.
- Static ordering check showing the child service route is registered before `app.use(auth)`.
- Static gateway check showing service classification/rejection occurs before browser session/Basic Auth logic.

No production deployment is authorized by this amendment.
