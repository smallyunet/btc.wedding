# btc.wedding repositioning — source and method notes

As of: August 16, 2026 (Asia/Shanghai)

## Decision frame

The decision is whether to keep evolving the current wedding/household planner, or reposition the project into a Bitcoin product that can run for years with little manual work. The primary user is assumed to be a serious Bitcoin user who wants useful signal without maintaining another account, portfolio, or wallet integration.

## Repository and live-product evidence

- Local `main` is a static HTML/CSS/JavaScript household-plan builder with a Cloudflare Worker asset layer. It uses localStorage, no account, no database, and no wallet connection. Inspected: `README.md`, `index.html`, `js/app.js`, `worker/index.js`, `package.json`.
- The public `https://btc.wedding/` still presented the earlier Bitcoin Vow Certificate on August 16, 2026. This differs materially from local `main`, so deployment state must be reconciled before a rewrite.

## External evidence inventory

- mempool.space REST API documentation: current fees, mempool, blocks, difficulty, hashrate, mining pools, price, and historical price; public endpoints are rate-limited.
  - https://mempool.space/docs/api/rest
- Live mempool endpoint was reachable on August 16, 2026.
  - https://mempool.space/api/mempool
- Coin Metrics Community API provides no-key data but describes the community tier as non-commercial and rate-limited. It should not be a default commercial dependency without a license review.
  - https://docs.coinmetrics.io/api
- Bitcoin Optech publishes a weekly newsletter and offers RSS, creating a reputable, machine-readable protocol/update input.
  - https://bitcoinops.org/
- Bitcoin Core releases are available through the project's GitHub release surface.
  - https://github.com/bitcoin/bitcoin/releases
- Generic Bitcoin dashboards are crowded. Clark Moody exposes extensive market, network, mining, fee, Lightning, and supply metrics; Bitbo maintains a dashboard directory and its own chart suite.
  - https://dashboard.clarkmoody.com/
  - https://bitbo.io/tools/dashboards/
- Direct competition also exists for recurring network reports and automated data commentary.
  - https://btc.network/blog
- A date-to-block lookup already exists, which reduces the novelty of a simple time-machine tool but not of a richer historical context product.
  - https://www.spark.money/tools/block-by-date
- Cloudflare Cron Triggers support scheduled Worker jobs. Workers KV's current free limits include 100,000 reads and 1,000 writes per day, enough for a small cached snapshot product when writes are centralized.
  - https://developers.cloudflare.com/workers/configuration/cron-triggers/
  - https://developers.cloudflare.com/kv/platform/limits/
- Cloudflare Web Analytics is described as free and privacy-first and can provide basic validation without introducing a user account.
  - https://developers.cloudflare.com/web-analytics/about/

## Scoring method

Each direction receives an ordinal score from 1 (weak) to 5 (strong) on five criteria. The weighted score is a prioritization aid, not measured market demand.

- Recurring utility: 25%
- Low ongoing operations: 25%
- Differentiation: 20%
- Data and legal resilience: 15%
- Fit with the current static/Worker stack: 15%

Weighted score = recurring utility × 0.25 + low operations × 0.25 + differentiation × 0.20 + resilience × 0.15 + stack fit × 0.15.

## Validation and uncertainty

- Verified: current local architecture, live-site/local mismatch, competitor feature breadth, existence and current documentation of candidate APIs and Cloudflare primitives.
- Inferred: repeat-use potential, willingness to bookmark/share, and relative differentiation of a delta-first changefeed.
- Unknown: actual target audience size, acquisition channel, preferred language, and monetization. These require a shipped prototype and user behavior, not more desk research.
- The report uses one ranked bar chart to make the six-direction comparison scannable, plus the exact score table for audit. The chart is explicitly labeled as ordinal strategy judgment rather than measured market demand.

## QA notes

- Weighted scores were recomputed independently from the stated weights.
- Higher operations score always means lower expected maintenance.
- The recommendation is `share with caveats`: it is decision-useful for an MVP choice, not proof of product-market fit.
