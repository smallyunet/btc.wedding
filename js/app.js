const STORAGE_KEY = "btc_wedding_simple_plan";

const state = {
    currentBtcPrice: null,
    blockHeight: null
};

let dcaChartInstance = null;

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
    setupAdvancedAccordion();
    setupSpotlightCards();
    restoreLocalState();
    fetchBitcoinSnapshot();
    calculateDca();
    updateStorageScore();
    updateSegmentedIndicator();
    updateSliderProgress();
    updateChecklistVisuals();

    const printDateEl = document.getElementById("print-date");
    if (printDateEl) {
        printDateEl.textContent = new Date().toLocaleDateString("en-US", { dateStyle: "long" });
    }

    window.addEventListener("resize", updateSegmentedIndicator);
});

function setupHeaderState() {
    const header = document.querySelector(".site-header");
    window.addEventListener("scroll", () => {
        if (!header) return;
        header.style.boxShadow = window.scrollY > 20 ? "0 10px 30px rgba(0, 0, 0, 0.24)" : "none";
    });
}

function setupAdvancedAccordion() {
    const toggleBtn = document.getElementById("advanced-toggle");
    const panel = document.getElementById("advanced-panel");
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener("click", () => {
        const isExpanded = panel.classList.toggle("expanded");
        toggleBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function setupPlanner() {
    const debouncedPlanChange = debounce(handlePlanChange, 180);

    DCA_INPUT_IDS.forEach((id) => {
        if (id === "dca-frequency") {
            document.querySelectorAll('input[name="dca-frequency"]').forEach((radio) => {
                radio.addEventListener("change", handlePlanChange);
            });
            return;
        }
        const input = document.getElementById(id);
        if (!input) return;

        if (input.type === "number" || input.type === "text") {
            input.addEventListener("input", debouncedPlanChange);
            input.addEventListener("change", handlePlanChange);
        } else {
            input.addEventListener("input", handlePlanChange);
            input.addEventListener("change", handlePlanChange);
        }
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
            updateChecklistVisuals();
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
    updateSegmentedIndicator();
    updateSliderProgress();
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
        if (priceEl) {
            updateNumberWithAnimation("btc-price", price, (v) => formatCurrency(v, 2));
        }

        const avgPriceEl = document.getElementById("avg-price");
        if (avgPriceEl && Number(avgPriceEl.value) === 100000) {
            avgPriceEl.value = Math.round(price);
            calculateDca();
        }

        const satsPerDollarEl = document.getElementById("sats-per-dollar");
        if (satsPerDollarEl) {
            updateNumberWithAnimation("sats-per-dollar", 100000000 / price, (v) => `${Math.round(v).toLocaleString("en-US")} sats`);
        }
    } catch (err) {
        console.warn("Price fetch failed", err);
        if (priceEl) priceEl.textContent = "Unavailable";
        const satsPerDollarEl = document.getElementById("sats-per-dollar");
        if (satsPerDollarEl) satsPerDollarEl.textContent = "Unavailable";
    }

    try {
        const height = await fetchBlockHeight();
        state.blockHeight = height;
        if (blockEl) {
            updateNumberWithAnimation("btc-block", height, (v) => `#${Math.round(v).toLocaleString("en-US")}`);
        }

        const currentEpoch = Math.floor(height / 210000);
        const nextHalvingBlock = (currentEpoch + 1) * 210000;
        const blocksRemaining = nextHalvingBlock - height;
        const epochStartBlock = currentEpoch * 210000;
        const progressPercent = ((height - epochStartBlock) / 210000) * 100;

        const halvingProgressEl = document.getElementById("halving-progress");
        const halvingCountdownEl = document.getElementById("halving-countdown");

        if (halvingProgressEl) {
            updateNumberWithAnimation("halving-progress", progressPercent, (v) => `${v.toFixed(2)}%`);
        }
        if (halvingCountdownEl) {
            updateNumberWithAnimation("halving-countdown", blocksRemaining, (v) => `${Math.round(v).toLocaleString("en-US")} blocks left`);
        }
    } catch (err) {
        console.warn("Block height fetch failed", err);
        if (blockEl) blockEl.textContent = "Unavailable";
        const halvingProgressEl = document.getElementById("halving-progress");
        const halvingCountdownEl = document.getElementById("halving-countdown");
        if (halvingProgressEl) halvingProgressEl.textContent = "Unavailable";
        if (halvingCountdownEl) halvingCountdownEl.textContent = "";
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
    updateNumberWithAnimation("projected-btc", projectedBtc, (v) => `${formatBtc(v)} BTC`);
    updateNumberWithAnimation("projected-sats", projectedBtc * 100000000, (v) => `${Math.round(v).toLocaleString("en-US")} sats`);
    updateNumberWithAnimation("total-invested", totalInvested, (v) => formatCurrency(v, 0));
    updateNumberWithAnimation("future-value", futureValue, (v) => formatCurrency(v, 0));
    updateNumberWithAnimation("estimated-return", gainLoss, (v) => formatSignedCurrency(v));
    setText("time-to-target", estimateTimeToTarget({ amount, frequency, avgPrice, startingBtc, targetBtc }));

    const returnEl = document.getElementById("estimated-return");
    returnEl?.classList.toggle("positive", gainLoss >= 0);
    returnEl?.classList.toggle("negative", gainLoss < 0);

    const progressBar = document.getElementById("progress-bar-fill");
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        // Transition colors from gold to green if 100% target met
        if (progress >= 100) {
            progressBar.style.background = "linear-gradient(90deg, #10b981 0%, #059669 100%)";
            progressBar.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
        } else {
            progressBar.style.background = "var(--accent-gradient)";
            progressBar.style.boxShadow = "0 0 8px rgba(229, 169, 60, 0.25)";
        }
    }

    setText("target-status", targetBtc > 0
        ? `${progress.toFixed(1)}% of your ${formatBtc(targetBtc)} BTC target (${formatSats(targetBtc)} sats).`
        : "Set a target to see progress.");

    updateScenario("50", projectedBtc, costBasis, 50000);
    updateScenario("100", projectedBtc, costBasis, 100000);
    updateScenario("250", projectedBtc, costBasis, 250000);
    updateScenario("1000", projectedBtc, costBasis, 1000000);

    renderDcaChart(years, startingBtc, avgPrice, futurePrice, totalInvested, purchasedBtc);

    updateSummary();
}

function updateScenario(id, btc, costBasis, price) {
    const value = btc * price;
    const multiple = costBasis > 0 ? value / costBasis : 0;
    updateNumberWithAnimation(`scenario-${id}`, value, (v) => formatCurrency(v, 0));
    updateNumberWithAnimation(`multiple-${id}`, multiple, (v) => `${v.toFixed(1)}x`);
}

function renderDcaChart(years, startingBtc, avgPrice, futurePrice, totalInvested, purchasedBtc) {
    if (typeof Chart === "undefined") return;

    const ctx = document.getElementById("dca-chart")?.getContext("2d");
    if (!ctx) return;

    const chartLabels = [];
    const investedData = [];
    const valueData = [];

    const intervals = years === 1 ? 12 : 10;
    const buys = Math.max(0, readNumber("dca-frequency") * years);

    for (let i = 0; i <= intervals; i++) {
        const t = i / intervals;
        const yr = t * years;

        if (years === 1) {
            chartLabels.push(`Mo ${i}`);
        } else {
            chartLabels.push(`Yr ${yr.toFixed(yr % 1 === 0 ? 0 : 1)}`);
        }

        // DCA buys up to this point
        const currentBuys = Math.floor(t * buys);
        const currentInvested = (readNumber("dca-amount") * currentBuys) + (startingBtc * avgPrice);
        investedData.push(Math.round(currentInvested));

        // Stack accumulated up to this point
        const currentPurchasedBtc = avgPrice > 0 ? (readNumber("dca-amount") * currentBuys) / avgPrice : 0;
        const currentBtc = startingBtc + currentPurchasedBtc;

        // Price at this interval (linear from avgPrice to futurePrice)
        const currentPrice = avgPrice + t * (futurePrice - avgPrice);
        const currentValue = currentBtc * currentPrice;
        valueData.push(Math.round(currentValue));
    }

    const valueGradient = ctx.createLinearGradient(0, 0, 0, 220);
    valueGradient.addColorStop(0, "rgba(16, 185, 129, 0.06)");
    valueGradient.addColorStop(1, "rgba(16, 185, 129, 0)");

    const investedGradient = ctx.createLinearGradient(0, 0, 0, 220);
    investedGradient.addColorStop(0, "rgba(229, 169, 60, 0.03)");
    investedGradient.addColorStop(1, "rgba(229, 169, 60, 0)");

    if (dcaChartInstance) {
        dcaChartInstance.destroy();
    }

    dcaChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: "Projected Value",
                    data: valueData,
                    borderColor: "#10b981", // Mint Green
                    backgroundColor: valueGradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.15
                },
                {
                    label: "Total Invested",
                    data: investedData,
                    borderColor: "#e5a93c", // Amber Gold
                    backgroundColor: investedGradient,
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.15
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: {
                        color: "rgba(245, 245, 247, 0.45)",
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        font: {
                            family: "var(--sans)",
                            size: 11,
                            weight: "500"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "rgba(10, 10, 12, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    titleColor: "#ffffff",
                    bodyColor: "rgba(245, 245, 247, 0.8)",
                    titleFont: { family: "var(--sans)", size: 12, weight: "600" },
                    bodyFont: { family: "var(--mono)", size: 11 },
                    padding: 10,
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.01)",
                        drawBorder: false
                    },
                    ticks: {
                        color: "rgba(245, 245, 247, 0.35)",
                        font: { family: "var(--sans)", size: 10 }
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.01)",
                        drawBorder: false
                    },
                    ticks: {
                        color: "rgba(245, 245, 247, 0.35)",
                        font: { family: "var(--mono)", size: 10 },
                        callback: function(value) {
                            if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'k';
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
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

    updateNumberWithAnimation("storage-score", score, (v) => Math.round(v).toString());

    const progressCircle = document.getElementById("score-ring-progress");
    if (progressCircle) {
        const radius = progressCircle.r.baseVal.value || 62;
        const circumference = 2 * Math.PI * radius;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (score / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;

        // Dynamically adjust color and glow filters based on custody score grade
        if (score >= 85) {
            progressCircle.style.stroke = "var(--green)";
            progressCircle.style.filter = "drop-shadow(0 0 8px rgba(16, 185, 129, 0.35))";
        } else if (score >= 65) {
            progressCircle.style.stroke = "var(--gold)";
            progressCircle.style.filter = "drop-shadow(0 0 8px rgba(229, 169, 60, 0.25))";
        } else if (score >= 35) {
            progressCircle.style.stroke = "var(--gold)";
            progressCircle.style.filter = "drop-shadow(0 0 8px rgba(229, 169, 60, 0.25))";
        } else {
            progressCircle.style.stroke = "var(--red)";
            progressCircle.style.filter = "drop-shadow(0 0 8px rgba(244, 63, 94, 0.35))";
        }
    }

    const gradeEl = document.getElementById("storage-grade");
    const adviceEl = document.getElementById("storage-advice");

    if (gradeEl) {
        if (score >= 85) {
            gradeEl.textContent = "Strong custody discipline";
        } else if (score >= 65) {
            gradeEl.textContent = "Good, with gaps";
        } else if (score >= 35) {
            gradeEl.textContent = "Fragile setup";
        } else {
            gradeEl.textContent = "Needs attention";
        }
    }

    if (adviceEl) {
        if (score >= 85) {
            adviceEl.textContent = "Strong storage habits. Review annually.";
        } else if (score >= 65) {
            adviceEl.textContent = "Workable setup. Focus on missing items below.";
        } else if (score >= 35) {
            adviceEl.textContent = "Close the basic seed, backup, and recovery gaps.";
        } else {
            adviceEl.textContent = "Start with offline seeds and a recovery test.";
        }
    }

    const missing = checkboxes
        .filter((checkbox) => !checkbox.checked)
        .slice(0, 3)
        .map((checkbox) => checkbox.dataset.priority);

    const priorityItems = document.getElementById("priority-items");
    if (priorityItems) {
        priorityItems.innerHTML = missing.length
            ? missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
            : "<li>Schedule annual custody review.</li><li>Update instructions on setup changes.</li>";
    }

    updateSummary();
}

function updateSummary() {
    setText("summary-text", buildSummaryText());
}

function buildSummaryText() {
    const amount = readNumber("dca-amount");
    const activeFreqRadio = document.querySelector('input[name="dca-frequency"]:checked');
    const frequencyLabel = activeFreqRadio ? activeFreqRadio.nextElementSibling.textContent : "Monthly";
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
            if (id === "dca-frequency") {
                const checked = document.querySelector('input[name="dca-frequency"]:checked');
                if (checked) inputs[id] = checked.value;
                return;
            }
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
            if (id === "dca-frequency") {
                const radio = document.querySelector(`input[name="dca-frequency"][value="${value}"]`);
                if (radio) radio.checked = true;
                return;
            }
            const input = document.getElementById(id);
            if (input) input.value = value;
        });

        const checks = Array.isArray(data.checks) ? data.checks : [];
        document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox, index) => {
            checkbox.checked = Boolean(checks[index]);
        });
        markActivePreset();
        updateSliderProgress();
        updateChecklistVisuals();
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
        if (id === "dca-frequency") {
            const radio = document.querySelector(`input[name="dca-frequency"][value="${value}"]`);
            if (radio) radio.checked = true;
            return;
        }
        const input = document.getElementById(id);
        if (input) input.value = value;
    });

    document.querySelectorAll("#checklist input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false;
    });

    markActivePreset();
    calculateDca();
    updateStorageScore();
    updateSliderProgress();
    updateChecklistVisuals();
}

function markActivePreset() {
    const current = readNumber("target-btc");
    document.querySelectorAll(".preset-btn").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.targetBtc) === current);
    });
}

function readNumber(id) {
    if (id === "dca-frequency") {
        const checked = document.querySelector('input[name="dca-frequency"]:checked');
        return checked ? Number(checked.value) : 12;
    }
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

function animateNumber(id, startValue, endValue, duration = 300, formatter = (v) => v.toString()) {
    const element = document.getElementById(id);
    if (!element) return;

    if (element.dataset.animFrame) {
        cancelAnimationFrame(Number(element.dataset.animFrame));
    }

    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeProgress = progress * (2 - progress); // Ease-out quad
        const currentValue = startValue + (endValue - startValue) * easeProgress;

        element.textContent = formatter(currentValue);

        if (progress < 1) {
            element.dataset.animFrame = requestAnimationFrame(update);
        } else {
            element.textContent = formatter(endValue);
            delete element.dataset.animFrame;
        }
    }

    element.dataset.animFrame = requestAnimationFrame(update);
}

function updateNumberWithAnimation(id, targetValue, formatter = (v) => v.toString()) {
    const element = document.getElementById(id);
    if (!element) return;

    const lastValue = parseFloat(element.dataset.lastValue) || 0;
    if (lastValue === targetValue) {
        element.textContent = formatter(targetValue);
        return;
    }

    element.dataset.lastValue = targetValue;
    animateNumber(id, lastValue, targetValue, 300, formatter);
}

function updateSegmentedIndicator() {
    const checkedRadio = document.querySelector('input[name="dca-frequency"]:checked');
    const label = checkedRadio ? document.querySelector(`label[for="${checkedRadio.id}"]`) : null;
    const indicator = document.getElementById("freq-indicator");
    if (!label || !indicator) return;

    indicator.style.width = `${label.offsetWidth}px`;
    indicator.style.left = `${label.offsetLeft}px`;
}

function setupSpotlightCards() {
    const cards = document.querySelectorAll(
        ".market-panel, .tool-panel, .results-panel, .checklist-panel, .score-panel, .summary-card, .chart-panel"
    );
    cards.forEach((card) => {
        if (!card.querySelector(".spotlight-bg")) {
            const bg = document.createElement("div");
            bg.className = "spotlight-bg";
            card.prepend(bg);
        }
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        });
    });
}

function updateSliderProgress() {
    const slider = document.getElementById("future-price");
    if (!slider) return;
    const min = Number(slider.min) || 0;
    const max = Number(slider.max) || 100;
    const val = Number(slider.value) || 0;
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.setProperty("--slider-progress", `${percent}%`);
}

function updateChecklistVisuals() {
    document.querySelectorAll("#checklist label.check-item").forEach((label) => {
        const checkbox = label.querySelector("input[type='checkbox']");
        if (checkbox) {
            label.classList.toggle("checked", checkbox.checked);
        }
    });
}
