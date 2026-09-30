# Bus rides

A one-page counter for how many times you’ve taken the bus.

**Pages site:** https://bmwcooks.github.io/bus-rides/

**Worker:** not deployed from this environment. After the steps below, the URL is `https://bus-rides.<your-subdomain>.workers.dev`.

Tap **Took the bus** to add one. **Undo** takes one back if you tapped by mistake. The count stays at zero or above.

The number lives in a Cloudflare Durable Object, so it is the same on every browser and device. Clearing site data does not reset it. This browser may remember the last number it saw (`localStorage` key `bus-rides-last`) only to show something if the server can’t be reached. That cache is not the source of truth.

## Why a Durable Object

The count has to move by exactly one even if two devices tap at the same time. Workers KV cannot do that atomically. One SQLite Durable Object (`BusCounter`) stores a single row and updates it inside `transactionSync`.

## API

| Request | Result |
| --- | --- |
| `GET /count` | `{ "count": number }` |
| `POST /increment` | atomic +1, `{ "count": number }` |
| `POST /decrement` | atomic −1, floored at 0, `{ "count": number }` |

## Who can call it

The Worker only answers requests whose `Origin` is `https://bmwcooks.github.io`. `http://127.0.0.1` and `http://localhost` are also allowed so the page can be tried on your machine. Other websites’ browsers get `403`.

This is not a password. A program that forges the `Origin` header can still change the count. That is enough for a personal counter, and the secret is not hidden in the page (anything in the page can be read).

## Deploy the Worker

There is no Cloudflare login in this repo yet. From a checkout:

1. `npx wrangler login` (or create an API token with Workers Scripts and Durable Objects edit, plus Account Settings read).
2. `npm install`
3. `npx wrangler deploy`
4. Copy the printed `workers.dev` URL into the `bus-rides-api` meta tag in `index.html`, then commit that and push to `main`.

To deploy from GitHub Actions after that, add repository secrets and re-run **Deploy counter Worker**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` (Workers overview, or `npx wrangler whoami`)

Until those secrets exist, the workflow skips the deploy instead of failing.

## GitHub Pages

Pushes to `main` publish the page. The first time, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**, then re-run **Deploy static content to Pages**.

Local check: `npm run dev` for the Worker on port 8787, and open `index.html` from any local server. The page talks to `http://127.0.0.1:8787` when it is opened on localhost.
