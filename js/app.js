const state = {
    currentBtcPrice: null,
    blockHeight: null,
    blockHash: "",
    airGap: false,
    activeTab: "single",
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

const STORAGE_PRIORITIES_SINGLE = [
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

const STORAGE_PRIORITIES_PASSPHRASE = [
    "Understand that a BIP39 passphrase forms a completely separate wallet.",
    "Store passphrase physically separate from your 24-word seed phrase.",
    "Memorize or backup a strong, high-entropy passphrase offline.",
    "Perform a recovery test for the passphrase wallet.",
    "Provide clear guidance for heirs to find passphrase and seed separately.",
    "Review passphrase storage security annually."
];

const STORAGE_PRIORITIES_MULTISIG = [
    "Set up multi-signature keys on hardware wallets from different vendors.",
    "Distribute seed phrase backups across distinct geographic locations.",
    "Create multiple secure backups of your multisig config file (XPUBs).",
    "Execute a test spend from the multi-sig wallet.",
    "Ensure no single location stores more than 1 key's seed backup.",
    "Write recovery instructions for heirs regarding keys and config files."
];

// Active animation frames store
const activeAnimations = {};

document.addEventListener("DOMContentLoaded", () => {
    setupHeaderState();
    setupDcaPlanner();
    setupStorageChecklist();
    setupSummaryActions();
    setupMarketRefresh();
    setupAirGapToggle();
    setupChecklistTabs();
    setupInflationToggle();
    
    // Load local storage if it exists
    loadStateFromLocalStorage();
    
    // Fetch live market data
    fetchBitcoinSnapshot();

    // Handle chart redraws on window resize
    window.addEventListener("resize", () => {
        calculateDca();
    });
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
            input.addEventListener("input", () => {
                calculateDca();
                saveStateToLocalStorage();
            });
            input.addEventListener("change", () => {
                calculateDca();
                saveStateToLocalStorage();
            });
        }
    });

    calculateDca();
}

function setupStorageChecklist() {
    document.querySelectorAll(".checklist-panel input[type='checkbox']").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            updateStorageScore();
            saveStateToLocalStorage();
        });
    });

    updateStorageScore();
}

function setupSummaryActions() {
    const copyBtn = document.getElementById("copy-summary");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            const summary = buildSummaryText();

            try {
                await copyTextToClipboard(summary);
                flashButton("copy-summary", "Copied");
            } catch (err) {
                console.warn("Clipboard fallback failed", err);
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

    const resetBtn = document.getElementById("reset-summary");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to reset all planner inputs and checklist scores?")) {
                resetState();
            }
        });
    }
}

function setupMarketRefresh() {
    const refreshBtn = document.getElementById("refresh-market");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            if (state.airGap) {
                alert("Cannot refresh live data while Air-Gap / Privacy Mode is enabled.");
                return;
            }
            const icon = refreshBtn.querySelector(".refresh-icon");
            if (icon) icon.classList.add("spinning");
            refreshBtn.disabled = true;

            await fetchBitcoinSnapshot();

            setTimeout(() => {
                if (icon) icon.classList.remove("spinning");
                refreshBtn.disabled = false;
            }, 800);
        });
    }
}

function setupAirGapToggle() {
    const toggle = document.getElementById("air-gap-toggle");
    if (toggle) {
        toggle.addEventListener("change", (e) => {
            state.airGap = e.target.checked;
            saveStateToLocalStorage();
            
            if (state.airGap) {
                setMarketOfflineState();
            } else {
                fetchBitcoinSnapshot();
            }
        });
    }
}

function setupInflationToggle() {
    const toggle = document.getElementById("inflation-toggle");
    if (toggle) {
        toggle.addEventListener("change", () => {
            calculateDca();
            saveStateToLocalStorage();
        });
    }
}

function setupChecklistTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const tabName = btn.dataset.tab;
            state.activeTab = tabName;
            
            // Toggle panels
            document.querySelectorAll(".checklist-panel").forEach(p => {
                p.classList.remove("active");
                p.style.display = "none";
            });
            
            const targetPanel = document.getElementById("checklist-" + tabName);
            if (targetPanel) {
                targetPanel.classList.add("active");
                targetPanel.style.display = "grid";
            }
            
            updateStorageScore();
            saveStateToLocalStorage();
        });
    });
}

function setMarketOfflineState() {
    const priceEl = document.getElementById("btc-price");
    const blockEl = document.getElementById("btc-block");
    const halvingEl = document.getElementById("btc-halving");
    const hashEl = document.getElementById("btc-hash");
    const statusEl = document.getElementById("market-status");
    const statusDot = document.getElementById("status-dot");
    
    if (priceEl) priceEl.textContent = "Offline";
    if (blockEl) blockEl.textContent = "Offline";
    if (halvingEl) halvingEl.textContent = "Offline";
    if (hashEl) hashEl.textContent = "Air-Gapped";
    
    if (statusDot) {
        statusDot.className = "status-dot"; // remove pulsing, turn gray
    }
    
    if (statusEl) {
        statusEl.textContent = "Air-Gap mode enabled. Public APIs disconnected for maximum privacy.";
    }
}

async function fetchBitcoinSnapshot() {
    if (state.airGap) {
        setMarketOfflineState();
        return;
    }

    const priceEl = document.getElementById("btc-price");
    const blockEl = document.getElementById("btc-block");
    const halvingEl = document.getElementById("btc-halving");
    const hashEl = document.getElementById("btc-hash");
    const statusEl = document.getElementById("market-status");
    const statusDot = document.getElementById("status-dot");

    let priceSuccess = false;
    let blockSuccess = false;

    try {
        const price = await fetchPrice();
        state.currentBtcPrice = price;
        if (priceEl) priceEl.textContent = formatCurrency(price);
        priceSuccess = true;

        const avgPrice = document.getElementById("avg-price");
        if (avgPrice && Number(avgPrice.value) === 100000) {
            avgPrice.value = Math.round(price);
            calculateDca();
        }
    } catch (err) {
        console.warn("Price fetch failed", err);
        if (priceEl) priceEl.textContent = "Unavailable";
    }

    try {
        const [height, hash] = await Promise.all([fetchBlockHeight(), fetchBlockHash()]);
        state.blockHeight = height;
        state.blockHash = hash;
        if (blockEl) blockEl.textContent = `#${height.toLocaleString("en-US")}`;
        if (hashEl) hashEl.textContent = shortenHash(hash);
        blockSuccess = true;
        
        // Calculate next halving countdown details
        updateHalvingCountdown(height);
    } catch (err) {
        console.warn("Block data fetch failed", err);
        if (blockEl) blockEl.textContent = "Unavailable";
        if (hashEl) hashEl.textContent = "Unavailable";
        if (halvingEl) halvingEl.textContent = "Unavailable";
    }

    if (statusDot) {
        if (priceSuccess && blockSuccess) {
            statusDot.className = "status-dot pulsing";
        } else {
            statusDot.className = "status-dot error";
        }
    }

    if (statusEl) {
        statusEl.textContent = state.currentBtcPrice
            ? "Live data loaded from public Bitcoin APIs."
            : "Live data unavailable. Planner still works with your manual assumptions.";
    }
}

function updateHalvingCountdown(currentBlock) {
    const halvingEl = document.getElementById("btc-halving");
    if (!halvingEl) return;
    
    // Halvings occur every 210,000 blocks
    const nextHalvingBlock = Math.ceil(currentBlock / 210000) * 210000;
    const blocksRemaining = nextHalvingBlock - currentBlock;
    
    // 10 minutes average per block
    const minutesRemaining = blocksRemaining * 10;
    const daysRemaining = Math.floor(minutesRemaining / (24 * 60));
    
    const years = Math.floor(daysRemaining / 365);
    const months = Math.floor((daysRemaining % 365) / 30);
    const days = daysRemaining % 30;
    
    let timeStr = "";
    if (years > 0) timeStr += `${years}y `;
    if (months > 0) timeStr += `${months}m `;
    timeStr += `${days}d`;
    
    halvingEl.textContent = `${timeStr} (${blocksRemaining.toLocaleString()} blks)`;
    halvingEl.title = `Estimated countdown to block #${nextHalvingBlock.toLocaleString()}`;
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
    
    // Inflation parameters
    const inflationToggle = document.getElementById("inflation-toggle");
    const isInflationAdjusted = inflationToggle ? inflationToggle.checked : false;
    const inflationRate = 0.025; // 2.5% inflation rate
    const inflationMultiplier = isInflationAdjusted ? Math.pow(1 + inflationRate, -years) : 1;

    const buys = Math.max(0, frequency * years);
    let recurringInvested = amount * buys;
    const purchasedBtc = avgPrice > 0 ? recurringInvested / avgPrice : 0;
    const projectedBtc = startingBtc + purchasedBtc;
    const startingCostBasis = startingBtc * avgPrice;
    const totalCostBasis = startingCostBasis + recurringInvested;
    
    // Apply inflation multipliers to projected values
    let futureValue = (projectedBtc * futurePrice) * inflationMultiplier;
    let estimatedReturn = futureValue - (totalCostBasis * inflationMultiplier);
    
    // Cost basis shown also adjusts under inflation toggle to represent real contributions purchasing power
    let nominalInvested = recurringInvested * (isInflationAdjusted ? inflationMultiplier : 1);
    const progress = targetBtc > 0 ? Math.min(100, (projectedBtc / targetBtc) * 100) : 0;

    const futurePriceLabel = document.getElementById("future-price-label");
    if (futurePriceLabel) {
        futurePriceLabel.textContent = formatCurrency(futurePrice, 0);
    }

    // Smooth value counters
    const prev = state.prevValues;
    animateValue("projected-btc", prev["projected-btc"], projectedBtc, 450, (v) => `${formatBtc(v)} BTC`);
    animateValue("total-invested", prev["total-invested"], nominalInvested, 450, (v) => formatCurrency(v, 0));
    animateValue("future-value", prev["future-value"], futureValue, 450, (v) => formatCurrency(v, 0));
    animateValue("estimated-return", prev["estimated-return"], estimatedReturn, 450, (v) => formatSignedCurrency(v));

    prev["projected-btc"] = projectedBtc;
    prev["total-invested"] = nominalInvested;
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

    updateScenario("50", projectedBtc, totalCostBasis, 50000, inflationMultiplier);
    updateScenario("100", projectedBtc, totalCostBasis, 100000, inflationMultiplier);
    updateScenario("250", projectedBtc, totalCostBasis, 250000, inflationMultiplier);
    updateScenario("1000", projectedBtc, totalCostBasis, 1000000, inflationMultiplier);
    
    // Draw SVG Projection Graph
    updateChart({
        amount,
        frequency,
        years,
        avgPrice,
        startingBtc,
        futurePrice,
        isInflationAdjusted,
        inflationRate
    });

    updateSummary();
}

function updateScenario(id, btc, costBasis, price, inflationMultiplier) {
    const value = (btc * price) * inflationMultiplier;
    const cost = costBasis * inflationMultiplier;
    const multiple = cost > 0 ? value / cost : 0;
    
    const key = `scenario-${id}`;
    const prevVal = state.prevValues[key] || 0;
    state.prevValues[key] = value;

    animateValue(key, prevVal, value, 450, (v) => formatCurrency(v, 0));

    const multEl = document.getElementById(`multiple-${id}`);
    if (multEl) {
        multEl.textContent = `${multiple.toFixed(1)}x`;
    }
}

function updateChart({ amount, frequency, years, avgPrice, startingBtc, futurePrice, isInflationAdjusted, inflationRate }) {
    const chart = document.getElementById("projection-chart");
    const gridG = document.getElementById("chart-grid");
    const labelsG = document.getElementById("chart-labels-x");
    const pathBasis = document.getElementById("chart-line-basis");
    const pathValue = document.getElementById("chart-line-value");
    const areaBasis = document.getElementById("chart-area-basis");
    const areaValue = document.getElementById("chart-area-value");
    
    if (!chart || !pathBasis || !pathValue || !areaBasis || !areaValue || !gridG || !labelsG) return;
    
    // Dynamically calculate width of container to avoid stretch distortion (pixelation)
    const rect = chart.getBoundingClientRect();
    const containerWidth = rect.width || 600;
    chart.setAttribute("viewBox", `0 0 ${containerWidth} 220`);
    
    // Set parameters
    const steps = 10;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 35;
    const w = containerWidth - paddingLeft - paddingRight;
    const h = 220 - paddingTop - paddingBottom;
    const bottomY = 220 - paddingBottom;
    
    let basisPoints = [];
    let valuePoints = [];
    
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * years;
        const buys = frequency * t;
        let cost = (startingBtc * avgPrice) + (amount * buys);
        const btcAccumulated = startingBtc + (avgPrice > 0 ? (amount * buys) / avgPrice : 0);
        let val = btcAccumulated * futurePrice;
        
        // Apply inflation if toggle active
        if (isInflationAdjusted) {
            const mult = Math.pow(1 + inflationRate, -t);
            cost *= mult;
            val *= mult;
        }
        
        basisPoints.push(cost);
        valuePoints.push(val);
    }
    
    const maxVal = Math.max(...basisPoints, ...valuePoints, 100);
    
    // Compute SVG point strings
    const basisSvgPoints = basisPoints.map((val, idx) => {
        const x = paddingLeft + (idx / steps) * w;
        const y = bottomY - (val / maxVal) * h;
        return { x, y };
    });
    
    const valueSvgPoints = valuePoints.map((val, idx) => {
        const x = paddingLeft + (idx / steps) * w;
        const y = bottomY - (val / maxVal) * h;
        return { x, y };
    });
    
    const basisPathStr = basisSvgPoints.map((pt, idx) => (idx === 0 ? "M" : "L") + ` ${pt.x} ${pt.y}`).join(" ");
    const valuePathStr = valueSvgPoints.map((pt, idx) => (idx === 0 ? "M" : "L") + ` ${pt.x} ${pt.y}`).join(" ");
    
    const basisAreaStr = basisPathStr + ` L ${basisSvgPoints[steps].x} ${bottomY} L ${basisSvgPoints[0].x} ${bottomY} Z`;
    const valueAreaStr = valuePathStr + ` L ${valueSvgPoints[steps].x} ${bottomY} L ${valueSvgPoints[0].x} ${bottomY} Z`;
    
    pathBasis.setAttribute("d", basisPathStr);
    pathValue.setAttribute("d", valuePathStr);
    areaBasis.setAttribute("d", basisAreaStr);
    areaValue.setAttribute("d", valueAreaStr);
    
    // Clear and redraw grid lines and labels
    gridG.innerHTML = "";
    labelsG.innerHTML = "";
    
    // Horizontal grid lines
    const divisions = 4;
    for (let i = 1; i <= divisions; i++) {
        const pct = i / divisions;
        const y = bottomY - pct * h;
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", paddingLeft);
        line.setAttribute("y1", y);
        line.setAttribute("x2", containerWidth - paddingRight);
        line.setAttribute("y2", y);
        line.setAttribute("stroke-dasharray", "4 4");
        gridG.appendChild(line);
        
        // Y Label
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", paddingLeft - 10);
        txt.setAttribute("y", y + 3.5);
        txt.setAttribute("class", "chart-label");
        txt.setAttribute("text-anchor", "end");
        txt.textContent = formatCompactCurrency(pct * maxVal);
        gridG.appendChild(txt);
    }
    
    // Baseline axis line
    const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axis.setAttribute("x1", paddingLeft);
    axis.setAttribute("y1", bottomY);
    axis.setAttribute("x2", containerWidth - paddingRight);
    axis.setAttribute("y2", bottomY);
    axis.setAttribute("stroke", "rgba(255,255,255,0.08)");
    gridG.appendChild(axis);
    
    // X ticks & labels (Start, Middle, End)
    const ticks = [0, 0.5, 1.0];
    ticks.forEach(f => {
        const x = paddingLeft + f * w;
        
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", x);
        tick.setAttribute("y1", bottomY);
        tick.setAttribute("x2", x);
        tick.setAttribute("y2", bottomY + 5);
        tick.setAttribute("stroke", "rgba(255,255,255,0.08)");
        gridG.appendChild(tick);
        
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x);
        label.setAttribute("y", bottomY + 20);
        label.setAttribute("class", "chart-label");
        label.setAttribute("text-anchor", "middle");
        label.textContent = f === 0 ? "START" : f === 0.5 ? `${(years / 2).toFixed(1)} YR` : `${years.toFixed(0)} YR`;
        labelsG.appendChild(label);
    });
}

function formatCompactCurrency(value) {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${Math.round(value)}`;
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
    // Score based on active checklist tab only
    const activePanel = document.getElementById("checklist-" + state.activeTab);
    if (!activePanel) return;

    const checkboxes = Array.from(activePanel.querySelectorAll("input[type='checkbox']"));
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
            priorityItems.innerHTML = "<li>Schedule the next annual custody review.</li><li>Keep instructions updated when setups or locations change.</li>";
        } else {
            // Fetch priorities list based on active tab
            const prioritiesList = state.activeTab === "passphrase" 
                ? STORAGE_PRIORITIES_PASSPHRASE 
                : state.activeTab === "multisig" 
                    ? STORAGE_PRIORITIES_MULTISIG 
                    : STORAGE_PRIORITIES_SINGLE;

            priorityItems.innerHTML = missing
                .map(({ index }) => `<li>${prioritiesList[index]}</li>`)
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

    const buys = frequency * years;
    const recurringInvested = amount * buys;
    const projectedBtc = startingBtc + (avgPrice > 0 ? recurringInvested / avgPrice : 0);
    
    const inflationToggle = document.getElementById("inflation-toggle");
    const isInflationAdjusted = inflationToggle ? inflationToggle.checked : false;
    const inflationMultiplier = isInflationAdjusted ? Math.pow(1.025, -years) : 1;
    
    const futureValue = projectedBtc * futurePrice * inflationMultiplier;
    
    const tabLabel = state.activeTab === "passphrase" 
        ? "BIP39 Passphrase" 
        : state.activeTab === "multisig" 
            ? "Multi-Sig" 
            : "Single-Sig";

    return `DCA plan: ${formatCurrency(amount, 0)} ${frequencyLabel.toLowerCase()} for ${years} years, assuming an average buy price of ${formatCurrency(avgPrice, 0)}. Projected stack: ${formatBtc(projectedBtc)} BTC, worth ${formatCurrency(futureValue, 0)}${isInflationAdjusted ? " (inflation-adjusted)" : ""} at ${formatCurrency(futurePrice, 0)} per BTC. Target: ${formatBtc(targetBtc)} BTC. Cold storage score (${tabLabel}): ${storageScore}/100.`;
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

// Local Storage auto-saving states
function saveStateToLocalStorage() {
    try {
        const inputs = {};
        DCA_INPUT_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) inputs[id] = el.value;
        });

        // Store checked boxes for each tab panel
        const checks = {
            single: [],
            passphrase: [],
            multisig: []
        };

        document.querySelectorAll("#checklist-single input[type='checkbox']").forEach(cb => checks.single.push(cb.checked));
        document.querySelectorAll("#checklist-passphrase input[type='checkbox']").forEach(cb => checks.passphrase.push(cb.checked));
        document.querySelectorAll("#checklist-multisig input[type='checkbox']").forEach(cb => checks.multisig.push(cb.checked));

        const inflationToggle = document.getElementById("inflation-toggle");
        
        const localData = {
            inputs,
            checks,
            activeTab: state.activeTab,
            airGap: state.airGap,
            inflation: inflationToggle ? inflationToggle.checked : false
        };

        localStorage.setItem("btc_wedding_local_state", JSON.stringify(localData));
    } catch (err) {
        console.warn("Failed to save state to localStorage", err);
    }
}

function loadStateFromLocalStorage() {
    try {
        const dataStr = localStorage.getItem("btc_wedding_local_state");
        if (!dataStr) return;
        const data = JSON.parse(dataStr);

        // Load inputs
        if (data.inputs) {
            for (const id in data.inputs) {
                const el = document.getElementById(id);
                if (el) el.value = data.inputs[id];
            }
        }

        // Load checklists checked states
        if (data.checks) {
            if (data.checks.single) {
                document.querySelectorAll("#checklist-single input[type='checkbox']").forEach((cb, idx) => {
                    if (data.checks.single[idx] !== undefined) cb.checked = data.checks.single[idx];
                });
            }
            if (data.checks.passphrase) {
                document.querySelectorAll("#checklist-passphrase input[type='checkbox']").forEach((cb, idx) => {
                    if (data.checks.passphrase[idx] !== undefined) cb.checked = data.checks.passphrase[idx];
                });
            }
            if (data.checks.multisig) {
                document.querySelectorAll("#checklist-multisig input[type='checkbox']").forEach((cb, idx) => {
                    if (data.checks.multisig[idx] !== undefined) cb.checked = data.checks.multisig[idx];
                });
            }
        }

        // Load active Tab
        if (data.activeTab) {
            state.activeTab = data.activeTab;
            
            // Set active button
            const activeBtn = document.querySelector(`.tab-btn[data-tab="${data.activeTab}"]`);
            if (activeBtn) {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                activeBtn.classList.add("active");
            }

            // Set active panel
            document.querySelectorAll(".checklist-panel").forEach(p => {
                p.classList.remove("active");
                p.style.display = "none";
            });
            const activePanel = document.getElementById("checklist-" + data.activeTab);
            if (activePanel) {
                activePanel.classList.add("active");
                activePanel.style.display = "grid";
            }
        }

        // Load Air-Gap state
        if (data.airGap !== undefined) {
            state.airGap = data.airGap;
            const toggle = document.getElementById("air-gap-toggle");
            if (toggle) toggle.checked = data.airGap;
        }

        // Load Inflation state
        if (data.inflation !== undefined) {
            const toggle = document.getElementById("inflation-toggle");
            if (toggle) toggle.checked = data.inflation;
        }

        // Recalculate
        calculateDca();
        updateStorageScore();
    } catch (err) {
        console.warn("Failed to load state from localStorage", err);
    }
}

function resetState() {
    try {
        localStorage.removeItem("btc_wedding_local_state");
        
        // Reset inputs to defaults
        document.getElementById("dca-amount").value = 100;
        document.getElementById("dca-frequency").value = 12;
        document.getElementById("dca-years").value = 5;
        document.getElementById("starting-btc").value = 0;
        document.getElementById("target-btc").value = 1;
        document.getElementById("future-price").value = 250000;
        
        if (state.currentBtcPrice) {
            document.getElementById("avg-price").value = Math.round(state.currentBtcPrice);
        } else {
            document.getElementById("avg-price").value = 100000;
        }

        // Uncheck all checkboxes
        document.querySelectorAll(".checklist-panel input[type='checkbox']").forEach(cb => {
            cb.checked = false;
        });

        // Reset toggles
        const airGapToggle = document.getElementById("air-gap-toggle");
        if (airGapToggle) airGapToggle.checked = false;
        state.airGap = false;

        const inflationToggle = document.getElementById("inflation-toggle");
        if (inflationToggle) inflationToggle.checked = false;

        // Reset tab
        state.activeTab = "single";
        const firstTabBtn = document.querySelector('.tab-btn[data-tab="single"]');
        if (firstTabBtn) {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            firstTabBtn.classList.add("active");
        }
        document.querySelectorAll(".checklist-panel").forEach(p => {
            p.classList.remove("active");
            p.style.display = "none";
        });
        const defaultPanel = document.getElementById("checklist-single");
        if (defaultPanel) {
            defaultPanel.classList.add("active");
            defaultPanel.style.display = "grid";
        }

        // Recalculate and fetch
        calculateDca();
        updateStorageScore();
        fetchBitcoinSnapshot();
    } catch (err) {
        console.warn("Failed to reset tool state", err);
    }
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            const successful = document.execCommand("copy");
            document.body.removeChild(textarea);
            if (successful) return Promise.resolve();
            return Promise.reject(new Error("document.execCommand('copy') returned false"));
        } catch (err) {
            document.body.removeChild(textarea);
            return Promise.reject(err);
        }
    }
}
