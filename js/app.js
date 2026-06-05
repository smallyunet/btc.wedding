const state = {
    currentBtcPrice: null,
    blockHeight: null,
    blockHash: "",
    prevValues: {
        "storage-score": 0,
        "projected-btc": 0,
        "total-invested": 0,
        "future-value": 0,
        "estimated-return": 0,
        "scenario-50": 0,
        "scenario-100": 0,
        "scenario-250": 0,
        "scenario-1000": 0
    }
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

const STORAGE_PRIORITIES = [
    "Generate seed material offline with a reputable hardware wallet.",
    "Remove every digital copy of your seed phrase.",
    "Move the backup to durable offline material.",
    "Complete a small recovery test before adding meaningful funds.",
    "Separate backups across more than one physical location.",
    "Document passphrase usage clearly without placing it beside the seed.",
    "Reduce dependence on exchanges, phones, or laptops.",
    "Record wallet brand, derivation path, and recovery steps.",
    "Prepare emergency instructions that do not expose the seed by themselves.",
    "Set an annual custody review date."
];

// Active animation frames store
const activeAnimations = {};

document.addEventListener("DOMContentLoaded", () => {
    setupHeaderState();
    setupDcaPlanner();
    setupStorageChecklist();
    setupSummaryActions();
    setupMarketRefresh();
    fetchBitcoinSnapshot();
});

function setupHeaderState() {
    const header = document.querySelector(".site-header");
    window.addEventListener("scroll", () => {
        if (header) {
            header.style.boxShadow = window.scrollY > 20 ? "0 10px 30px rgba(0, 0, 0, 0.25)" : "none";
        }
    });
}

function setupDcaPlanner() {
    DCA_INPUT_IDS.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("input", calculateDca);
            input.addEventListener("change", calculateDca);
        }
    });

    if (state.currentBtcPrice) {
        const avgPrice = document.getElementById("avg-price");
        if (avgPrice) {
            avgPrice.value = Math.round(state.currentBtcPrice);
        }
    }

    calculateDca();
}

function setupStorageChecklist() {
    document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox) => {
        checkbox.addEventListener("change", updateStorageScore);
    });

    updateStorageScore();
}

function setupSummaryActions() {
    const copyBtn = document.getElementById("copy-summary");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            const summary = buildSummaryText();

            try {
                await navigator.clipboard.writeText(summary);
                flashButton("copy-summary", "Copied");
            } catch (err) {
                console.warn("Clipboard unavailable", err);
                flashButton("copy-summary", "Copy failed");
            }
        });
    }

    const printBtn = document.getElementById("print-summary");
    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
    }
}

function setupMarketRefresh() {
    const refreshBtn = document.getElementById("refresh-market");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            const icon = refreshBtn.querySelector(".refresh-icon");
            if (icon) icon.classList.add("spinning");
            refreshBtn.disabled = true;

            await fetchBitcoinSnapshot();

            // Retain satisfying spinner visual for 800ms
            setTimeout(() => {
                if (icon) icon.classList.remove("spinning");
                refreshBtn.disabled = false;
            }, 800);
        });
    }
}

async function fetchBitcoinSnapshot() {
    const priceEl = document.getElementById("btc-price");
    const blockEl = document.getElementById("btc-block");
    const hashEl = document.getElementById("btc-hash");
    const statusEl = document.getElementById("market-status");
    const statusDot = document.getElementById("status-dot");

    let priceSuccess = false;
    let blockSuccess = false;

    try {
        const price = await fetchPrice();
        state.currentBtcPrice = price;
        priceEl.textContent = formatCurrency(price);
        priceSuccess = true;

        const avgPrice = document.getElementById("avg-price");
        if (avgPrice && Number(avgPrice.value) === 100000) {
            avgPrice.value = Math.round(price);
            calculateDca();
        }
    } catch (err) {
        console.warn("Price fetch failed", err);
        priceEl.textContent = "Unavailable";
    }

    try {
        const [height, hash] = await Promise.all([fetchBlockHeight(), fetchBlockHash()]);
        state.blockHeight = height;
        state.blockHash = hash;
        blockEl.textContent = `#${height.toLocaleString("en-US")}`;
        hashEl.textContent = shortenHash(hash);
        blockSuccess = true;
    } catch (err) {
        console.warn("Block data fetch failed", err);
        blockEl.textContent = "Unavailable";
        hashEl.textContent = "Unavailable";
    }

    if (statusDot) {
        if (priceSuccess && blockSuccess) {
            statusDot.className = "status-dot pulsing";
        } else {
            statusDot.className = "status-dot error";
        }
    }

    statusEl.textContent = state.currentBtcPrice
        ? "Live data loaded from public Bitcoin APIs."
        : "Live data unavailable. Planner still works with your manual assumptions.";
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

    throw new Error("No price source returned a valid value.");
}

async function fetchBlockHeight() {
    const res = await fetchWithTimeout("https://blockstream.info/api/blocks/tip/height");
    if (!res.ok) throw new Error("Block height unavailable.");
    return Number(await res.text());
}

async function fetchBlockHash() {
    const res = await fetchWithTimeout("https://blockstream.info/api/blocks/tip/hash");
    if (!res.ok) throw new Error("Block hash unavailable.");
    return res.text();
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

// Numerical interpolation animator (Ease out quad)
function animateValue(elementId, start, end, duration, formatFn) {
    if (activeAnimations[elementId]) {
        cancelAnimationFrame(activeAnimations[elementId]);
    }

    if (start === end) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = formatFn(end);
        return;
    }

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress); // easeOutQuad
        const current = start + (end - start) * ease;

        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = formatFn(current);
        }

        if (progress < 1) {
            activeAnimations[elementId] = requestAnimationFrame(update);
        } else {
            if (el) el.textContent = formatFn(end);
            delete activeAnimations[elementId];
        }
    }

    activeAnimations[elementId] = requestAnimationFrame(update);
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
    const recurringInvested = amount * buys;
    const purchasedBtc = avgPrice > 0 ? recurringInvested / avgPrice : 0;
    const projectedBtc = startingBtc + purchasedBtc;
    const startingCostBasis = startingBtc * avgPrice;
    const totalCostBasis = startingCostBasis + recurringInvested;
    const futureValue = projectedBtc * futurePrice;
    const estimatedReturn = futureValue - totalCostBasis;
    const progress = targetBtc > 0 ? Math.min(100, (projectedBtc / targetBtc) * 100) : 0;

    const futurePriceLabel = document.getElementById("future-price-label");
    if (futurePriceLabel) {
        futurePriceLabel.textContent = formatCurrency(futurePrice, 0);
    }

    // Smooth value counters
    const prev = state.prevValues;
    animateValue("projected-btc", prev["projected-btc"], projectedBtc, 450, (v) => `${formatBtc(v)} BTC`);
    animateValue("total-invested", prev["total-invested"], recurringInvested, 450, (v) => formatCurrency(v, 0));
    animateValue("future-value", prev["future-value"], futureValue, 450, (v) => formatCurrency(v, 0));
    animateValue("estimated-return", prev["estimated-return"], estimatedReturn, 450, (v) => formatSignedCurrency(v));

    prev["projected-btc"] = projectedBtc;
    prev["total-invested"] = recurringInvested;
    prev["future-value"] = futureValue;
    prev["estimated-return"] = estimatedReturn;

    const returnEl = document.getElementById("estimated-return");
    if (returnEl) {
        returnEl.classList.toggle("positive", estimatedReturn >= 0);
        returnEl.classList.toggle("negative", estimatedReturn < 0);
    }

    const statusEl = document.getElementById("target-status");
    if (statusEl) {
        statusEl.textContent = targetBtc > 0
            ? `${progress.toFixed(1)}% of your ${formatBtc(targetBtc)} BTC target.`
            : "Set a target to see progress.";
    }

    const timeEl = document.getElementById("time-to-target");
    if (timeEl) {
        timeEl.textContent = estimateTimeToTarget({
            amount,
            frequency,
            avgPrice,
            startingBtc,
            targetBtc
        });
    }

    updateScenario("50", projectedBtc, totalCostBasis, 50000);
    updateScenario("100", projectedBtc, totalCostBasis, 100000);
    updateScenario("250", projectedBtc, totalCostBasis, 250000);
    updateScenario("1000", projectedBtc, totalCostBasis, 1000000);
    updateSummary();
}

function updateScenario(id, btc, costBasis, price) {
    const value = btc * price;
    const multiple = costBasis > 0 ? value / costBasis : 0;
    
    const key = `scenario-${id}`;
    const prevVal = state.prevValues[key] || 0;
    state.prevValues[key] = value;

    animateValue(key, prevVal, value, 450, (v) => formatCurrency(v, 0));

    const multEl = document.getElementById(`multiple-${id}`);
    if (multEl) {
        multEl.textContent = `${multiple.toFixed(1)}x`;
    }
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
    const score = checkboxes.reduce((total, checkbox) => {
        return total + (checkbox.checked ? Number(checkbox.dataset.points) : 0);
    }, 0);
    const missing = checkboxes
        .map((checkbox, index) => ({ checkbox, index }))
        .filter((item) => !item.checkbox.checked)
        .slice(0, 3);

    const startScore = state.prevValues["storage-score"];
    state.prevValues["storage-score"] = score;
    animateValue("storage-score", startScore, score, 500, (v) => Math.round(v).toString());

    // Update SVG Stroke Progress ring
    const scoreProgress = document.getElementById("score-ring-progress");
    if (scoreProgress) {
        const circumference = 534;
        const offset = circumference - (score / 100) * circumference;
        scoreProgress.style.strokeDashoffset = offset;

        // Dynamic color shifting rules
        let strokeColor = "var(--red)";
        if (score >= 85) {
            strokeColor = "var(--green)";
        } else if (score >= 65) {
            strokeColor = "var(--blue)";
        } else if (score >= 35) {
            strokeColor = "var(--orange)";
        }
        scoreProgress.style.stroke = strokeColor;
    }

    const gradeEl = document.getElementById("storage-grade");
    const adviceEl = document.getElementById("storage-advice");

    if (gradeEl && adviceEl) {
        if (score >= 85) {
            gradeEl.textContent = "Strong custody discipline";
            adviceEl.textContent = "Your setup covers the major failure modes. Keep the annual review habit and avoid becoming casual with backups.";
        } else if (score >= 65) {
            gradeEl.textContent = "Good, with gaps";
            adviceEl.textContent = "The foundation is there. Focus on recovery testing, physical separation, and emergency instructions.";
        } else if (score >= 35) {
            gradeEl.textContent = "Fragile setup";
            adviceEl.textContent = "Before stacking more, close the biggest custody gaps. Most losses come from basic storage and recovery mistakes.";
        } else {
            gradeEl.textContent = "Needs attention";
            adviceEl.textContent = "Start with offline seed handling and a recovery test. Those two mistakes are expensive to discover late.";
        }
    }

    const priorityItems = document.getElementById("priority-items");
    if (priorityItems) {
        if (missing.length === 0) {
            priorityItems.innerHTML = "<li>Schedule the next annual custody review.</li><li>Keep instructions updated when wallets or locations change.</li>";
        } else {
            priorityItems.innerHTML = missing
                .map(({ index }) => `<li>${STORAGE_PRIORITIES[index]}</li>`)
                .join("");
        }
    }

    updateSummary();
}

function updateSummary() {
    const summaryEl = document.getElementById("summary-text");
    if (!summaryEl) return;

    summaryEl.textContent = buildSummaryText();
}

function buildSummaryText() {
    const amount = readNumber("dca-amount");
    const frequency = readNumber("dca-frequency");
    const years = readNumber("dca-years");
    const avgPrice = readNumber("avg-price");
    const startingBtc = readNumber("starting-btc");
    const futurePrice = readNumber("future-price");
    const targetBtc = readNumber("target-btc");
    const storageScore = Number(document.getElementById("storage-score")?.textContent || 0);
    
    const freqEl = document.getElementById("dca-frequency");
    const frequencyLabel = freqEl ? freqEl.selectedOptions[0].textContent : "monthly";

    const recurringInvested = amount * frequency * years;
    const projectedBtc = startingBtc + (avgPrice > 0 ? recurringInvested / avgPrice : 0);
    const futureValue = projectedBtc * futurePrice;

    return `DCA plan: ${formatCurrency(amount, 0)} ${frequencyLabel.toLowerCase()} for ${years} years, assuming an average buy price of ${formatCurrency(avgPrice, 0)}. Projected stack: ${formatBtc(projectedBtc)} BTC, worth ${formatCurrency(futureValue, 0)} at ${formatCurrency(futurePrice, 0)} per BTC. Target: ${formatBtc(targetBtc)} BTC. Cold storage score: ${storageScore}/100.`;
}

function readNumber(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const value = Number(el.value);
    return Number.isFinite(value) ? value : 0;
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

function shortenHash(hash) {
    if (!hash || hash.length < 18) return "Unavailable";
    return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

function flashButton(id, text) {
    const button = document.getElementById(id);
    if (!button) return;
    const previous = button.textContent;
    
    // Check if button has inner SVGs we need to temporarily keep/hide or flash
    const hasSvg = button.querySelector("svg");
    
    if (hasSvg) {
        button.innerHTML = text;
    } else {
        button.textContent = text;
    }

    setTimeout(() => {
        if (hasSvg) {
            button.innerHTML = "";
            button.appendChild(hasSvg);
            const textNode = document.createTextNode(" " + previous.trim());
            button.appendChild(textNode);
        } else {
            button.textContent = previous;
        }
    }, 1300);
}
