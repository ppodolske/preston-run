# preston.ai v0.5.0 Private Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `preston.run` v0.4.0 into the owner-only authenticated `preston.ai` portal with Google sign-in, secure server-side session handling, approved branding, and correct PWA assets while leaving `parks.preston.run` public and independent.

**Architecture:** Keep the existing Node 20 HTTP application but split it into focused modules. Use Supabase Auth with Google OAuth and PKCE/cookie-backed server sessions via `@supabase/ssr`; every private page request is verified server-side and owner-gated before dashboard HTML is rendered. The unauthenticated response contains only the branded sign-in screen. Static PWA assets are served locally from `public/`.

**Tech Stack:** Node.js >=20, built-in `http`, `@supabase/supabase-js`, `@supabase/ssr`, Supabase Auth/Google OAuth, vanilla HTML/CSS/JS, Web App Manifest, Node built-in test runner/assertions or the existing `npm test` entrypoint.

**Spec:** `docs/superpowers/specs/2026-09-13-life-admin-design.md`

## Global Constraints

- Canonical URL remains `https://preston.run`.
- Product/app name is `preston.ai`.
- Anonymous visitors receive only the minimal sign-in page; they must not receive private dashboard markup or data.
- `parks.preston.run` remains public and is not modified by this release.
- Google login is identity-only; Gmail scopes are not requested in v0.5.0.
- Owner access is controlled by environment variable `OWNER_GOOGLE_EMAIL` and server-verified Supabase user identity.
- Use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OWNER_GOOGLE_EMAIL`, and `SITE_URL=https://preston.run`; no service-role key is needed in this release.
- Session cookies must be `HttpOnly`, `Secure` in production, `SameSite=Lax`, and scoped to `/`.
- Do not authorize using user-editable metadata.
- Package versions must be pinned and the lockfile committed.
- Website uses the approved transparent outdoors `preston.ai` wordmark.
- Favicon/PWA/Apple-touch assets derive from the approved opaque navy outdoors app icon.
- Target release version is exactly `0.5.0`.

---

## Planned file structure

```text
server.js                         # tiny process entrypoint only
src/app.js                        # request handler + route composition
src/config.js                     # validated environment/config
src/auth/supabase.js              # request-scoped Supabase SSR client
src/auth/guard.js                 # owner authorization helpers
src/http/cookies.js               # cookie parser/serializer adapter
src/http/respond.js               # HTML/redirect/static responses
src/http/static.js                # safe public asset serving
src/pages/login.js                # unauthenticated preston.ai sign-in page
src/pages/home.js                 # authenticated dashboard shell
src/routes/auth.js                # /auth/google, callback, logout, denied
src/routes/site.js                # /, manifest/icon/static routes
src/branding.js                   # product/version/app-link constants
public/manifest.webmanifest
public/assets/preston-ai-logo.png
public/icons/favicon-32.png
public/icons/apple-touch-icon.png
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-maskable-512.png
test/config.test.js
test/auth-guard.test.js
test/pages.test.js
test/routes.test.js
test/pwa.test.js
test/smoke.test.js
package.json
package-lock.json
```

The existing large inline HTML/CSS in `server.js` is moved into page modules during this release. Do not keep two divergent homepages.

---

### Task 1: Pin dependencies and establish v0.5.0 configuration

**Files:**
- Modify: `package.json`
- Create: `src/config.js`
- Create: `test/config.test.js`
- Create/update: `package-lock.json`

**Interfaces:**
- Produces `loadConfig(env)` returning `{ port, nodeEnv, siteUrl, supabaseUrl, supabasePublishableKey, ownerGoogleEmail, isProduction }`.
- Later tasks consume this exact object.

- [ ] **Step 1: Write the failing configuration test**

```js
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

const config = loadConfig({
  PORT: '4321',
  NODE_ENV: 'production',
  SITE_URL: 'https://preston.run',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  OWNER_GOOGLE_EMAIL: 'owner@example.com'
});

assert.equal(config.port, 4321);
assert.equal(config.siteUrl, 'https://preston.run');
assert.equal(config.ownerGoogleEmail, 'owner@example.com');
assert.equal(config.isProduction, true);
assert.throws(() => loadConfig({}), /SUPABASE_URL/);
```

- [ ] **Step 2: Run it and confirm failure**

Run: `node test/config.test.js`  
Expected: FAIL because `src/config.js` does not exist.

- [ ] **Step 3: Implement strict config loading**

`src/config.js` must validate all required auth variables at process start, normalize `SITE_URL` without a trailing slash, lowercase `OWNER_GOOGLE_EMAIL`, and parse `PORT` as a positive integer.

Core shape:

```js
function required(env, key) {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1) throw new Error('PORT must be a positive integer');
  const siteUrl = required(env, 'SITE_URL').replace(/\/$/, '');
  return {
    port,
    nodeEnv: env.NODE_ENV || 'development',
    siteUrl,
    supabaseUrl: required(env, 'SUPABASE_URL'),
    supabasePublishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    ownerGoogleEmail: required(env, 'OWNER_GOOGLE_EMAIL').toLowerCase(),
    isProduction: (env.NODE_ENV || 'development') === 'production'
  };
}
module.exports = { loadConfig };
```

- [ ] **Step 4: Pin auth dependencies and version**

Set `package.json` version to `0.5.0`; add exact pinned versions of `@supabase/supabase-js` and `@supabase/ssr` using the versions resolved by `npm install --save-exact @supabase/supabase-js @supabase/ssr` at implementation time, then commit the generated `package-lock.json`.

- [ ] **Step 5: Run config test and npm test**

Run: `node test/config.test.js && npm test`  
Expected: configuration test PASS; existing smoke test may fail only because its hard-coded v0.4.0 marker has not yet been updated in a later task.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/config.js test/config.test.js
git commit -m "chore: prepare preston.ai v0.5.0 auth config"
```

---

### Task 2: Add cookie and response primitives

**Files:**
- Create: `src/http/cookies.js`
- Create: `src/http/respond.js`
- Create: `test/cookies.test.js`

**Interfaces:**
- Produces `parseCookies(header)` -> object.
- Produces `serializeCookie(name, value, options)` -> header string.
- Produces `html(res, status, body, headers={})`, `redirect(res, location, status=302)`, `json(res, status, payload)`.

- [ ] **Step 1: Write failing cookie tests**

Test parsing multiple cookies and serializing an auth cookie with `HttpOnly; SameSite=Lax; Path=/` plus conditional `Secure`.

```js
const assert = require('node:assert/strict');
const { parseCookies, serializeCookie } = require('../src/http/cookies');
assert.deepEqual(parseCookies('a=1; b=hello%20world'), { a: '1', b: 'hello world' });
const value = serializeCookie('sb-test', 'abc', { httpOnly:true, secure:true, sameSite:'Lax', path:'/' });
assert.match(value, /^sb-test=abc;/);
assert.match(value, /HttpOnly/);
assert.match(value, /Secure/);
assert.match(value, /SameSite=Lax/);
assert.match(value, /Path=\//);
```

- [ ] **Step 2: Run and verify failure**

Run: `node test/cookies.test.js`  
Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement parser/serializer and response helpers**

Do not introduce a cookie dependency. Percent-decode values safely and reject control characters in serialized names/values.

- [ ] **Step 4: Run tests**

Run: `node test/cookies.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/http/cookies.js src/http/respond.js test/cookies.test.js
git commit -m "feat: add secure http primitives"
```

---

### Task 3: Build request-scoped Supabase SSR auth client

**Files:**
- Create: `src/auth/supabase.js`
- Create: `test/supabase-adapter.test.js`

**Interfaces:**
- Produces `createRequestSupabase(req, res, config)` returning a Supabase server client.
- Cookie adapter uses `getAll()` and `setAll(cookiesToSet)` semantics required by current `@supabase/ssr`.

- [ ] **Step 1: Write failing adapter tests**

Use fake request/response objects to verify existing cookies are exposed through `getAll()` and `setAll()` appends `Set-Cookie` headers rather than overwriting prior values.

- [ ] **Step 2: Run and confirm failure**

Run: `node test/supabase-adapter.test.js`  
Expected: FAIL because `src/auth/supabase.js` does not exist.

- [ ] **Step 3: Implement `createRequestSupabase`**

Use:

```js
const { createServerClient } = require('@supabase/ssr');
```

Instantiate with `config.supabaseUrl`, `config.supabasePublishableKey`, and a cookie adapter backed by the request's `Cookie` header and response `Set-Cookie` headers. Ensure cookies set by Supabase are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `config.isProduction`.

- [ ] **Step 4: Verify tests**

Run: `node test/supabase-adapter.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/supabase.js test/supabase-adapter.test.js
git commit -m "feat: add Supabase SSR session client"
```

---

### Task 4: Add owner authorization guard

**Files:**
- Create: `src/auth/guard.js`
- Create: `test/auth-guard.test.js`

**Interfaces:**
- Produces `getAuthorizedOwner(supabase, config)` -> `{ user }` or `{ user:null, reason:'signed_out'|'not_owner'|'auth_error' }`.
- Uses `supabase.auth.getUser()` for a server-verified identity.

- [ ] **Step 1: Write failing tests for all branches**

Cover:
1. signed-out user returns `signed_out`;
2. matching email case-insensitively returns the user;
3. different email returns `not_owner`;
4. Supabase auth error returns `auth_error`.

- [ ] **Step 2: Run and verify failure**

Run: `node test/auth-guard.test.js`.

- [ ] **Step 3: Implement exact owner check**

```js
async function getAuthorizedOwner(supabase, config) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user:null, reason:'auth_error' };
  if (!data.user) return { user:null, reason:'signed_out' };
  const email = (data.user.email || '').toLowerCase();
  if (email !== config.ownerGoogleEmail) return { user:null, reason:'not_owner' };
  return { user:data.user, reason:null };
}
```

- [ ] **Step 4: Run tests**

Run: `node test/auth-guard.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/guard.js test/auth-guard.test.js
git commit -m "feat: enforce owner-only portal access"
```

---

### Task 5: Add approved preston.ai branding and PWA assets

**Files:**
- Create: `src/branding.js`
- Create: `public/assets/preston-ai-logo.png`
- Create: `public/icons/favicon-32.png`
- Create: `public/icons/apple-touch-icon.png`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `public/manifest.webmanifest`
- Create: `test/pwa.test.js`

**Interfaces:**
- `src/branding.js` exports `{ PRODUCT_NAME:'preston.ai', VERSION:'0.5.0', APPS }`.
- Manifest uses `name` and `short_name` equal to `preston.ai` and `start_url` `/`.

- [ ] **Step 1: Write failing PWA tests**

Tests must parse `public/manifest.webmanifest` and assert:
- `name === 'preston.ai'`
- `short_name === 'preston.ai'`
- `start_url === '/'`
- `display === 'standalone'`
- icon entries include 192x192, 512x512, and a 512x512 maskable icon
- all referenced asset files exist.

- [ ] **Step 2: Run and verify failure**

Run: `node test/pwa.test.js`.

- [ ] **Step 3: Copy the approved transparent website logo**

Use the approved generated transparent outdoors wordmark from this design session as source and save it exactly as:

`public/assets/preston-ai-logo.png`

Do not regenerate or reinterpret the logo during implementation.

- [ ] **Step 4: Derive icon sizes from the approved opaque outdoors app icon**

Using the approved navy rounded-square outdoors icon as the source, create:
- `favicon-32.png` at 32x32
- `apple-touch-icon.png` at 180x180
- `icon-192.png` at 192x192
- `icon-512.png` at 512x512
- `icon-maskable-512.png` at 512x512 with enough safe-zone padding that the central `P`/mountain/path mark survives platform masks.

Use a deterministic image resize tool and preserve aspect ratio; do not add text.

- [ ] **Step 5: Create manifest and branding constants**

Manifest theme/background color should match the approved deep navy icon background. `APPS` includes Dose & Scale, State Parks, and Archive with their existing URLs.

- [ ] **Step 6: Run PWA tests**

Run: `node test/pwa.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/branding.js public test/pwa.test.js
git commit -m "feat: add preston.ai brand and PWA assets"
```

---

### Task 6: Build the minimal unauthenticated sign-in page

**Files:**
- Create: `src/pages/login.js`
- Create: `test/pages.test.js`

**Interfaces:**
- Produces `renderLoginPage({ error })` -> complete HTML string.

- [ ] **Step 1: Write failing page privacy tests**

Assert the login page:
- contains `preston.ai`
- references `/assets/preston-ai-logo.png`
- contains a form/button to `/auth/google`
- references the manifest/favicon
- does **not** contain `Dose & Scale`, `State Parks`, `Archive`, `Website admin`, weather hooks, birthday/trip/Life Admin labels, Railway URLs, or private dashboard section IDs.

- [ ] **Step 2: Run and verify failure**

Run: `node test/pages.test.js`.

- [ ] **Step 3: Implement `renderLoginPage`**

The page is intentionally sparse: logo, `Personal dashboard`, `Sign in with Google`, optional safe generic error message. Do not embed owner email or environment values in HTML.

Add:

```html
<meta name="robots" content="noindex,nofollow">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon-32.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

- [ ] **Step 4: Run tests**

Run: `node test/pages.test.js`  
Expected: login privacy checks PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/login.js test/pages.test.js
git commit -m "feat: add private preston.ai sign-in page"
```

---

### Task 7: Refactor the authenticated dashboard into its own page module

**Files:**
- Create: `src/pages/home.js`
- Modify: `test/pages.test.js`

**Interfaces:**
- Produces `renderHomePage({ user })` -> complete authenticated HTML string.

- [ ] **Step 1: Add failing authenticated-home tests**

Assert the home page:
- contains the approved logo and `preston.ai`
- contains a personalized greeting without exposing the owner's email by default
- retains Dose & Scale, State Parks, Archive links
- retains current weather/today/admin functionality only inside authenticated HTML
- contains `/auth/logout`
- displays release marker `v0.5.0`
- includes manifest/favicon links.

- [ ] **Step 2: Run and verify failure**

Run: `node test/pages.test.js`.

- [ ] **Step 3: Move the v0.4.0 dashboard markup from `server.js` into `renderHomePage`**

Preserve the working weather status hook and app health checks. Replace visible `Preston.run` brand text with `preston.ai` where it refers to product branding; URLs remain `preston.run`.

Add a clear sign-out control. Do not yet add fake Life Admin cards—those begin in v0.6.0.

- [ ] **Step 4: Run tests**

Run: `node test/pages.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/home.js test/pages.test.js
git commit -m "refactor: move dashboard into authenticated home"
```

---

### Task 8: Implement Google OAuth routes and logout

**Files:**
- Create: `src/routes/auth.js`
- Create: `test/routes.test.js`

**Interfaces:**
- Produces `handleAuthRoute(req, res, context)` -> boolean indicating whether the route was handled.
- Handles `GET /auth/google`, `GET /auth/callback`, `POST /auth/logout`, `GET /auth/denied`.

- [ ] **Step 1: Write failing route tests with a fake Supabase client**

Cover:
- `/auth/google` calls `signInWithOAuth({ provider:'google', options:{ redirectTo:'https://preston.run/auth/callback' }})` with no Gmail scopes and redirects to returned URL.
- callback exchanges the `code`, calls owner authorization, redirects owner to `/`.
- callback signs out a non-owner and redirects `/auth/denied`.
- logout calls `supabase.auth.signOut()` and redirects `/`.
- OAuth failures redirect to `/?auth_error=1` without leaking provider error text.

- [ ] **Step 2: Run and verify failure**

Run: `node test/routes.test.js`.

- [ ] **Step 3: Implement routes**

Use Supabase PKCE flow and `exchangeCodeForSession(code)` in the callback. Do not request Gmail scopes in `signInWithOAuth`.

Use `config.siteUrl + '/auth/callback'` as redirect URL.

- [ ] **Step 4: Run route tests**

Run: `node test/routes.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.js test/routes.test.js
git commit -m "feat: add owner-only Google sign-in"
```

---

### Task 9: Add safe static serving and authenticated site routing

**Files:**
- Create: `src/http/static.js`
- Create: `src/routes/site.js`
- Create: `src/app.js`
- Replace: `server.js`
- Extend: `test/routes.test.js`

**Interfaces:**
- `createApp(config)` returns async Node request handler.
- `server.js` only loads config, creates HTTP server, and listens.

- [ ] **Step 1: Add failing privacy/routing tests**

Using fake Supabase clients, verify:
- anonymous `GET /` returns login page and does not contain any dashboard-only marker;
- owner `GET /` returns authenticated home;
- non-owner `GET /` returns denied/logout-safe response and no dashboard;
- `/manifest.webmanifest`, logo, and icons are available without authentication;
- unknown paths return 404;
- private-looking paths are not accidentally served as static files;
- responses carrying authenticated HTML set `Cache-Control: private, no-store`.

- [ ] **Step 2: Run and verify failure**

Run: `node test/routes.test.js`.

- [ ] **Step 3: Implement static allow-list**

Serve only files beneath `public/`, reject traversal (`..`, encoded traversal, null bytes), and set correct types for PNG and webmanifest.

- [ ] **Step 4: Implement site router and app composition**

Route order:
1. approved static assets;
2. auth routes;
3. `/` authenticated gate;
4. 404.

For `/`, create the request Supabase client, call `getAuthorizedOwner`, and render login/home accordingly.

- [ ] **Step 5: Shrink `server.js`**

Target shape:

```js
const http = require('node:http');
const { loadConfig } = require('./src/config');
const { createApp } = require('./src/app');
const config = loadConfig();
http.createServer(createApp(config)).listen(config.port, () => {
  console.log(`preston.ai v0.5.0 listening on ${config.port}`);
});
```

- [ ] **Step 6: Run routing tests**

Run: `node test/routes.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server.js src/app.js src/http/static.js src/routes/site.js test/routes.test.js
git commit -m "feat: make preston.ai private by default"
```

---

### Task 10: Replace brittle v0.4.0 smoke test with v0.5.0 release verification

**Files:**
- Replace: `test.js`
- Create: `test/smoke.test.js`
- Modify: `package.json`

**Interfaces:**
- `npm test` runs every v0.5.0 test file and exits non-zero on any failure.

- [ ] **Step 1: Write release smoke checks**

`test/smoke.test.js` must assert:
- package version `0.5.0`
- branding constant version `0.5.0`
- app links for Dose & Scale, State Parks, Archive remain present
- State Parks URL remains `https://parks.preston.run`
- approved PWA manifest exists and says `preston.ai`
- no Railway admin URL appears in `renderLoginPage()`
- authenticated home still includes weather condition hook `id="condition"`.

- [ ] **Step 2: Make `test.js` run the complete suite**

Implement a deterministic list of test files using `child_process.spawnSync(process.execPath, [file], { stdio:'inherit' })`; exit on first non-zero code.

Suite order:

```js
[
  'test/config.test.js',
  'test/cookies.test.js',
  'test/supabase-adapter.test.js',
  'test/auth-guard.test.js',
  'test/pages.test.js',
  'test/routes.test.js',
  'test/pwa.test.js',
  'test/smoke.test.js'
]
```

- [ ] **Step 3: Run full suite**

Run: `npm test`  
Expected: all v0.5.0 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add test.js test/smoke.test.js package.json
git commit -m "test: verify preston.ai v0.5.0 foundation"
```

---

### Task 11: Configure Supabase Google Auth and Railway environment

**Files:**
- Modify documentation only if a repository runbook already exists; otherwise no code file is required.
- External configuration: Supabase Auth provider + redirect allow-list; Railway environment variables.

**Interfaces:**
- Runtime receives the four required configuration variables.

- [ ] **Step 1: Verify current Supabase documentation before changing settings**

Check the current Supabase changelog and Google/SSR Auth documentation because auth configuration is time-sensitive.

- [ ] **Step 2: Configure Google provider in Supabase**

Enable Google provider with the Google OAuth client credentials intended for this private portal.

- [ ] **Step 3: Configure redirect URLs**

Allow exactly the production callback required by the app:

`https://preston.run/auth/callback`

Add a localhost callback only if needed for a local verification run.

- [ ] **Step 4: Set Railway variables**

Set:

```text
SITE_URL=https://preston.run
SUPABASE_URL=<project URL>
SUPABASE_PUBLISHABLE_KEY=<publishable key>
OWNER_GOOGLE_EMAIL=<designated owner Google account>
NODE_ENV=production
```

Never add these values to GitHub.

- [ ] **Step 5: Confirm no Gmail scopes are configured/requested**

Gmail connection is deferred to v0.10.0.

---

### Task 12: End-to-end verification before release claim

**Files:**
- No new files unless a failing verification requires a tested fix.

- [ ] **Step 1: Run automated verification**

Run:

```bash
npm ci
npm test
```

Expected: clean install and all tests PASS.

- [ ] **Step 2: Start the application with production-like environment**

Run the app with test/project credentials and verify there are no startup validation errors.

- [ ] **Step 3: Verify logged-out behavior in browser**

Confirm `https://preston.run` shows only preston.ai branding and Google sign-in. View source/network response and confirm no dashboard content, app admin links, personal summaries, or owner email are present.

- [ ] **Step 4: Verify owner Google login**

Sign in with the designated owner account and confirm the authenticated dashboard loads, the approved transparent wordmark appears, existing app links/weather/status functionality still works, and logout returns to the minimal sign-in page.

- [ ] **Step 5: Verify non-owner denial**

Use a different Google account or test identity and confirm it cannot reach authenticated home content.

- [ ] **Step 6: Verify PWA identity**

Confirm manifest loads, install name is `preston.ai`, favicon uses the approved icon, Apple touch icon resolves, and 192/512/maskable icons return successfully.

- [ ] **Step 7: Verify the public State Parks boundary**

Open `https://parks.preston.run` logged out and confirm it remains public and functional.

- [ ] **Step 8: Verify Railway deployment health**

Confirm deployed service starts successfully and `preston.run` serves v0.5.0 after the code is merged/deployed.

- [ ] **Step 9: Final release commit/tag only after evidence is clean**

If the repository uses release tags, tag `v0.5.0`; otherwise rely on package/app version. Do not claim completion until automated tests and browser verification both pass.

---

## Self-review checklist

- Spec coverage for v0.5.0: branding, authenticated-by-default portal, Google sign-in, owner allow-list, PWA naming/icons, secure session handling, minimal anonymous page, preserved existing dashboard functionality, State Parks public boundary.
- Explicitly deferred: private database tables, birthdays, Life Admin, trips, push notifications, Gmail, Morning Digest aggregation. Those belong to later version plans and are intentionally absent from v0.5.0.
- No Gmail OAuth scopes are requested in this release.
- No service-role key is exposed or required.
- Anonymous HTML has no private dashboard content.
- Version is consistently `0.5.0`.
- Every implementation task contains a test/failure/pass cycle and an independently reviewable commit.
