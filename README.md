# btc.wedding | A Bitcoin Plan for Two

`btc.wedding` is a private, static Bitcoin household-plan builder. It helps one person or a couple agree on ownership, a buying rhythm, custody responsibilities, and emergency continuity without creating an account or connecting a wallet.

## Product principles

- Practical household decisions instead of symbolic on-chain claims.
- A short three-step flow with a live, printable document.
- No seed phrase, private key, wallet connection, analytics, or database.
- Drafts stay on the current device in `localStorage`.
- Pure HTML, CSS, and JavaScript.

## Run locally

Use any static file server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Build

```bash
npm run build
```

The build copies the static client and Cloudflare Worker into `dist/`.

## Privacy

The tool does not make network requests after its own static assets load. The generated plan intentionally contains no wallet credentials or recovery material.
