# Codex Nginx Review

## 1. Summary

The uncommitted Docker Compose and Nginx configuration mostly matches the single-port deployment goal at the static configuration level: only Nginx publishes host port `80`, the app service is reachable only on Docker's internal network through `expose: 3000`, and Nginx proxies to the Compose service name `app:3000`.

However, live verification against `http://localhost/` did not meet the expected behavior: `/`, `/admin/login`, and `/admin/dashboard` returned JSON `404` through Nginx. Because `docker compose ps` could not access the Docker daemon, I could not prove whether the running containers exactly match this working tree. Static app tests show the Express SPA fallback works when `dist/index.html` is present, so the live failure is most likely a running-image/runtime `dist` or `DIST_PATH` mismatch rather than an obvious Nginx location conflict.

## 2. Review Scope

- docker-compose files:
  - Reviewed unstaged `docker-compose.yml`.
  - Ran `docker compose config`.
- nginx config files:
  - Reviewed untracked `nginx/default.conf`.
- frontend route assumptions:
  - Reviewed React routes in `src/App.jsx`.
  - Confirmed `/` redirects to `/menu`.
  - Confirmed admin SPA routes include `/admin/login`, `/admin/dashboard`, `/admin/orders/:id`, `/admin/transfers`, `/admin/menus`, and `/admin/settlement`.
- backend API/health route assumptions:
  - Reviewed Express fallback/API exclusion in `server/app.js`.
  - Reviewed customer/admin API paths in `server/routes/customer.js`, `server/routes/admin.js`, and `src/api/routes.js`.
  - Confirmed the actual health endpoint is `/healthz`, not `/api/health`.
- current uncommitted staged changes:
  - None found.
- current unstaged changes:
  - `docker-compose.yml`.
- current untracked files:
  - `nginx/default.conf`.
- commands run:
  - Git status/diff/listing commands with per-command `safe.directory` override.
  - `docker compose config`.
  - `docker compose ps`.
  - `curl.exe` checks against `http://localhost`.
  - Focused Vitest tests for SPA fallback and health behavior.

## 3. Final Verdict

NEEDS FIXES: Static Compose/Nginx configuration is close to the goal, but live verification failed for the user-facing SPA routes. The deployment cannot be considered passing until `http://server-address/`, `/admin/login`, and refreshed admin SPA routes return the built frontend HTML through Nginx.

## 4. Severity-Based Findings

### P0

No P0 findings.

### P1

#### Finding 1

- Severity: P1
- File path: `Dockerfile`, `server/app.js`, `docker-compose.yml`
- Problem: The live Nginx endpoint did not serve the SPA for `/`, `/admin/login`, or `/admin/dashboard`.
- Why it matters: The expected behavior requires `http://server-address/` to serve the user page and `/admin` or `/admin/*` to reach the admin PIN/admin SPA without refresh 404s. Live `404` JSON means the user/admin web UI is not available through the single-port deployment.
- Evidence:
  - `curl.exe -I --max-time 5 http://localhost/` returned `HTTP/1.1 404 Not Found` with JSON content type.
  - `curl.exe -I --max-time 5 http://localhost/admin/login` returned `HTTP/1.1 404 Not Found`.
  - `curl.exe -I --max-time 5 http://localhost/admin/dashboard` returned `HTTP/1.1 404 Not Found`.
  - `server/app.js:77-83` only serves SPA fallback when `distPath` exists and contains `index.html`; otherwise non-API routes fall through to JSON `404`.
  - `Dockerfile:44` sets `DIST_PATH=/app/dist`, and `Dockerfile:50` copies built frontend output into `/app/dist`, so a freshly built runtime image should satisfy this if the container is actually running that image.
  - `docker compose ps` could not verify the live container state because Docker daemon access was denied.
- Suggested fix: Rebuild and redeploy the app image used by Compose, then verify the running app container has `/app/dist/index.html` and `DIST_PATH=/app/dist`. After redeploy, rerun `curl http://localhost/`, `curl http://localhost/admin/login`, and `curl http://localhost/admin/dashboard`.

### P2

#### Finding 2

- Severity: P2
- File path: `nginx/default.conf`
- Problem: `/assets/*` responses add one-year immutable cache headers even on error responses.
- Why it matters: If a Vite asset is missing or a stale `index.html` references an asset that no longer exists, Nginx can return `404` with `Cache-Control: public, max-age=31536000, immutable`. Browsers or intermediaries may cache a missing asset too aggressively, making frontend recovery harder after redeploy.
- Evidence:
  - `nginx/default.conf:59-68` defines `location ^~ /assets/` and uses `add_header Cache-Control "public, max-age=31536000, immutable" always`.
  - `curl.exe -I --max-time 5 http://localhost/assets/index.js` returned `HTTP/1.1 404 Not Found` with `Cache-Control: public, max-age=31536000, immutable`.
- Suggested fix: Only apply immutable cache headers to successful asset responses. Avoid `always` for `Cache-Control` on `/assets/*`, or use a dedicated error/no-cache behavior for asset misses.

#### Finding 3

- Severity: P2
- File path: `nginx/default.conf`, `src/hooks/useOrderStream.js`, `src/hooks/useOrderPolling.js`, `server/routes/customer.js`
- Problem: The active status page currently uses polling, but the codebase contains a dormant EventSource/SSE hook and route constant. Nginx does not include dedicated SSE settings if that path is enabled later.
- Why it matters: SSE connections generally need buffering disabled and longer read timeouts. The current Nginx catch-all uses `proxy_read_timeout 30s` and does not set `proxy_buffering off` for stream paths. If `/api/orders/:id/stream` is enabled, clients may disconnect or receive delayed events.
- Evidence:
  - `src/pages/customer/StatusPage.jsx:43` uses `useOrderPolling`.
  - `src/hooks/useOrderPolling.js:4-6` states polling is used until server SSE is implemented.
  - `src/hooks/useOrderStream.js:69-74` would connect to `/api/orders/:id/stream` using `EventSource`.
  - `src/api/routes.js:15` defines `ORDER_STREAM`.
  - `server/routes/customer.js` does not currently implement `GET /api/orders/:id/stream`.
  - `nginx/default.conf:74-85` sends all non-asset traffic through the generic `location /` with `proxy_read_timeout 30s`.
- Suggested fix: No immediate routing fix is needed while polling is active. If SSE is implemented, add a specific `/api/orders/*/stream` or broader API streaming location with `proxy_buffering off`, appropriate cache headers, and longer read timeout.

### P3

#### Finding 4

- Severity: P3
- File path: `nginx/default.conf`, `server/app.js`
- Problem: Some security headers are duplicated, and `Referrer-Policy` is conflicting between Express/Helmet and Nginx.
- Why it matters: This does not break routing, but duplicate/conflicting headers make production behavior less predictable and harder to audit.
- Evidence:
  - `nginx/default.conf` adds `X-Content-Type-Options` and `Referrer-Policy`.
  - Live responses included both `Referrer-Policy: no-referrer` from Helmet and `Referrer-Policy: strict-origin-when-cross-origin` from Nginx.
  - Live responses also included duplicate `X-Content-Type-Options: nosniff`.
- Suggested fix: Choose one layer as the source of truth for these headers, or align the values so duplicate headers are not contradictory.

## 5. Port Exposure Review

Static Compose configuration passes the single public port requirement.

- `docker-compose.yml:13-14` uses `expose: "3000"` for the app service, not `ports`.
- `docker-compose.yml:43-44` publishes only Nginx with `80:80`.
- `docker compose config` confirmed:
  - `app` has `expose: 3000`.
  - `nginx` has published host port `80` to container port `80`.
  - No frontend/backend/app service host port `3000` is published.

This repository appears to use a combined Express app that serves both backend APIs and the built Vite frontend. There are not separate `frontend` and `backend` Compose services in the current file; the relevant internal service is `app`.

## 6. Routing Review

- `/` user page:
  - Static intent is correct: Nginx proxies `/` to Express, and React defines `/` as a redirect to `/menu`.
  - Express SPA fallback should serve `index.html` for non-API GET routes when `dist/index.html` exists.
  - Live curl failed: `http://localhost/` returned JSON `404`.
- `/admin` admin PIN page:
  - `nginx/default.conf:50-54` redirects exact `/admin` and `/admin/` to `/admin/login`.
  - React defines `/admin/login` as the admin login route.
  - Live curl for `/admin` returned `302` to `/admin/login`, but live `/admin/login` returned JSON `404`.
- `/admin/*` SPA route support:
  - Static Express fallback supports `/admin/dashboard` and other admin SPA GET routes because `/admin/*` is not excluded from SPA fallback except `/admin/api/*`.
  - Focused Vitest coverage confirmed `GET /admin/dashboard` and `GET /admin/login` return HTML when `distPath` exists.
  - Live curl for `/admin/dashboard` returned JSON `404`.
- `/api/*` backend proxy:
  - Nginx catch-all proxies `/api/*` to the app.
  - Express excludes `/api/` from SPA fallback through `API_PREFIXES`, so API requests are not swallowed by the SPA.
  - Live curl for `/api/menus` returned `200 OK` JSON.
- SPA refresh behavior:
  - Static app tests confirm deep customer/admin routes return HTML when `distPath` is present.
  - Live refresh behavior is currently not passing for admin SPA routes because live `/admin/login` and `/admin/dashboard` returned `404`.

## 7. Docker Networking Review

Docker internal networking is configured correctly at the Compose level.

- `docker compose config` showed both `app` and `nginx` attached to the same default network, `09_order_default`.
- `nginx/default.conf:16-18` defines upstream `chickenedak_app` as `server app:3000`.
- `docker-compose.yml:49` waits for `app` to become healthy before starting Nginx.
- The app healthcheck uses `http://localhost:3000/healthz`; the Nginx healthcheck uses `http://localhost/healthz`, which exercises the proxy path.

## 8. Security and Deployment Risks

- Public port exposure:
  - Passes statically: only Nginx publishes `80:80`.
- Secret and `.env` changes:
  - Git status showed only `docker-compose.yml` and `nginx/default.conf` in scope.
  - No `.env` file was modified in Git status.
  - `git ls-files .env .env.*` showed only `.env.example` as tracked.
  - `docker compose config` materialized `.env` values in its output; secret values are intentionally not reproduced in this report.
- Proxy headers:
  - Present: `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`.
  - WebSocket `Upgrade` headers are not present. No active WebSocket route was found.
  - Active order status uses polling, not SSE. Dormant SSE code exists; see P2 Finding 3.
- Request body size/timeouts:
  - `client_max_body_size 1m` is above Express JSON's `64kb` limit and is reasonable for current order/admin JSON payloads.
  - `proxy_read_timeout 30s` is reasonable for normal API calls but would be too short/fragile for future long-lived SSE.
- Production risks:
  - The live stack did not serve the SPA, which is the main deployment risk.
  - Immutable cache headers on `/assets/*` are applied to 404 responses, which can make bad asset deploys sticky.

## 9. Functional Regression Risks

- Frontend routing:
  - Static tests show SPA fallback works when `distPath` exists.
  - Live runtime currently returns 404 for SPA routes, so deploy/runtime image freshness is the key regression risk.
- Admin routing:
  - `/admin` redirects to `/admin/login`; static route exists.
  - Live `/admin/login` returned 404, so the PIN screen was not verified live.
- API calls:
  - `/api/*` is proxied to the app and is excluded from SPA fallback.
  - Live `/api/menus` returned 200 JSON.
- WebSocket/SSE:
  - No active WebSocket route was found.
  - Polling is active; SSE hook is present but not wired to the status page or backend route.
- Static assets:
  - `/assets/*` is proxied and gets immutable cache headers.
  - Missing assets currently receive immutable cache headers too.
- Uploads/long requests:
  - No upload endpoint requiring larger body size was found in the reviewed routes.
  - Settlement ZIP is a GET download; the 30s read timeout could become tight if ZIP generation grows, but no failure was verified.
- Health checks:
  - `/healthz` is implemented and proxied successfully in live curl.

## 10. Recommended Fix Order

1. Fix the live SPA 404 first: confirm the running `app` container uses a freshly built image with `/app/dist/index.html` and `DIST_PATH=/app/dist`, then rerun `/`, `/admin/login`, and `/admin/dashboard` through Nginx.
2. Recheck live container mappings after Docker daemon access is available with `docker compose ps` or equivalent Docker inspection.
3. Adjust `/assets/*` cache behavior so immutable cache headers are not applied to 404/error responses.
4. If SSE is implemented later, add explicit Nginx handling for stream routes before switching the UI from polling to EventSource.
5. Align duplicate security headers between Express/Helmet and Nginx.

## 11. Commands Run

- `git status --short`
  - Initial run failed because Git reported dubious ownership for `C:/ACoding/09_order`.
- `git -c safe.directory=C:/ACoding/09_order status --short`
  - Result: `M docker-compose.yml`, `?? nginx/`.
  - Git also warned it could not access `C:\Users\user/.config/git/ignore`.
- `git -c safe.directory=C:/ACoding/09_order diff --stat`
  - Result: `docker-compose.yml` changed with 26 insertions and 5 deletions.
- `git -c safe.directory=C:/ACoding/09_order diff --staged --stat`
  - Result: no staged changes.
- `git -c safe.directory=C:/ACoding/09_order ls-files --others --exclude-standard`
  - Result: `nginx/default.conf`.
- `git -c safe.directory=C:/ACoding/09_order diff -- docker-compose.yml`
  - Reviewed the app port change from `ports: 3000:3000` to `expose: 3000` and the new Nginx service publishing `80:80`.
- `Get-Content -Path docker-compose.yml`
  - Reviewed current Compose file.
- `Get-Content -Path nginx/default.conf`
  - Reviewed current Nginx file.
- `rg --files -g "!node_modules" -g "!dist" -g "!build"`
  - Listed repository files for review targeting.
- `rg -n "healthz|/api|admin|EventSource|WebSocket|SSE|socket|createBrowserRouter|BrowserRouter|Route|Routes|Navigate" server src Dockerfile package.json vite.config.js`
  - Found relevant frontend/backend routing and SSE/polling references.
- `Get-Content -Path server\app.js`
  - Reviewed Express health route, API exclusions, static serving, and SPA fallback.
- `Get-Content -Path src\App.jsx`
  - Reviewed React routes.
- `Get-Content -Path src\api\routes.js`
  - Reviewed API path constants.
- `Get-Content -Path src\hooks\useOrderStream.js`
  - Reviewed dormant EventSource client.
- `Get-Content -Path src\hooks\useOrderPolling.js`
  - Confirmed active polling fallback behavior.
- `Get-Content -Path src\pages\customer\StatusPage.jsx`
  - Confirmed `StatusPage` currently uses `useOrderPolling`.
- `Get-Content -Path server\routes\customer.js`
  - Reviewed customer API routes; no active SSE route found.
- `Get-Content -Path server\routes\admin.js`
  - Reviewed admin API/login/logout routes.
- `Get-Content -Path server\server.js`
  - Reviewed `DIST_PATH` defaulting and server startup.
- `Get-Content -Path Dockerfile`
  - Reviewed production image build and `/app/dist` copy.
- `docker compose config`
  - Succeeded.
  - Confirmed only Nginx publishes host port `80`.
  - Warned that Docker config at `C:\Users\user\.docker\config.json` could not be read due access denied.
  - Printed `.env`-derived values; secrets are not reproduced here.
- `docker compose ps`
  - Failed because Docker daemon pipe access was denied on Windows.
- `curl.exe -I --max-time 5 http://localhost/`
  - Returned `HTTP/1.1 404 Not Found`.
- `curl.exe -I --max-time 5 http://localhost/admin`
  - Returned `HTTP/1.1 302 Moved Temporarily` to `/admin/login`.
- `curl.exe -I --max-time 5 http://localhost/admin/login`
  - Returned `HTTP/1.1 404 Not Found`.
- `curl.exe -I --max-time 5 http://localhost/admin/dashboard`
  - Returned `HTTP/1.1 404 Not Found`.
- `curl.exe -I --max-time 5 http://localhost/healthz`
  - Returned `HTTP/1.1 200 OK`.
- `curl.exe -I --max-time 5 http://localhost/api/menus`
  - Returned `HTTP/1.1 200 OK`.
- `curl.exe -I --max-time 5 http://localhost/assets/index.js`
  - Returned `HTTP/1.1 404 Not Found` with immutable cache header.
- `curl.exe -I --max-time 5 http://localhost/api/orders/1/stream`
  - Returned `HTTP/1.1 404 Not Found`.
- `npm test -- server/__tests__/static-spa.test.js server/__tests__/healthz.test.js`
  - Passed: 2 test files, 13 tests.
- `git -c safe.directory=C:/ACoding/09_order diff --check`
  - No whitespace errors reported; warned LF will be replaced by CRLF for `docker-compose.yml`.
- `git -c safe.directory=C:/ACoding/09_order diff --staged --check`
  - No staged whitespace issues; Git warned it could not access the user global ignore file.

## 12. Notes

- I did not modify implementation files and did not commit changes.
- I did not run `docker compose up`, `docker compose build`, or `npm run build` because those would create or overwrite runtime/build artifacts and the instruction limited writes to this report file.
- I could not verify live Compose container mappings because `docker compose ps` could not access the Docker daemon.
- The live `curl` checks did reach an Nginx server on localhost, but because Docker daemon inspection failed, I could not prove that server was created from this exact current working tree.
- Static route behavior is better than the live curl result: Vitest confirmed Express serves SPA fallback for `/`, `/menu`, `/admin/login`, and `/admin/dashboard` when `distPath` exists.
- No staged changes were present at review time.
- No `.env` or secret file changes were present in Git status at review time.
