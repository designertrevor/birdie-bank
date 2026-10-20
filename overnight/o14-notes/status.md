# Overnight 14: status page and content security policy

Branch `o14/status`. Two items from roadmap area 25: "A status page" and "A full content security policy".
ROADMAP.md is not edited; check both off when this ships.

## What was built

### 1. The status page, at /status

- `public/status.html`, `public/status.css`, `public/status.js` and `public/status-core.js`. A static page in the
  look of the privacy and terms pages, with the app's own colours, light and dark.
- It follows the theme picked in Settings (the same `birdie-bank-v1` check as index.html, before paint), and
  blends into Safari's bars: `viewport-fit=cover`, a theme-color per scheme (overwritten with the picked theme's
  colour when there is one), the two edge strips, and one `--canvas` token for all of it.
- From the phone it checks five things at once, each a small GET with a 5 second limit:

  | Row | What it asks | Cost |
  |---|---|---|
  | The app | `/version.json` (the service worker never answers it from the offline copy) | nothing, shows the live version |
  | Live scoring and accounts | Supabase REST: `live_rounds?select=code&code=eq.status-check&limit=1` with the public key | reads no rows |
  | Sign in | Supabase Auth `/auth/v1/health` | nothing |
  | Course search | `/api/courses?health=1` (new) | never calls GolfCourseAPI, so no quota |
  | Notifications | `/api/push?health=1` (new) | sends nothing |

- Each row: a green (working), amber (slower than 2 seconds, or the function is up but its key is missing) or
  grey (no answer in 5 seconds, or an error) dot, the time in ms, and "Checked just now" (then "3 min ago").
- The line at the top says "All systems normal", names what is down ("Course search is down"), or, when nothing
  answers, says the phone may be offline. It checks again with the button, on coming back after a minute away,
  and when the phone comes back online.
- No new table, no cron. The status files are left out of the offline copy (vite.config.js `SKIP`), so the page
  always asks the network.
- Linked from Settings, under Help ("Service status", opens in the browser), and the uptime workflow
  (`.github/workflows/uptime.yml`) now also checks `/status` answers 200 and mentions the page.

### 2. A full content security policy, report-only

- `vercel.json` has a new `Content-Security-Policy-Report-Only` header on every page except the old
  `prototype.html`. The enforced `Content-Security-Policy: frame-ancestors 'self'` is untouched.
- The policy, by directive:
  - `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`
  - `script-src`: our own files, plus two inline scripts by hash (below). No `unsafe-inline`, no `unsafe-eval`.
  - `style-src`: ours, Google Fonts, jsDelivr (Phosphor icons), and `'unsafe-inline'` (below).
  - `font-src`: ours, fonts.gstatic.com, jsDelivr.
  - `img-src`: ours, `data:` and `blob:` (share cards, canvas pictures, screenshots), and the Supabase project
    (avatar photos in storage).
  - `connect-src`: ours (which covers `/api/courses`, so GolfCourseAPI is never listed), Supabase over https and
    wss (REST, auth, storage, realtime), Sentry's ingest in the US, EU and old regions, PostHog US, the
    BigDataCloud geocoder (nearby towns), and the font hosts (the service worker saves them with fetch).
  - `worker-src 'self'` (the service worker), `manifest-src 'self'`.
  - Vercel's preview toolbar: `vercel.live` and its Pusher websocket, so preview deploys don't flood the reports
    (see question 1).
- Reports go to a new function, `api/csp-report.js` (logic in `src/lib/csp-report.js`), through both
  `report-uri` (Safari, Firefox) and `report-to` with a `Reporting-Endpoints` header (Chrome). It turns both
  report shapes into the classic one, drops reports caused by browser extensions, strips query strings and
  hashes from every address (so a join link's round code never leaves the phone) and drops code samples, then
  sends each to Sentry's security endpoint for the app's own DSN, tagged with the environment
  (production or preview) and release (`birdie-bank@<sha>`, the same as the app's crash reports).
- The DSN only lives in Vercel, so the function reads `SENTRY_DSN` or, failing that, the app's own
  `VITE_SENTRY_DSN` (Vercel hands every env var to functions too). With neither, each report is one line in the
  function log. Nothing new to set in Vercel.
- `index.html`: the three `onload="this.media='all'"` handlers on the late font and icon stylesheets are gone. The
  existing inline theme script now switches them on, so the page has no inline handlers at all. Checked in the
  browser: all three stylesheets switch to `all` and the fonts load.

## How to see it

- After deploy: open https://birdie-bank.vercel.app/status, or Settings, Service status.
- On a preview: `<preview url>/status`. Check the header is there with
  `curl -sI <preview url>/ | grep -i content-security`.
- Locally: `npm run build`, then serve `dist/` with any static server and open `/status.html`. Course search and
  Notifications show grey there, since a static server has no `/api`. `npm run dev` serves `/status.html` too, but
  the app row is grey in dev because `/version.json` is only made by a build.

## Reading the reports in Sentry

- Sentry, Issues, search `event.type:csp` (or look for issues titled "Blocked 'script' from ..."). Filter the
  environment to `production` to skip previews. Each issue groups one blocked thing on one directive, with the
  page path, the browser and the release.
- What is noise: anything from a browser extension is already dropped. Safari's reader mode, translation and
  password managers can still produce the odd `inline` style or script report; a handful from one browser is
  noise, the same report from many people is real.
- What to do with a real one: add the origin to the right directive in `vercel.json`, and to `LOADED` in
  `src/lib/csp.test.js` (the test fails on any origin in the code that isn't classified).

## Flipping it to enforced (after a week of clean reports)

1. Wait for 7 days with no real reports in production (a round played and a share card made in that week, so
   the common paths have run).
2. In `vercel.json`, rename the key `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Leave the
   old `frame-ancestors 'self'` header where it is: two enforced policies both apply, and that one still covers
   `prototype.html`.
3. In `src/lib/csp.test.js`, the first test expects the enforced policy to be only `frame-ancestors 'self'`:
   change it to expect both. `npm test`, deploy to a preview, open the app, a round, Settings, a share sheet, the
   rule pages and /status, and watch the console for "Refused to" lines before merging.
4. Keep `report-uri` and `report-to` in the enforced policy, so a blocked thing after launch still shows in Sentry.
   Rolling back is renaming the key back.

## What is still inline

- **Scripts**: two, both allowed by their sha256 hash: the theme and late stylesheet script in `index.html`, and
  the rule pages' `?ref=` carrier (`CARRY_REF_SCRIPT` in `src/lib/attribution.js`). Change either and
  `src/lib/csp.test.js` fails and prints the new hash to paste into `vercel.json`. The status page, terms and
  privacy pages have no inline script.
- **Styles**: `style-src` keeps `'unsafe-inline'`. The splash's `<style>` block in index.html, the `<style>` in
  the terms, privacy and rule pages, and one `style=""` attribute in privacy.html all rely on it. Style injection
  is a much smaller risk than script injection, and the React app's `style={}` props are set through the DOM, so
  they don't need it. Tightening it later means hashing each `<style>` block and removing the attribute.
- **prototype.html** is left out of the report-only policy: it is an old prototype full of inline code.

## Risks

- **The index.html change** is on the cold start path. If the inline script fails before the stylesheet loop,
  the app would fall back to system fonts and no icons. It's wrapped so storage errors can't stop it, and checked
  in a browser, but worth a look on a real iPhone after deploy (icons and fonts present on first open).
- **Sentry quota**: report-only on every page view can send many events if something common is blocked. Each POST
  carries at most 10 and extension reports are dropped. Sentry's spike protection applies. If a flood shows up,
  fix the policy rather than turning the reports off.
- **Reporting-Endpoints uses a relative URL** so it works on previews too. Chrome resolves it against the page,
  and Safari and Firefox use `report-uri` anyway.
- **PostHog's EU host**: if `VITE_POSTHOG_HOST` is ever changed, the policy needs that host too (the test only
  knows the US default).
- **Hard-coded values on the status page**: the Supabase URL and publishable key (the same public pair as
  `api/push.js`) and the name "Birdie Bank" in `status.html`. The rename needs to touch it, like privacy.html.
- **The health modes** say whether course search and push have their keys (`configured: true/false`). That is
  harmless, but it is public.
- **The vercel.json header pattern** `/((?!prototype\.html).*)` uses a negative lookahead, which Vercel supports
  but only a deploy proves. Check the header on the preview with the curl line above.

## Questions for Trevor

1. **Vercel's preview toolbar in the policy.** The production policy allows `vercel.live` (and Pusher's websocket)
   only so the toolbar on preview deploys doesn't file reports.
   - A. Keep them (suggested): a tiny widening, and previews stay quiet.
   - B. Drop them and filter previews out in Sentry by environment.
   - C. Drop them and switch the toolbar off for the project in Vercel.
2. **Where the status page link lives.**
   - A. Settings, under Help, as built (suggested).
   - B. Only in the Help email reply and the uptime notes, not in the app.
   - C. Also on the error screen the app shows when something breaks.
3. **When to enforce the policy.**
   - A. After 7 clean days that include a played round (suggested).
   - B. After 14 days.
   - C. Leave it report-only until launch, then enforce.
