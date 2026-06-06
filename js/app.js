const STORAGE_KEY = "btc_wedding_simple_plan";

const state = {
    currentBtcPrice: null,
    blockHeight: null
};

const DCA_INPUT_IDS = [
    "dca-amount",
    "dca-frequency",
    "dca-years",
    "starting-btc",
    "avg-price",
    "target-btc",
    "future-price"
];

document.addEventListener("DOMContentLoaded", () => {
    setupHeaderState();
    setupPlanner();
    setupChecklist();
    setupSummaryActions();
    setupMarketRefresh();
    restoreLocalState();
    fetchBitcoinSnapshot();
    calculateDca();
    updateStorageScore();
});

function setupHeaderState() {
    const header = document.querySelector(".site-header");
    window.addEventListener("scroll", () => {
        if (!header) return;
        header.style.boxShadow = window.scrollY > 20 ? "0 10px 30px rgba(0, 0, 0, 0.24)" : "none";
    });
}

function setupPlanner() {
    DCA_INPUT_IDS.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener("input", handlePlanChange);
        input.addEventListener("change", handlePlanChange);
    });

    document.querySelectorAll(".preset-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const target = document.getElementById("target-btc");
            target.value = button.dataset.targetBtc;
            markActivePreset();
            handlePlanChange();
        });
    });
}

function setupChecklist() {
    document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            updateStorageScore();
            saveLocalState();
        });
    });
}

function setupSummaryActions() {
    const copyBtn = document.getElementById("copy-summary");
    const printBtn = document.getElementById("print-summary");
    const resetBtn = document.getElementById("reset-summary");

    copyBtn?.addEventListener("click", async () => {
        try {
            await copyTextToClipboard(buildSummaryText());
            flashButton(copyBtn, "Copied");
        } catch (err) {
            console.warn("Copy failed", err);
            flashButton(copyBtn, "Copy failed");
        }
    });

    printBtn?.addEventListener("click", () => window.print());

    resetBtn?.addEventListener("click", () => {
        resetLocalState();
    });
}

function setupMarketRefresh() {
    document.getElementById("refresh-market")?.addEventListener("click", fetchBitcoinSnapshot);
}

function handlePlanChange() {
    markActivePreset();
    calculateDca();
    saveLocalState();
}

async function fetchBitcoinSnapshot() {
    const priceEl = document.getElementById("btc-price");
    const blockEl = document.getElementById("btc-block");
    const statusEl = document.getElementById("market-status");
    const statusDot = document.getElementById("status-dot");

    statusDot?.classList.remove("ok", "error");
    if (statusEl) statusEl.textContent = "Fetching public market and block data.";

    try {
        const price = await fetchPrice();
        state.currentBtcPrice = price;
        if (priceEl) priceEl.textContent = formatCurrency(price);

        const avgPriceEl = document.getElementById("avg-price");
        if (avgPriceEl && Number(avgPriceEl.value) === 100000) {
            avgPriceEl.value = Math.round(price);
            calculateDca();
        }
    } catch (err) {
        console.warn("Price fetch failed", err);
        if (priceEl) priceEl.textContent = "Unavailable";
    }

    try {
        const height = await fetchBlockHeight();
        state.blockHeight = height;
        if (blockEl) blockEl.textContent = `#${height.toLocaleString("en-US")}`;
    } catch (err) {
        console.warn("Block height fetch failed", err);
        if (blockEl) blockEl.textContent = "Unavailable";
    }

    if (state.currentBtcPrice || state.blockHeight) {
        statusDot?.classList.add("ok");
        if (statusEl) statusEl.textContent = "Live reference loaded. Calculations still use your editable assumptions.";
    } else {
        statusDot?.classList.add("error");
        if (statusEl) statusEl.textContent = "Live data unavailable. The planner still works with manual assumptions.";
    }
}

async function fetchPrice() {
    const coinbaseRes = await fetchWithTimeout("https://api.coinbase.com/v2/prices/BTC-USD/spot");
    if (coinbaseRes.ok) {
        const data = await coinbaseRes.json();
        const price = Number(data.data.amount);
        if (Number.isFinite(price)) return price;
    }

    const mempoolRes = await fetchWithTimeout("https://mempool.space/api/v1/prices");
    if (mempoolRes.ok) {
        const data = await mempoolRes.json();
        const price = Number(data.USD);
        if (Number.isFinite(price)) return price;
    }

    throw new Error("No valid price source.");
}

async function fetchBlockHeight() {
    const res = await fetchWithTimeout("https://blockstream.info/api/blocks/tip/height");
    if (!res.ok) throw new Error("Block height unavailable.");
    const height = Number(await res.text());
    if (!Number.isFinite(height)) throw new Error("Invalid block height.");
    return height;
}

async function fetchWithTimeout(url, timeoutMs = 4500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

function calculateDca() {
    const amount = readNumber("dca-amount");
    const frequency = readNumber("dca-frequency");
    const years = readNumber("dca-years");
    const startingBtc = readNumber("starting-btc");
    const avgPrice = readNumber("avg-price");
    const targetBtc = readNumber("target-btc");
    const futurePrice = readNumber("future-price");

    const buys = Math.max(0, frequency * years);
    const totalInvested = amount * buys;
    const purchasedBtc = avgPrice > 0 ? totalInvested / avgPrice : 0;
    const projectedBtc = startingBtc + purchasedBtc;
    const costBasis = totalInvested + startingBtc * avgPrice;
    const futureValue = projectedBtc * futurePrice;
    const gainLoss = futureValue - costBasis;
    const progress = targetBtc > 0 ? Math.min(100, (projectedBtc / targetBtc) * 100) : 0;

    setText("future-price-label", formatCurrency(futurePrice, 0));
    setText("projected-btc", `${formatBtc(projectedBtc)} BTC`);
    setText("projected-sats", `${formatSats(projectedBtc)} sats`);
    setText("total-invested", formatCurrency(totalInvested, 0));
    setText("future-value", formatCurrency(futureValue, 0));
    setText("estimated-return", formatSignedCurrency(gainLoss));
    setText("time-to-target", estimateTimeToTarget({ amount, frequency, avgPrice, startingBtc, targetBtc }));

    const returnEl = document.getElementById("estimated-return");
    returnEl?.classList.toggle("positive", gainLoss >= 0);
    returnEl?.classList.toggle("negative", gainLoss < 0);

    setText("target-status", targetBtc > 0
        ? `${progress.toFixed(1)}% of your ${formatBtc(targetBtc)} BTC target (${formatSats(targetBtc)} sats).`
        : "Set a target to see progress.");

    updateScenario("50", projectedBtc, costBasis, 50000);
    updateScenario("100", projectedBtc, costBasis, 100000);
    updateScenario("250", projectedBtc, costBasis, 250000);
    updateScenario("1000", projectedBtc, costBasis, 1000000);
    updateSummary();
}

function updateScenario(id, btc, costBasis, price) {
    const value = btc * price;
    const multiple = costBasis > 0 ? value / costBasis : 0;
    setText(`scenario-${id}`, formatCurrency(value, 0));
    setText(`multiple-${id}`, `${multiple.toFixed(1)}x`);
}

function estimateTimeToTarget({ amount, frequency, avgPrice, startingBtc, targetBtc }) {
    if (!targetBtc || targetBtc <= startingBtc) return "Already there";
    if (!amount || !frequency || !avgPrice) return "N/A";

    const btcPerYear = (amount * frequency) / avgPrice;
    if (btcPerYear <= 0) return "N/A";

    const years = (targetBtc - startingBtc) / btcPerYear;
    if (years > 99) return "99+ years";
    if (years < 1 / 12) return "Under 1 month";
    if (years < 1) return `${Math.ceil(years * 12)} months`;
    return `${years.toFixed(1)} years`;
}

function updateStorageScore() {
    const checkboxes = Array.from(document.querySelectorAll("#checklist input[type='checkbox']"));
    const rawScore = checkboxes.reduce((total, checkbox) => {
        return total + (checkbox.checked ? Number(checkbox.dataset.points) : 0);
    }, 0);
    const score = Math.min(100, rawScore);

    setText("storage-score", score.toString());
    document.querySelector(".score-ring")?.style.setProperty("--score-percent", score);

    const gradeEl = document.getElementById("storage-grade");
    const adviceEl = document.getElementById("storage-advice");
    if (score >= 85) {
        gradeEl.textContent = "Strong custody discipline";
        adviceEl.textContent = "Your core storage habits are strong. Keep reviewing the setup yearly.";
    } else if (score >= 65) {
        gradeEl.textContent = "Good, with gaps";
        adviceEl.textContent = "You have a workable setup. Focus on the top missing items below.";
    } else if (score >= 35) {
        gradeEl.textContent = "Fragile setup";
        adviceEl.textContent = "Before stacking more, close the basic seed, backup, and recovery gaps.";
    } else {
        gradeEl.textContent = "Needs attention";
        adviceEl.textContent = "Start with offline seed handling and a recovery test. Those mistakes are expensive to discover late.";
    }

    const missing = checkboxes
        .filter((checkbox) => !checkbox.checked)
        .slice(0, 3)
        .map((checkbox) => checkbox.dataset.priority);

    const priorityItems = document.getElementById("priority-items");
    if (priorityItems) {
        priorityItems.innerHTML = missing.length
            ? missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
            : "<li>Schedule your next annual custody review.</li><li>Update instructions whenever wallet devices or backup locations change.</li>";
    }

    updateSummary();
}

function updateSummary() {
    setText("summary-text", buildSummaryText());
}

function buildSummaryText() {
    const amount = readNumber("dca-amount");
    const frequencyLabel = document.getElementById("dca-frequency")?.selectedOptions[0]?.textContent || "monthly";
    const years = readNumber("dca-years");
    const avgPrice = readNumber("avg-price");
    const startingBtc = readNumber("starting-btc");
    const futurePrice = readNumber("future-price");
    const targetBtc = readNumber("target-btc");
    const storageScore = Number(document.getElementById("storage-score")?.textContent || 0);

    const totalInvested = amount * readNumber("dca-frequency") * years;
    const projectedBtc = startingBtc + (avgPrice > 0 ? totalInvested / avgPrice : 0);
    const futureValue = projectedBtc * futurePrice;

    return `DCA plan: ${formatCurrency(amount, 0)} ${frequencyLabel.toLowerCase()} for ${years} years at an assumed average buy price of ${formatCurrency(avgPrice, 0)}. Projected stack: ${formatBtc(projectedBtc)} BTC (${formatSats(projectedBtc)} sats), worth ${formatCurrency(futureValue, 0)} at ${formatCurrency(futurePrice, 0)} per BTC. Target: ${formatBtc(targetBtc)} BTC. Cold storage score: ${storageScore}/100.`;
}

function saveLocalState() {
    try {
        const inputs = {};
        DCA_INPUT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (input) inputs[id] = input.value;
        });

        const checks = Array.from(document.querySelectorAll("#checklist input[type='checkbox']")).map((checkbox) => checkbox.checked);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs, checks }));
    } catch (err) {
        console.warn("Failed to save local state", err);
    }
}

function restoreLocalState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);

        Object.entries(data.inputs || {}).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = value;
        });

        const checks = Array.isArray(data.checks) ? data.checks : [];
        document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox, index) => {
            checkbox.checked = Boolean(checks[index]);
        });
        markActivePreset();
    } catch (err) {
        console.warn("Failed to restore local state", err);
    }
}

function resetLocalState() {
    localStorage.removeItem(STORAGE_KEY);

    const defaults = {
        "dca-amount": "100",
        "dca-frequency": "12",
        "dca-years": "5",
        "starting-btc": "0",
        "avg-price": state.currentBtcPrice ? String(Math.round(state.currentBtcPrice)) : "100000",
        "target-btc": "1",
        "future-price": "250000"
    };

    Object.entries(defaults).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
    });

    document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false;
    });

    markActivePreset();
    calculateDca();
    updateStorageScore();
}

function markActivePreset() {
    const current = readNumber("target-btc");
    document.querySelectorAll(".preset-btn").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.targetBtc) === current);
    });
}

function readNumber(id) {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) ? value : 0;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatCurrency(value, digits = 2) {
    if (!Number.isFinite(value)) return "N/A";
    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function formatSignedCurrency(value) {
    const formatted = formatCurrency(Math.abs(value), 0);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatBtc(value) {
    if (!Number.isFinite(value)) return "0.00000000";
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8
    });
}

function formatSats(btc) {
    if (!Number.isFinite(btc)) return "0";
    return Math.round(btc * 100000000).toLocaleString("en-US");
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const success = document.execCommand("copy");
        if (!success) throw new Error("Copy command returned false.");
    } finally {
        document.body.removeChild(textarea);
    }
}

function flashButton(button, text) {
    const previous = button.textContent;
    button.textContent = text;
    setTimeout(() => {
        button.textContent = previous;
    }, 1200);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
