import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUTPUT_PATH = new URL("../data/snapshot.json", import.meta.url);
const SATOSHI_SUPPLEMENTAL_PATH = new URL("../data/satoshi-supplemental.json", import.meta.url);
const TIMEOUT_MS = 12_000;

async function readPreviousSnapshot() {
    try {
        return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    } catch {
        return null;
    }
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                "user-agent": "btc.wedding-changefeed/1.0",
                accept: "application/json, application/atom+xml, text/xml;q=0.9, */*;q=0.8",
                ...options.headers
            },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        return response;
    } finally {
        clearTimeout(timer);
    }
}

async function getJson(url, options) {
    return (await fetchWithTimeout(url, options)).json();
}

async function getText(url, options) {
    return (await fetchWithTimeout(url, options)).text();
}

function settledValue(result, fallback = null) {
    return result.status === "fulfilled" ? result.value : fallback;
}

function numberOr(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function decodeXml(value = "") {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

function stripHtml(value = "") {
    return decodeXml(value)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function truncate(value, length = 220) {
    if (value.length <= length) return value;
    return `${value.slice(0, length - 1).trim()}…`;
}

function parseOptechFeed(xml) {
    if (!xml) return [];

    return Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/g))
        .slice(0, 3)
        .map(([entry], index) => {
            const title = stripHtml(entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || "Bitcoin Optech update");
            const url = entry.match(/<link[^>]+href="([^"]+)"[^>]*rel="alternate"/)?.[1]
                || entry.match(/<link[^>]+href="([^"]+)"/)?.[1]
                || "https://bitcoinops.org/";
            const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1]
                || entry.match(/<updated>([^<]+)<\/updated>/)?.[1]
                || null;
            const content = stripHtml(entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || "");

            return {
                id: `optech-${publishedAt || index}`,
                category: "Protocol",
                level: "routine",
                title,
                summary: truncate(content || "A new source-linked Bitcoin Optech update is available."),
                publishedAt,
                source: "Bitcoin Optech",
                sourceUrl: url
            };
        });
}

function parseCoreReleases(releases) {
    if (!Array.isArray(releases)) return [];

    return releases
        .filter((release) => !release.draft)
        .slice(0, 2)
        .map((release) => ({
            id: `core-${release.id}`,
            category: "Software",
            level: release.prerelease ? "notable" : "routine",
            title: release.name || release.tag_name || "Bitcoin Core release",
            summary: release.prerelease
                ? "A Bitcoin Core pre-release is available for testing. Review the source release notes before installing."
                : "A Bitcoin Core release is available. Review the signed release notes and upgrade guidance at the source.",
            publishedAt: release.published_at,
            source: "Bitcoin Core",
            sourceUrl: release.html_url
        }));
}

function normalizeQuoteText(value = "") {
    const normalized = stripHtml(String(value))
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (normalized.length <= 560) return normalized;
    const shortened = normalized.slice(0, 560);
    const sentenceEnd = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("? "), shortened.lastIndexOf("! "));
    return `${shortened.slice(0, sentenceEnd >= 180 ? sentenceEnd + 1 : 557).trim()}…`;
}

function normalizeMessageText(value = "") {
    const withoutQuotedContext = String(value)
        .replace(/<div class="quoteheader"[^>]*>[\s\S]*?<\/div>/gi, " ")
        .replace(/<div class="quote"[^>]*>[\s\S]*?<\/div>/gi, " ")
        .replace(/(?:^|\n)\s*(?:&gt;|>)[^\n]*/g, " ");
    return normalizeQuoteText(withoutQuotedContext);
}

function sourceLabel(source, kind) {
    const labels = {
        bitcointalk: "BitcoinTalk",
        p2pfoundation: "P2P Foundation",
        cryptography: "Cryptography mailing list",
        "bitcoin-list": "Bitcoin mailing list",
        "p2p-research": "P2P Research mailing list"
    };
    return labels[source] || (kind === "email" ? "Archived email" : "Archived forum post");
}

function makeSatoshiHistory({ quotes, posts, postThreads, emails, emailThreads, supplemental }, fallback) {
    const hasOfficialArchive = Array.isArray(posts) && Array.isArray(postThreads)
        && Array.isArray(emails) && Array.isArray(emailThreads);
    if (!hasOfficialArchive) return fallback || { entries: [], quotes: [] };

    const postSources = new Map(postThreads.map((thread) => [thread.id, thread.source]));
    const emailSources = new Map(emailThreads.map((thread) => [thread.id, thread.source]));
    const featuredPosts = new Map();
    const featuredEmails = new Map();

    (Array.isArray(quotes) ? quotes : []).forEach((quote) => {
        const target = quote.post_id ? featuredPosts : quote.email_id ? featuredEmails : null;
        const id = Number(quote.post_id || quote.email_id);
        if (!target || !id || target.has(id)) return;
        target.set(id, normalizeQuoteText(quote.text));
    });

    const records = [];
    posts.filter((post) => post?.satoshi_id).forEach((post) => {
        const source = postSources.get(post.thread_id);
        records.push({
            id: `sni-post-${post.satoshi_id}`,
            date: post.date,
            subject: post.subject,
            text: featuredPosts.get(post.satoshi_id) || normalizeMessageText(post.text),
            sourceType: "forum-post",
            source: sourceLabel(source, "post"),
            archiveUrl: `https://satoshi.nakamotoinstitute.org/posts/${source}/${post.satoshi_id}/`,
            originalUrl: post.url,
            provenance: "Satoshi Nakamoto Institute archive",
            featured: featuredPosts.has(post.satoshi_id),
            disputed: Boolean(post.disclaimer),
            disclaimer: post.disclaimer ? normalizeQuoteText(post.disclaimer) : null
        });
    });

    emails.filter((email) => email?.satoshi_id).forEach((email) => {
        const source = emailSources.get(email.thread_id);
        records.push({
            id: `sni-email-${email.satoshi_id}`,
            date: email.date,
            subject: email.subject,
            text: featuredEmails.get(email.satoshi_id) || normalizeMessageText(email.text),
            sourceType: "email",
            source: sourceLabel(source, "email"),
            archiveUrl: `https://satoshi.nakamotoinstitute.org/emails/${source}/${email.satoshi_id}/`,
            originalUrl: email.url,
            provenance: "Satoshi Nakamoto Institute archive",
            featured: featuredEmails.has(email.satoshi_id),
            disputed: Boolean(email.disclaimer),
            disclaimer: email.disclaimer ? normalizeQuoteText(email.disclaimer) : null
        });
    });

    (Array.isArray(supplemental) ? supplemental : []).forEach((entry) => {
        if (!entry?.date || !entry?.text || !entry?.archiveUrl) return;
        records.push({ ...entry, text: normalizeQuoteText(entry.text), featured: true, disputed: Boolean(entry.disputed) });
    });

    const grouped = new Map();
    records.forEach((entry) => {
        const monthDay = String(entry.date).slice(5, 10);
        const current = grouped.get(monthDay) || [];
        current.push(entry);
        grouped.set(monthDay, current);
    });

    return {
        source: "Satoshi Nakamoto Institute + verified supplements",
        sourceUrl: "https://satoshi.nakamotoinstitute.org/",
        coverage: {
            records: records.length,
            calendarDays: grouped.size,
            officialPosts: posts.filter((post) => post?.satoshi_id).length,
            officialEmails: emails.filter((email) => email?.satoshi_id).length,
            supplements: Array.isArray(supplemental) ? supplemental.length : 0
        },
        entries: [...grouped.values()].flatMap((entries) => entries
            .sort((left, right) => {
                const leftRank = left.featured ? 0 : left.text.length >= 70 && left.text.length <= 420 ? 1 : 2;
                const rightRank = right.featured ? 0 : right.text.length >= 70 && right.text.length <= 420 ? 1 : 2;
                return leftRank - rightRank || left.text.length - right.text.length;
            })
            .slice(0, 3))
    };
}

function calculateAverageBlockMinutes(blocks) {
    if (!Array.isArray(blocks) || blocks.length < 2) return null;
    const intervals = [];

    for (let index = 1; index < Math.min(blocks.length, 7); index += 1) {
        const newer = numberOr(blocks[index - 1]?.timestamp);
        const older = numberOr(blocks[index]?.timestamp);
        if (newer && older && newer > older) intervals.push((newer - older) / 60);
    }

    if (!intervals.length) return null;
    return intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
}

function latestCoinMetricsSupply(response) {
    if (!Array.isArray(response?.data) || !response.data.length) return null;
    const latest = response.data
        .filter((entry) => numberOr(entry?.SplyCur) !== null && entry?.time)
        .sort((left, right) => new Date(right.time) - new Date(left.time))[0];
    if (!latest) return null;
    return { value: numberOr(latest.SplyCur), asOf: latest.time };
}

function makeNetworkEvents(metrics, generatedAt) {
    const events = [];
    const fee = metrics.feeFast;

    if (fee !== null) {
        const level = fee >= 25 ? "action" : fee >= 10 ? "notable" : "routine";
        events.push({
            id: `fees-${generatedAt}`,
            category: "Fees",
            level,
            title: level === "action" ? "Blockspace is expensive" : level === "notable" ? "Fee pressure is elevated" : "Fees remain calm",
            summary: level === "action"
                ? `High-priority estimates are ${fee} sat/vB. Check your wallet estimate before broadcasting a non-urgent transaction.`
                : level === "notable"
                    ? `High-priority estimates are ${fee} sat/vB, above the quiet-network range.`
                    : `High-priority estimates are ${fee} sat/vB and economy estimates are ${metrics.feeEconomy ?? "—"} sat/vB.`,
            value: `${fee} sat/vB`,
            publishedAt: generatedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    if (metrics.mempoolVsizeMB !== null) {
        const level = metrics.mempoolVsizeMB >= 100 ? "action" : metrics.mempoolVsizeMB >= 20 ? "notable" : "routine";
        events.push({
            id: `mempool-${generatedAt}`,
            category: "Mempool",
            level,
            title: level === "action" ? "The mempool is heavily backed up" : level === "notable" ? "The queue is building" : "The transaction queue is light",
            summary: `${Math.round(metrics.mempoolCount ?? 0).toLocaleString("en-US")} transactions occupy ${metrics.mempoolVsizeMB.toFixed(1)} virtual MB, roughly ${Math.ceil(metrics.mempoolVsizeMB)} blocks of space.`,
            value: `${metrics.mempoolVsizeMB.toFixed(1)} MvB`,
            publishedAt: generatedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    if (metrics.avgBlockTimeMinutes !== null) {
        const deviation = metrics.avgBlockTimeMinutes - 10;
        const level = Math.abs(deviation) >= 5 ? "notable" : "routine";
        events.push({
            id: `pace-${generatedAt}`,
            category: "Blocks",
            level,
            title: deviation >= 5 ? "Recent blocks are arriving slowly" : deviation <= -4 ? "Recent blocks are arriving quickly" : "Block production is near target",
            summary: `The latest observed block intervals average ${metrics.avgBlockTimeMinutes.toFixed(1)} minutes. Short windows are noisy; Bitcoin targets about 10 minutes over time.`,
            value: `${metrics.avgBlockTimeMinutes.toFixed(1)} min`,
            publishedAt: generatedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/blocks"
        });
    }

    return events;
}

const previous = await readPreviousSnapshot();
const satoshiSupplemental = JSON.parse(await readFile(SATOSHI_SUPPLEMENTAL_PATH, "utf8"));
const githubHeaders = process.env.GITHUB_TOKEN
    ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "x-github-api-version": "2022-11-28" }
    : {};

const requests = await Promise.allSettled([
    getJson("https://mempool.space/api/v1/fees/recommended"),
    getJson("https://mempool.space/api/mempool"),
    getJson("https://mempool.space/api/blocks/tip/height"),
    getJson("https://mempool.space/api/v1/difficulty-adjustment"),
    getJson("https://mempool.space/api/v1/prices"),
    getJson("https://mempool.space/api/v1/blocks"),
    getText("https://bitcoinops.org/feed.xml"),
    getJson("https://api.github.com/repos/bitcoin/bitcoin/releases?per_page=3", { headers: githubHeaders }),
    getJson("https://raw.githubusercontent.com/NakamotoInstitute/nakamotoinstitute.org/master/server/data/quotes.json"),
    getJson("https://raw.githubusercontent.com/NakamotoInstitute/nakamotoinstitute.org/master/server/data/forum_posts.json"),
    getJson("https://raw.githubusercontent.com/NakamotoInstitute/nakamotoinstitute.org/master/server/data/forum_threads.json"),
    getJson("https://raw.githubusercontent.com/NakamotoInstitute/nakamotoinstitute.org/master/server/data/emails.json"),
    getJson("https://raw.githubusercontent.com/NakamotoInstitute/nakamotoinstitute.org/master/server/data/email_threads.json"),
    getJson("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=SplyCur&frequency=1d&limit_per_asset=1&page_size=1&paging_from=end")
]);

const [feesResult, mempoolResult, heightResult, difficultyResult, pricesResult, blocksResult, optechResult, releasesResult, satoshiQuotesResult, satoshiPostsResult, satoshiPostThreadsResult, satoshiEmailsResult, satoshiEmailThreadsResult, coinMetricsResult] = requests;
const fees = settledValue(feesResult);
const mempool = settledValue(mempoolResult);
const height = settledValue(heightResult);
const difficulty = settledValue(difficultyResult);
const prices = settledValue(pricesResult);
const blocks = settledValue(blocksResult);
const optechXml = settledValue(optechResult);
const releases = settledValue(releasesResult);
const satoshiQuotes = settledValue(satoshiQuotesResult);
const satoshiPosts = settledValue(satoshiPostsResult);
const satoshiPostThreads = settledValue(satoshiPostThreadsResult);
const satoshiEmails = settledValue(satoshiEmailsResult);
const satoshiEmailThreads = settledValue(satoshiEmailThreadsResult);
const coinMetricsSupply = latestCoinMetricsSupply(settledValue(coinMetricsResult));
const generatedAt = new Date().toISOString();
const successfulRequests = requests.filter((request) => request.status === "fulfilled").length;

const fallbackMetrics = previous?.metrics || {};
const metrics = {
    priceUsd: numberOr(prices?.USD, fallbackMetrics.priceUsd ?? null),
    feeFast: numberOr(fees?.fastestFee, fallbackMetrics.feeFast ?? null),
    feeHalfHour: numberOr(fees?.halfHourFee, fallbackMetrics.feeHalfHour ?? null),
    feeHour: numberOr(fees?.hourFee, fallbackMetrics.feeHour ?? null),
    feeEconomy: numberOr(fees?.economyFee, fallbackMetrics.feeEconomy ?? null),
    mempoolVsizeMB: numberOr(mempool?.vsize, null) !== null
        ? numberOr(mempool.vsize) / 1_000_000
        : fallbackMetrics.mempoolVsizeMB ?? null,
    mempoolCount: numberOr(mempool?.count, fallbackMetrics.mempoolCount ?? null),
    blockHeight: numberOr(height, fallbackMetrics.blockHeight ?? null),
    avgBlockTimeMinutes: calculateAverageBlockMinutes(blocks) ?? fallbackMetrics.avgBlockTimeMinutes ?? null,
    difficultyChange: numberOr(difficulty?.difficultyChange, fallbackMetrics.difficultyChange ?? null),
    difficultyProgress: clamp(numberOr(difficulty?.progressPercent, fallbackMetrics.difficultyProgress ?? 0), 0, 100),
    remainingBlocks: numberOr(difficulty?.remainingBlocks, fallbackMetrics.remainingBlocks ?? null),
    estimatedRetargetDate: difficulty?.estimatedRetargetDate
        ? new Date(Number(difficulty.estimatedRetargetDate)).toISOString()
        : fallbackMetrics.estimatedRetargetDate ?? null,
    ledgerVisibleSupply: coinMetricsSupply?.value ?? fallbackMetrics.ledgerVisibleSupply ?? null,
    ledgerVisibleSupplyAsOf: coinMetricsSupply?.asOf ?? fallbackMetrics.ledgerVisibleSupplyAsOf ?? null
};

const optechUpdates = parseOptechFeed(optechXml);
const coreUpdates = parseCoreReleases(releases);
const priorUpdates = Array.isArray(previous?.updates) ? previous.updates : [];
const updates = [...optechUpdates, ...coreUpdates, ...priorUpdates]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))
    .slice(0, 6);

const snapshot = {
    version: 1,
    generatedAt,
    status: successfulRequests === requests.length ? "live" : successfulRequests >= 4 ? "partial" : previous ? "fallback" : "degraded",
    successfulSources: successfulRequests,
    totalSources: requests.length,
    metrics,
    events: makeNetworkEvents(metrics, generatedAt),
    updates,
    satoshiHistory: makeSatoshiHistory({
        quotes: satoshiQuotes,
        posts: satoshiPosts,
        postThreads: satoshiPostThreads,
        emails: satoshiEmails,
        emailThreads: satoshiEmailThreads,
        supplemental: satoshiSupplemental
    }, previous?.satoshiHistory),
    sourceHealth: {
        mempool: [feesResult, mempoolResult, heightResult, difficultyResult, pricesResult, blocksResult].some((result) => result.status === "fulfilled"),
        optech: optechResult.status === "fulfilled",
        bitcoinCore: releasesResult.status === "fulfilled",
        satoshiArchive: [satoshiPostsResult, satoshiPostThreadsResult, satoshiEmailsResult, satoshiEmailThreadsResult]
            .every((result) => result.status === "fulfilled"),
        coinMetrics: coinMetricsResult.status === "fulfilled" && coinMetricsSupply !== null
    }
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
    generatedAt,
    status: snapshot.status,
    successfulSources: snapshot.successfulSources,
    totalSources: snapshot.totalSources,
    output: OUTPUT_PATH.pathname
}));
