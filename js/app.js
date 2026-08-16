const STORAGE_KEY = "btc_changefeed_last_seen_v1";
const SNAPSHOT_URL = "data/snapshot.json";
const LIVE_ENDPOINTS = {
    fees: "https://mempool.space/api/v1/fees/recommended",
    mempool: "https://mempool.space/api/mempool",
    height: "https://mempool.space/api/blocks/tip/height",
    difficulty: "https://mempool.space/api/v1/difficulty-adjustment",
    prices: "https://mempool.space/api/v1/prices",
    blocks: "https://mempool.space/api/v1/blocks"
};

const state = {
    activeFilter: "all",
    current: null,
    feed: [],
    previous: readPreviousVisit(),
    saveTimer: 0
};

const elements = {
    changeCount: document.getElementById("change-count"),
    dataStatus: document.getElementById("data-status"),
    dataStatusLabel: document.getElementById("data-status-label"),
    difficultyChange: document.getElementById("difficulty-change"),
    difficultyCopy: document.getElementById("difficulty-copy"),
    difficultyProgress: document.getElementById("difficulty-progress"),
    difficultyProgressLabel: document.getElementById("difficulty-progress-label"),
    difficultyRemaining: document.getElementById("difficulty-remaining"),
    feeDetail: document.getElementById("fee-detail"),
    feeEconomy: document.getElementById("fee-economy"),
    feeFast: document.getElementById("fee-fast"),
    feeHour: document.getElementById("fee-hour"),
    feeStateCopy: document.getElementById("fee-state-copy"),
    feeStatePill: document.getElementById("fee-state-pill"),
    feeStateTitle: document.getElementById("fee-state-title"),
    feeValue: document.getElementById("fee-value"),
    feedEmpty: document.getElementById("feed-empty"),
    feedList: document.getElementById("feed-list"),
    lastVisit: document.getElementById("last-visit"),
    mempoolDetail: document.getElementById("mempool-detail"),
    mempoolValue: document.getElementById("mempool-value"),
    paceDetail: document.getElementById("pace-detail"),
    paceValue: document.getElementById("pace-value"),
    priceDetail: document.getElementById("price-detail"),
    priceValue: document.getElementById("price-value"),
    refreshButton: document.getElementById("refresh-data"),
    snapshotTime: document.getElementById("snapshot-time"),
    visitContext: document.getElementById("visit-context")
};

function readPreviousVisit() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return parsed && parsed.metrics ? parsed : null;
    } catch {
        return null;
    }
}

function saveCurrentVisit() {
    if (!state.current?.metrics) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        seenAt: new Date().toISOString(),
        metrics: state.current.metrics
    }));
}

function scheduleSave() {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveCurrentVisit, 5_000);
}

function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

function numberOrNull(value) {
    return isFiniteNumber(value) ? Number(value) : null;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function formatCurrency(value) {
    if (!isFiniteNumber(value)) return "—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(Number(value));
}

function formatNumber(value, options = {}) {
    if (!isFiniteNumber(value)) return "—";
    return new Intl.NumberFormat("en-US", options).format(Number(value));
}

function formatRelativeTime(value) {
    const date = new Date(value || 0);
    const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1_000);
    if (!Number.isFinite(deltaSeconds)) return "Time unavailable";

    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const ranges = [
        [31_536_000, "year"],
        [2_592_000, "month"],
        [604_800, "week"],
        [86_400, "day"],
        [3_600, "hour"],
        [60, "minute"]
    ];

    for (const [seconds, unit] of ranges) {
        if (Math.abs(deltaSeconds) >= seconds) {
            return formatter.format(Math.round(deltaSeconds / seconds), unit);
        }
    }

    return "just now";
}

function formatExactTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "Time unavailable";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

async function fetchJson(url, timeout = 9_000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            cache: "no-store",
            headers: { accept: "application/json" },
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
    } finally {
        window.clearTimeout(timer);
    }
}

function calculateAverageBlockMinutes(blocks) {
    if (!Array.isArray(blocks) || blocks.length < 2) return null;
    const intervals = [];

    for (let index = 1; index < Math.min(blocks.length, 7); index += 1) {
        const newer = numberOrNull(blocks[index - 1]?.timestamp);
        const older = numberOrNull(blocks[index]?.timestamp);
        if (newer && older && newer > older) intervals.push((newer - older) / 60);
    }

    return intervals.length
        ? intervals.reduce((total, value) => total + value, 0) / intervals.length
        : null;
}

async function loadSnapshot() {
    try {
        return await fetchJson(`${SNAPSHOT_URL}?v=${Date.now()}`);
    } catch {
        return {
            version: 1,
            generatedAt: null,
            status: "degraded",
            metrics: {},
            events: [],
            updates: []
        };
    }
}

async function loadLiveNetwork() {
    const entries = Object.entries(LIVE_ENDPOINTS);
    const results = await Promise.allSettled(entries.map(([, url]) => fetchJson(url)));
    const data = Object.fromEntries(entries.map(([key], index) => [
        key,
        results[index].status === "fulfilled" ? results[index].value : null
    ]));
    const successCount = results.filter((result) => result.status === "fulfilled").length;

    if (!successCount) throw new Error("Live network sources are unavailable");

    return {
        generatedAt: new Date().toISOString(),
        status: successCount === entries.length ? "live" : "partial",
        successfulSources: successCount,
        totalSources: entries.length,
        metrics: {
            priceUsd: numberOrNull(data.prices?.USD),
            feeFast: numberOrNull(data.fees?.fastestFee),
            feeHalfHour: numberOrNull(data.fees?.halfHourFee),
            feeHour: numberOrNull(data.fees?.hourFee),
            feeEconomy: numberOrNull(data.fees?.economyFee),
            mempoolVsizeMB: numberOrNull(data.mempool?.vsize) === null ? null : Number(data.mempool.vsize) / 1_000_000,
            mempoolCount: numberOrNull(data.mempool?.count),
            blockHeight: numberOrNull(data.height),
            avgBlockTimeMinutes: calculateAverageBlockMinutes(data.blocks),
            difficultyChange: numberOrNull(data.difficulty?.difficultyChange),
            difficultyProgress: numberOrNull(data.difficulty?.progressPercent),
            remainingBlocks: numberOrNull(data.difficulty?.remainingBlocks),
            estimatedRetargetDate: data.difficulty?.estimatedRetargetDate
                ? new Date(Number(data.difficulty.estimatedRetargetDate)).toISOString()
                : null
        }
    };
}

function mergeMetrics(snapshotMetrics = {}, liveMetrics = {}) {
    const merged = { ...snapshotMetrics };
    Object.entries(liveMetrics).forEach(([key, value]) => {
        if (value !== null && value !== undefined) merged[key] = value;
    });
    return merged;
}

function buildCurrentEvents(metrics, publishedAt) {
    const events = [];

    if (isFiniteNumber(metrics.feeFast)) {
        const fee = Number(metrics.feeFast);
        const level = fee >= 25 ? "action" : fee >= 10 ? "notable" : "routine";
        events.push({
            id: `fees-current-${fee}`,
            category: "Fees",
            level,
            title: level === "action" ? "Blockspace is expensive" : level === "notable" ? "Fee pressure is elevated" : "Fees remain calm",
            summary: level === "action"
                ? `High-priority estimates are ${fee} sat/vB. Check your wallet estimate before broadcasting a non-urgent transaction.`
                : `High-priority estimates are ${fee} sat/vB and economy estimates are ${metrics.feeEconomy ?? "—"} sat/vB.`,
            value: `${fee} sat/vB`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    if (isFiniteNumber(metrics.mempoolVsizeMB)) {
        const size = Number(metrics.mempoolVsizeMB);
        const level = size >= 100 ? "action" : size >= 20 ? "notable" : "routine";
        events.push({
            id: `mempool-current-${size.toFixed(1)}`,
            category: "Mempool",
            level,
            title: level === "action" ? "The mempool is heavily backed up" : level === "notable" ? "The queue is building" : "The transaction queue is light",
            summary: `${formatNumber(metrics.mempoolCount)} transactions occupy ${size.toFixed(1)} virtual MB, roughly ${Math.ceil(size)} blocks of space.`,
            value: `${size.toFixed(1)} MvB`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    if (isFiniteNumber(metrics.avgBlockTimeMinutes)) {
        const pace = Number(metrics.avgBlockTimeMinutes);
        const level = Math.abs(pace - 10) >= 5 ? "notable" : "routine";
        events.push({
            id: `pace-current-${pace.toFixed(1)}`,
            category: "Blocks",
            level,
            title: pace >= 15 ? "Recent blocks are arriving slowly" : pace <= 6 ? "Recent blocks are arriving quickly" : "Block production is near target",
            summary: `The latest observed block intervals average ${pace.toFixed(1)} minutes. Short windows are noisy; Bitcoin targets about 10 minutes over time.`,
            value: `${pace.toFixed(1)} min`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/blocks"
        });
    }

    return events;
}

function percentChange(current, previous) {
    if (!isFiniteNumber(current) || !isFiniteNumber(previous) || Number(previous) === 0) return null;
    return ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100;
}

function buildComparisonEvents(current, previousVisit) {
    if (!previousVisit?.metrics) return [];
    const previous = previousVisit.metrics;
    const events = [];
    const publishedAt = current.generatedAt;
    const feeDelta = percentChange(current.metrics.feeFast, previous.feeFast);

    if (feeDelta !== null && (Math.abs(feeDelta) >= 50 || Math.abs(current.metrics.feeFast - previous.feeFast) >= 5)) {
        const rising = feeDelta > 0;
        events.push({
            id: `visit-fee-${current.metrics.feeFast}`,
            category: "Since last visit",
            level: rising && current.metrics.feeFast >= 10 ? "notable" : "routine",
            title: `Priority fees ${rising ? "rose" : "fell"} ${Math.abs(feeDelta).toFixed(0)}%`,
            summary: `The high-priority estimate moved from ${previous.feeFast} to ${current.metrics.feeFast} sat/vB since this browser last checked.`,
            value: `${current.metrics.feeFast} sat/vB`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    const mempoolDelta = percentChange(current.metrics.mempoolVsizeMB, previous.mempoolVsizeMB);
    if (mempoolDelta !== null && (Math.abs(mempoolDelta) >= 40 || Math.abs(current.metrics.mempoolVsizeMB - previous.mempoolVsizeMB) >= 10)) {
        const rising = mempoolDelta > 0;
        events.push({
            id: `visit-mempool-${current.metrics.mempoolVsizeMB}`,
            category: "Since last visit",
            level: rising && current.metrics.mempoolVsizeMB >= 20 ? "notable" : "routine",
            title: `Mempool pressure ${rising ? "increased" : "cleared"}`,
            summary: `Queued virtual size moved from ${Number(previous.mempoolVsizeMB).toFixed(1)} to ${Number(current.metrics.mempoolVsizeMB).toFixed(1)} MvB.`,
            value: `${mempoolDelta > 0 ? "+" : ""}${mempoolDelta.toFixed(0)}%`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    const priceDelta = percentChange(current.metrics.priceUsd, previous.priceUsd);
    if (priceDelta !== null && Math.abs(priceDelta) >= 5) {
        events.push({
            id: `visit-price-${current.metrics.priceUsd}`,
            category: "Since last visit",
            level: "notable",
            title: `Bitcoin’s USD reference moved ${Math.abs(priceDelta).toFixed(1)}%`,
            summary: `The reference price moved from ${formatCurrency(previous.priceUsd)} to ${formatCurrency(current.metrics.priceUsd)}. Price is context, not a recommendation.`,
            value: `${priceDelta > 0 ? "+" : ""}${priceDelta.toFixed(1)}%`,
            publishedAt,
            source: "mempool.space",
            sourceUrl: "https://mempool.space/"
        });
    }

    return events;
}

function deduplicateFeed(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = item.id || `${item.title}-${item.source}`;
        if (!item.title || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function setStatus(status, successfulSources, totalSources) {
    const normalized = ["live", "partial", "fallback", "degraded"].includes(status) ? status : "partial";
    const labels = {
        live: "Live",
        partial: "Partial data",
        fallback: "Cached data",
        degraded: "Unavailable"
    };

    elements.dataStatus.className = `data-status ${normalized}`;
    elements.dataStatusLabel.textContent = labels[normalized];
    if (successfulSources && totalSources && normalized !== "live") {
        elements.dataStatusLabel.textContent += ` · ${successfulSources}/${totalSources}`;
    }
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function renderMetrics(metrics) {
    setText(elements.priceValue, formatCurrency(metrics.priceUsd));
    setText(elements.priceDetail, "USD reference");

    setText(elements.paceValue, isFiniteNumber(metrics.blockHeight)
        ? formatNumber(metrics.blockHeight)
        : "—");
    setText(elements.paceDetail, isFiniteNumber(metrics.avgBlockTimeMinutes)
        ? `${Number(metrics.avgBlockTimeMinutes).toFixed(1)} min recent pace`
        : "Latest confirmed block");

    setText(elements.feeValue, isFiniteNumber(metrics.feeFast) ? String(metrics.feeFast) : "—");
    setText(elements.feeDetail, isFiniteNumber(metrics.feeFast) ? "High-priority estimate" : "Estimate unavailable");

    setText(elements.mempoolValue, isFiniteNumber(metrics.mempoolVsizeMB)
        ? `${Number(metrics.mempoolVsizeMB).toFixed(1)}`
        : "—");
    setText(elements.mempoolDetail, isFiniteNumber(metrics.mempoolVsizeMB)
        ? `About ${Math.ceil(metrics.mempoolVsizeMB)} blocks queued`
        : "Data unavailable");
}

function renderFeePulse(metrics) {
    const fee = numberOrNull(metrics.feeFast);
    const level = fee === null ? "notable" : fee >= 25 ? "action" : fee >= 10 ? "notable" : "routine";
    const title = fee === null ? "Fee data unavailable" : level === "action" ? "Blockspace is expensive" : level === "notable" ? "Fee pressure is elevated" : "Blockspace is calm";
    const label = fee === null ? "Unknown" : level === "action" ? "Action" : level === "notable" ? "Watch" : "Calm";
    const copy = fee === null
        ? "The latest fee source could not be reached."
        : level === "action"
            ? "Fees are high. Check your wallet estimate before sending."
            : level === "notable"
                ? "Demand is above the quiet-network range."
                : "Current estimates are in the quiet-network range.";

    setText(elements.feeStateTitle, title);
    setText(elements.feeStatePill, label);
    elements.feeStatePill.className = `state-pill ${level}`;
    setText(elements.feeStateCopy, copy);
    setText(elements.feeFast, isFiniteNumber(metrics.feeFast) ? metrics.feeFast : "—");
    setText(elements.feeHour, isFiniteNumber(metrics.feeHour) ? metrics.feeHour : "—");
    setText(elements.feeEconomy, isFiniteNumber(metrics.feeEconomy) ? metrics.feeEconomy : "—");
}

function renderDifficulty(metrics) {
    const progress = clamp(numberOrNull(metrics.difficultyProgress) ?? 0, 0, 100);
    const change = numberOrNull(metrics.difficultyChange);
    elements.difficultyProgress.style.width = `${progress}%`;
    setText(elements.difficultyProgressLabel, `${progress.toFixed(1)}% of epoch complete`);
    setText(elements.difficultyRemaining, isFiniteNumber(metrics.remainingBlocks)
        ? `${formatNumber(metrics.remainingBlocks)} blocks remaining`
        : "Remaining blocks unavailable");
    setText(elements.difficultyChange, change === null
        ? "—"
        : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`);
    setText(elements.difficultyCopy, metrics.estimatedRetargetDate
        ? `Estimated retarget ${formatRelativeTime(metrics.estimatedRetargetDate)}.`
        : "Difficulty adjusts every 2,016 blocks.");
}

function renderVisitSummary(comparisonEvents) {
    const meaningful = comparisonEvents.filter((item) => item.level === "action" || item.level === "notable").length;
    setText(elements.changeCount, String(meaningful));

    if (state.previous?.seenAt) {
        setText(elements.lastVisit, formatRelativeTime(state.previous.seenAt));
        setText(elements.visitContext, meaningful
            ? "Compared with the snapshot saved in this browser."
            : "Nothing crossed a notable threshold since your last check.");
    } else {
        setText(elements.lastVisit, "First visit");
        setText(elements.visitContext, "Your next visit will show what changed.");
    }
}

function renderFeed() {
    const template = document.getElementById("feed-item-template");
    const visibleItems = state.activeFilter === "all"
        ? state.feed
        : state.feed.filter((item) => item.level === state.activeFilter);
    const fragment = document.createDocumentFragment();

    visibleItems.forEach((item) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.classList.add(item.level || "routine");
        node.querySelector(".feed-level").textContent = item.level === "action" ? "Action" : item.level === "notable" ? "Notable" : "Routine";
        node.querySelector(".feed-category").textContent = item.category || "Update";
        const time = node.querySelector("time");
        time.dateTime = item.publishedAt || "";
        time.textContent = formatRelativeTime(item.publishedAt);
        time.title = formatExactTime(item.publishedAt);
        node.querySelector("h3").textContent = item.title;
        const value = node.querySelector(".feed-value");
        value.textContent = item.value || "";
        value.hidden = !item.value;
        node.querySelector(".feed-summary").textContent = item.summary || "Open the source for details.";
        const link = node.querySelector(".source-link");
        link.href = item.sourceUrl || "https://bitcoin.org/";
        link.setAttribute("aria-label", `Open ${item.source || "source"}: ${item.title}`);
        link.querySelector("span").textContent = item.source || "Open source";
        fragment.append(node);
    });

    elements.feedList.replaceChildren(fragment);
    elements.feedList.setAttribute("aria-busy", "false");
    elements.feedEmpty.hidden = visibleItems.length > 0;
}

function render(current) {
    state.current = current;
    const comparisonEvents = buildComparisonEvents(current, state.previous);
    const liveEvents = buildCurrentEvents(current.metrics, current.generatedAt);
    const updates = Array.isArray(current.updates) ? current.updates : [];
    const priority = { action: 0, notable: 1, routine: 2 };
    state.feed = deduplicateFeed([...comparisonEvents, ...liveEvents, ...updates])
        .sort((left, right) => {
            const priorityDelta = (priority[left.level] ?? 2) - (priority[right.level] ?? 2);
            if (priorityDelta !== 0) return priorityDelta;
            return new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0);
        });

    setStatus(current.status, current.successfulSources, current.totalSources);
    setText(elements.snapshotTime, current.generatedAt
        ? `Updated ${formatRelativeTime(current.generatedAt)}`
        : "Snapshot time unavailable");
    renderMetrics(current.metrics);
    renderFeePulse(current.metrics);
    renderDifficulty(current.metrics);
    renderVisitSummary(comparisonEvents);
    renderFeed();
    scheduleSave();
}

async function refresh({ initial = false } = {}) {
    elements.refreshButton.disabled = true;
    elements.refreshButton.classList.add("loading");

    const snapshot = initial ? await loadSnapshot() : state.current || await loadSnapshot();
    if (initial) render(snapshot);

    try {
        const live = await loadLiveNetwork();
        render({
            ...snapshot,
            ...live,
            metrics: mergeMetrics(snapshot.metrics, live.metrics),
            updates: snapshot.updates || [],
            events: snapshot.events || []
        });
    } catch {
        render({
            ...snapshot,
            status: snapshot.status === "live" ? "fallback" : snapshot.status || "degraded"
        });
    } finally {
        elements.refreshButton.disabled = false;
        elements.refreshButton.classList.remove("loading");
    }
}

document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
        state.activeFilter = button.dataset.filter;
        document.querySelectorAll(".filter-button").forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle("active", active);
            candidate.setAttribute("aria-pressed", String(active));
        });
        renderFeed();
    });
});

elements.refreshButton.addEventListener("click", () => refresh());
window.addEventListener("pagehide", saveCurrentVisit);

refresh({ initial: true });
