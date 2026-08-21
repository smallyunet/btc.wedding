# Bitcoin Changefeed

Bitcoin Changefeed gives you a ten-second answer to one question: **does Bitcoin need my attention right now?**

It turns public network conditions and trusted protocol or software updates into a plain-language brief, while keeping the product account-free and low-maintenance. A daily archive also surfaces what Satoshi said on the visitor's calendar date, or transparently shows the nearest indexed entry when that date is quiet.

## Product principles

- Delta-first: explain material movement instead of stacking static dashboard cards.
- Source-linked: every change links back to mempool.space, Bitcoin Optech, or Bitcoin Core.
- No wallet connection, account, portfolio, recommendation, or copied article feed.
- The previous visit is stored only in the current browser.
- Static HTML, CSS, and JavaScript; scheduled snapshots are generated during GitHub Pages builds.

## Data flow

1. `scripts/generate-data.mjs` fetches mempool.space, Bitcoin Optech Atom, Bitcoin Core release data, and the Satoshi Nakamoto Institute's curated quote index.
2. It writes a bounded fallback snapshot to `data/snapshot.json`.
3. The browser renders that snapshot immediately, then attempts a fresh mempool.space refresh.
4. GitHub Actions rebuilds and publishes the site hourly and after every push to `main`.

If an upstream source fails, the generator preserves the last known values and marks the snapshot as partial or fallback instead of inventing data.

The daily archive uses the visitor's local month and day. Quote text remains attributed and links back to its category page in [The Quotable Satoshi](https://satoshi.nakamotoinstitute.org/quotes/); dates without an indexed quote are labeled instead of being filled with inferred text.

## Supply methodology

- Scheduled issuance, unissued supply, daily target issuance, block subsidy, and halving progress are calculated locally from the current block height and Bitcoin's 210,000-block subsidy eras.
- The 21 million cap is shown as the familiar rounded protocol limit. Scheduled issuance can differ slightly from spendable supply because miners may claim less than the allowed subsidy and some outputs are provably unspendable.
- Ownership cohorts are a dated March 2023 Glassnode entity-adjusted research snapshot, not live wallet balances and not a complete partition of supply. Addresses do not map one-to-one to people.
- The 3.0–3.75 million BTC lost range combines historical 2020 Glassnode and Chainalysis estimates. It is labeled as an estimate because inactivity cannot prove loss of private keys.

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
