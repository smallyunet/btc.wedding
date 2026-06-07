# btc.wedding | Bitcoin Commitment Planner

`btc.wedding` is a static Bitcoin commitment planner for long-term holders. The site treats Bitcoin ownership as a promise that needs a rhythm, a custody standard, and a record: how much you intend to stack, how carefully you intend to hold it, and what instructions should survive the moment.

The site does not require login, wallet connection, seed phrases, private keys, or a backend.

## Concept

The original tool was useful, but the domain name carried a stronger idea than the page expressed. The new positioning makes `btc.wedding` a private commitment ritual rather than a generic calculator:

- **Accumulation vow**: turn a long-term intention into a recurring contribution rhythm, target stack, and scenario record.
- **Custody vow**: review offline seed handling, backup durability, recovery rehearsal, and legacy instructions before the stack grows.
- **Commitment record**: copy or print a local snapshot that describes the plan without exposing wallet data.
- **Privacy boundary**: keep all calculations and checklist answers in the browser, with no seed phrases, signatures, accounts, or wallet links.

## Features

- **Stack Vow Planner**: Calculate projected BTC accumulation from recurring buys, frequency, time horizon, average buy price, existing BTC, and target BTC.
- **Sats Display & Target Presets**: See projected stack in both BTC and sats, with quick targets like 0.1 BTC, 0.21 BTC, 1 BTC, and 2.1 BTC.
- **Future Price Scenarios**: Compare projected stack value at $50k, $100k, $250k, and $1M BTC.
- **Live BTC Snapshot**: Fetches public BTC price and block height from browser-reachable APIs.
- **Cold Storage Commitment Check**: Scores seed handling, backup durability, recovery testing, exchange exposure, and emergency instructions.
- **Top 3 Improvements**: Shows the most important missing storage actions first.
- **Bitcoin Wedding Snapshot**: Generates a compact commitment record that can be copied or printed.
- **Static Deployment**: Runs on plain HTML, CSS, and JavaScript. No build step.

## Running Locally

Use any static file server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deployment

This project is suitable for GitHub Pages, Cloudflare Pages, Netlify, or any static host. The included `CNAME` points the site at `btc.wedding`.

## Privacy

All calculations and checklist answers stay in the browser. The page only calls public APIs for market and block reference data. It never asks for seed phrases, private keys, wallet signatures, or wallet connections.
