# btc.wedding | Bitcoin Vow Certificate Generator

`btc.wedding` is a static Bitcoin vow certificate generator. It helps people create a symbolic wedding-style Bitcoin certificate with names, ceremony details, vows, signatures, and a print-ready keepsake.

The site does not require a backend, account, wallet connection, seed phrase, private key, or signature. Inputs are saved only in the browser through `localStorage`.

## Concept

The domain is treated as a ceremonial Bitcoin commitment. The product is intentionally small:

- Add one or two names for a solo keepsake or couple vow certificate.
- Set the ceremony date and place.
- Choose Bitcoin vows such as steady stacking, no panic selling, no leverage, and offline keys.
- Sign, seal, copy, or print the generated certificate.

## Features

- Pure HTML, CSS, and JavaScript.
- No build step.
- Optional public Bitcoin block-height fetch when sealing the certificate.
- Local-only state persistence.
- Copy, print, and reset actions.
- Print stylesheet for a clean certificate output.

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

Everything is generated in the browser. The page never asks for seed phrases, private keys, wallet signatures, or wallet connections.
