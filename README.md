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

1. `scripts/generate-data.mjs` fetches mempool.space, Coin Metrics daily ledger-visible supply, Bitcoin Optech Atom, Bitcoin Core release data, and the Satoshi Nakamoto Institute's full forum-post and public-email datasets. Its curated quote index is used only to select the strongest excerpt when available.
2. It writes a bounded fallback snapshot to `data/snapshot.json`.
3. The browser renders that snapshot immediately, then attempts a fresh mempool.space refresh.
4. GitHub Actions rebuilds and publishes the site hourly and after every push to `main`.

If an upstream source fails, the generator preserves the last known values and marks the snapshot as partial or fallback instead of inventing data.

The daily archive uses the visitor's local month and day. Each entry links to its exact Satoshi Nakamoto Institute record and, when available, the original forum or mailing-list URL. A small checked-in supplement covers verified correspondence absent from SNI, including the August 2008 Adam Back exchange, with both the preserved court exhibit and source document linked. Dates without an indexed message are labeled instead of being filled with inferred text.

The archive is broad, not claimed to be exhaustive: the current build covers SNI's public Satoshi-authored forum posts and emails plus explicitly reviewed supplements. UTC source timestamps determine the historical date. Records with an upstream authenticity disclaimer remain visible only with a prominent disputed-attribution label. All archive requests run in parallel, the browser receives only three selected entries per calendar day, and the previous generated snapshot is retained if the archive fetch fails; this keeps builds fast and prevents an upstream outage from breaking the page.

## Supply methodology

- Scheduled issuance, unissued supply, daily target issuance, block subsidy, and halving progress are calculated locally from the current block height and Bitcoin's 210,000-block subsidy eras.
- Ledger-visible supply is the latest daily `SplyCur` observation from the Coin Metrics Community API. For Bitcoin, it sums unspent transaction outputs visible on the ledger; its observation date is shown in the interface and a failed request preserves the last known value.
- The 21 million cap is shown as the familiar rounded protocol limit. Scheduled issuance can differ slightly from spendable supply because miners may claim less than the allowed subsidy and some outputs are provably unspendable.
- Ownership cohorts are a dated March 2023 Glassnode entity-adjusted research snapshot, not live wallet balances and not a complete partition of supply. Addresses do not map one-to-one to people.
- The 3.0–3.75 million BTC lost range combines historical 2020 Glassnode and Chainalysis estimates. It is explicitly presented as a historical range, because inactivity cannot prove loss of private keys and no API can report a definitive permanently lost total.

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
