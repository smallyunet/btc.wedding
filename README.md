# Bitcoin Changefeed

Bitcoin Changefeed answers one question: **what changed in Bitcoin since you last checked?**

It combines public network conditions with trusted protocol and software updates, while keeping the product account-free and low-maintenance.

## Product principles

- Delta-first: explain material movement instead of stacking static dashboard cards.
- Source-linked: every change links back to mempool.space, Bitcoin Optech, or Bitcoin Core.
- No wallet connection, account, portfolio, recommendation, or copied article feed.
- The previous visit is stored only in the current browser.
- Static HTML, CSS, and JavaScript; scheduled snapshots are generated during GitHub Pages builds.

## Data flow

1. `scripts/generate-data.mjs` fetches mempool.space, Bitcoin Optech Atom, and Bitcoin Core release data.
2. It writes a bounded fallback snapshot to `data/snapshot.json`.
3. The browser renders that snapshot immediately, then attempts a fresh mempool.space refresh.
4. GitHub Actions rebuilds and publishes the site hourly and after every push to `main`.

If an upstream source fails, the generator preserves the last known values and marks the snapshot as partial or fallback instead of inventing data.

## Run locally

```bash
npm run build
python3 -m http.server 8000 -d dist/client
```

Then open `http://localhost:8000`.

## Build

```bash
npm run build
```

The build refreshes `data/snapshot.json`, then packages the static client in `dist/client`.
