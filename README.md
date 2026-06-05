# btc.wedding | BTC DCA Planner & Cold Storage Checklist

`btc.wedding` is a static Bitcoin planning tool for long-term holders. It helps users turn a vague accumulation goal into a concrete DCA plan and audit the cold storage habits that matter before their stack gets larger.

The site does not require login, wallet connection, seed phrases, private keys, or a backend.

## Features

- **BTC DCA Planner**: Calculate projected BTC accumulation from recurring buys, frequency, time horizon, average buy price, existing BTC, and target BTC.
- **Future Price Scenarios**: Compare projected stack value at $50k, $100k, $250k, and $1M BTC.
- **Live BTC Snapshot**: Fetches public BTC price, block height, and latest block hash from browser-reachable APIs.
- **Cold Storage Checklist**: Scores offline seed handling, recovery testing, backup separation, passphrase clarity, exchange exposure, and emergency instructions.
- **Plan Summary**: Generates a compact plan snapshot that can be copied or printed.
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
