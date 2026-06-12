const STORAGE_KEY = "btc_wedding_prenup_v3";
const LEGACY_CACHE_PREFIX = "btc-wedding-";

const FIELD_IDS = [
    "buy-amount",
    "buy-frequency",
    "no-panic",
    "no-leverage",
    "cold-storage",
    "no-shitcoins",
    "partner-a-name",
    "partner-b-name",
    "ceremony-date",
    "ceremony-place",
    "custom-vow",
    "witness-name",
    "enable-witness"
];

// Canvas storage & sealed state
const canvasState = {};
let isSealed = false;
let savedBlockHeight = "";
let confettiSystem = null;

document.addEventListener("DOMContentLoaded", () => {
    clearLegacyServiceWorkerCache();

    // Initialize Confetti
    const confettiCanvas = document.getElementById("confetti-canvas");
    if (confettiCanvas) {
        confettiSystem = new ConfettiSystem(confettiCanvas);
    }

    // Restore state first
    restoreState();

    // Bind inputs, toggles, signatures, actions, faq
    bindSetupTypeToggles();
    bindInputs();
    bindSignatures();
    bindActions();
    bindFAQ();

    // Initial render & setups
    initHeroTilt();
    updateWitnessVisibility();
    updatePrenup();
    updateCardClasses();
    renderBlockHeight();

    // Interactive detail setups
    initScrollspy();
    initScrollReveal();
    initBackgroundParallax();

    // Bind mouse gold dust trail
    window.addEventListener("mousemove", (e) => {
        if (confettiSystem) {
            confettiSystem.spawnSparkle(e.clientX, e.clientY);
        }
    });
    window.addEventListener("touchmove", (e) => {
        if (confettiSystem && e.touches.length > 0) {
            confettiSystem.spawnSparkle(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
});

function clearLegacyServiceWorkerCache() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => {
                registrations.forEach((registration) => registration.unregister());
            })
            .catch((error) => {
                console.warn("Unable to unregister legacy service worker", error);
            });
    }

    if ("caches" in window) {
        caches.keys()
            .then((keys) => {
                keys
                    .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX))
                    .forEach((key) => caches.delete(key));
            })
            .catch((error) => {
                console.warn("Unable to clear legacy cache storage", error);
            });
    }
}

// Setup Joint/Solo Radio Toggles
function bindSetupTypeToggles() {
    const btnSolo = document.getElementById("btn-solo");
    const btnJoint = document.getElementById("btn-joint");
    const inputSolo = btnSolo.querySelector("input");
    const inputJoint = btnJoint.querySelector("input");

    btnSolo.addEventListener("click", () => {
        if (isSealed) return; // Prevent changing layout when sealed
        inputSolo.checked = true;
        setSetupType("solo");
    });

    btnJoint.addEventListener("click", () => {
        if (isSealed) return; // Prevent changing layout when sealed
        inputJoint.checked = true;
        setSetupType("joint");
    });
}

function setSetupType(type) {
    const btnSolo = document.getElementById("btn-solo");
    const btnJoint = document.getElementById("btn-joint");
    const wrapperB = document.getElementById("partner-b-wrapper");
    const sigBoxB = document.getElementById("sig-box-b");
    const nameInputs = document.querySelector(".name-inputs");

    if (type === "solo") {
        btnSolo.classList.add("active");
        btnJoint.classList.remove("active");
        wrapperB.classList.add("hidden");
        sigBoxB.classList.add("hidden");
        nameInputs.classList.remove("two-cols");
    } else {
        btnSolo.classList.remove("active");
        btnJoint.classList.add("active");
        wrapperB.classList.remove("hidden");
        sigBoxB.classList.remove("hidden");
        nameInputs.classList.add("two-cols");
    }

    updateWitnessVisibility();
    handleChange();
}

function getSetupType() {
    const btnJoint = document.getElementById("btn-joint");
    return btnJoint && btnJoint.classList.contains("active") ? "joint" : "solo";
}

function bindInputs() {
    // Normal fields
    FIELD_IDS.forEach((id) => {
        const field = document.getElementById(id);
        if (!field) return;

        const eventName = (field.tagName === "SELECT" || field.type === "checkbox") ? "change" : "input";
        field.addEventListener(eventName, handleChange);
    });

    // Checkbox cards
    const checkboxes = ["no-panic", "no-leverage", "cold-storage", "no-shitcoins"];
    checkboxes.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", () => {
            const card = el.closest(".vow-card");
            if (card) {
                card.classList.toggle("card-active", el.checked);
            }
            handleChange();
        });
    });

    // Witness toggle specific action
    const enableWitnessCheckbox = document.getElementById("enable-witness");
    if (enableWitnessCheckbox) {
        enableWitnessCheckbox.addEventListener("change", () => {
            updateWitnessVisibility();
        });
    }
}

function updateCardClasses() {
    const checkboxes = ["no-panic", "no-leverage", "cold-storage", "no-shitcoins"];
    checkboxes.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const card = el.closest(".vow-card");
        if (card) {
            card.classList.toggle("card-active", el.checked);
        }
    });
}

function handleChange() {
    saveState();
    updatePrenup();
}


function updateWitnessVisibility() {
    const enableWitness = document.getElementById("enable-witness")?.checked;
    const witnessNameWrapper = document.getElementById("witness-name-wrapper");
    const sigBoxWitness = document.getElementById("sig-box-witness");
    const sigSection = document.getElementById("cert-signatures-section");

    if (enableWitness) {
        witnessNameWrapper?.classList.remove("hidden");
        sigBoxWitness?.classList.remove("hidden");
    } else {
        witnessNameWrapper?.classList.add("hidden");
        sigBoxWitness?.classList.add("hidden");
    }

    const isJoint = getSetupType() === "joint";
    let activeSigs = 1;
    if (isJoint) activeSigs++;
    if (enableWitness) activeSigs++;

    if (sigSection) {
        if (activeSigs >= 3) {
            sigSection.classList.remove("two-cols");
            sigSection.classList.add("three-cols");
        } else if (activeSigs === 2) {
            sigSection.classList.remove("three-cols");
            sigSection.classList.add("two-cols");
        } else {
            sigSection.classList.remove("three-cols");
            sigSection.classList.remove("two-cols");
        }
    }
}

function bindFAQ() {
    const faqQuestions = document.querySelectorAll(".faq-question");
    faqQuestions.forEach(btn => {
        btn.addEventListener("click", () => {
            const item = btn.closest(".faq-item");
            const isOpen = btn.getAttribute("aria-expanded") === "true";

            document.querySelectorAll(".faq-item").forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
                    otherItem.querySelector(".faq-answer").style.maxHeight = null;
                }
            });

            if (isOpen) {
                btn.setAttribute("aria-expanded", "false");
                item.querySelector(".faq-answer").style.maxHeight = null;
            } else {
                btn.setAttribute("aria-expanded", "true");
                const answer = item.querySelector(".faq-answer");
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });
}

function initHeroTilt() {
    const wrapper = document.querySelector(".hero-document-wrapper");
    const card = document.querySelector(".hero-document");
    if (!wrapper || !card) return;

    wrapper.addEventListener("mousemove", (e) => {
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((centerY - y) / centerY) * 12;
        const rotateY = ((x - centerX) / centerX) * 12;

        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04)`;
    });

    wrapper.addEventListener("mouseleave", () => {
        card.style.transform = "";
    });
}

// -------------------------------------------------------------
// Signature Pad Canvas Engine
// -------------------------------------------------------------
function bindSignatures() {
    setupSignaturePad("sig-canvas-a", "clear-sig-a");
    setupSignaturePad("sig-canvas-b", "clear-sig-b");
    setupSignaturePad("sig-canvas-witness", "clear-sig-witness");
}

function setupSignaturePad(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Set line styles for ink pen look
    ctx.strokeStyle = "#121824"; // deep midnight ink
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let isDrawing = false;
    let points = [];
    let lastTime = Date.now();

    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Project coordinate scaling
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        return { x, y };
    }

    function startDrawing(e) {
        if (isSealed) return; // Prevent drawing if sealed
        isDrawing = true;
        const coords = getCoordinates(e);
        points = [coords];
        lastTime = Date.now();
        ctx.lineWidth = 2.2;

        // Draw a tiny starting dot
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        if (isSealed) return;
        e.preventDefault(); // Stop screen dragging/scrolling on mobile

        const coords = getCoordinates(e);
        const p1 = points[points.length - 1];
        points.push(coords);

        const dx = coords.x - p1.x;
        const dy = coords.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const now = Date.now();
        const dt = now - lastTime || 1;
        lastTime = now;
        const velocity = dist / dt;

        // Calligraphy dynamics: draw slower = thicker, faster = thinner
        const targetWidth = Math.max(1.1, Math.min(3.2, 4.2 - velocity * 1.6));
        ctx.lineWidth = ctx.lineWidth * 0.6 + targetWidth * 0.4;

        if (points.length === 2) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
        } else if (points.length > 2) {
            const p0 = points[points.length - 3];
            const p1_pt = points[points.length - 2];
            const p2 = points[points.length - 1];

            const mid1 = { x: (p0.x + p1_pt.x) / 2, y: (p0.y + p1_pt.y) / 2 };
            const mid2 = { x: (p1_pt.x + p2.x) / 2, y: (p1_pt.y + p2.y) / 2 };

            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p1_pt.x, p1_pt.y, mid2.x, mid2.y);
            ctx.stroke();
        }
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            canvasState[canvasId] = canvas.toDataURL();
            saveState();
        }
    }

    // Mouse listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    // Touch listeners
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);

    // Clear listener
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            delete canvasState[canvasId];
            saveState();
        });
    }
}

// -------------------------------------------------------------
// Document Generation and Rendering
// -------------------------------------------------------------
function updatePrenup() {
    const list = document.getElementById("prenup-output-list");
    const dateDisp = document.getElementById("cert-date-display");
    const placeDisp = document.getElementById("cert-place-display");
    const introText = document.getElementById("cert-intro-text");
    const sigNameA = document.getElementById("sig-name-display-a");
    const sigNameB = document.getElementById("sig-name-display-b");
    const sigNameWitness = document.getElementById("sig-name-display-witness");

    if (!list) return;

    const values = readValues();
    const isJoint = getSetupType() === "joint";

    const ceremonyDate = formatCeremonyDate(values.ceremonyDate);
    const ceremonyPlace = values.ceremonyPlace.trim() || "Cyberspace Chapel";
    dateDisp.textContent = ceremonyDate;
    if (placeDisp) placeDisp.textContent = ceremonyPlace;

    // Intro Text
    const nameA = values.partnerAName.trim() || "Satoshi";
    const nameB = values.partnerBName.trim() || "Hal Finney";
    const witnessName = values.witnessName.trim() || "Nick Szabo";

    if (isJoint) {
        introText.innerHTML = `<strong>${escapeHtml(nameA)}</strong> and <strong>${escapeHtml(nameB)}</strong> mark this day at <strong>${escapeHtml(ceremonyPlace)}</strong> with these Bitcoin vows:`;
        sigNameA.textContent = nameA;
        sigNameB.textContent = nameB;
    } else {
        introText.innerHTML = `<strong>${escapeHtml(nameA)}</strong> marks this day at <strong>${escapeHtml(ceremonyPlace)}</strong> with these Bitcoin vows:`;
        sigNameA.textContent = nameA;
    }

    if (sigNameWitness) {
        sigNameWitness.textContent = witnessName;
    }

    // Form Vow Bullet Points
    const rules = [];

    // Accumulation Vow
    rules.push(`Promise to stack <strong>${formatCurrency(values.buyAmount)}</strong> of Bitcoin <strong>${values.buyFrequency}</strong> with patience and care.`);

    // Panic Sell Vow
    if (values.noPanic) {
        rules.push("Hold firm through volatility and <strong>never panic sell</strong> under market pressure.");
    }

    // Leverage Vow
    if (values.noLeverage) {
        rules.push("Reject derivative trading and <strong>never use leverage</strong> against shared peace of mind.");
    }

    // Custody Vow
    if (values.coldStorage) {
        rules.push("Keep private keys offline in <strong>secure cold storage</strong>, away from temptation and hurry.");
    }

    // Bitcoin Only Vow
    if (values.noShitcoins) {
        rules.push("Stay faithful to Bitcoin and <strong>ignore altcoin noise</strong>.");
    }

    // Custom Vow
    if (values.customVow && values.customVow.trim() !== "") {
        rules.push(escapeHtml(values.customVow.trim()));
    }

    // Render list
    list.innerHTML = rules.map(rule => `<li>${rule}</li>`).join("");
}

function readValues() {
    return {
        buyAmount: readNumber("buy-amount"),
        buyFrequency: readSelect("buy-frequency"),
        noPanic: readChecked("no-panic"),
        noLeverage: readChecked("no-leverage"),
        coldStorage: readChecked("cold-storage"),
        noShitcoins: readChecked("no-shitcoins"),
        partnerAName: readText("partner-a-name"),
        partnerBName: readText("partner-b-name"),
        ceremonyDate: readText("ceremony-date"),
        ceremonyPlace: readText("ceremony-place"),
        customVow: readText("custom-vow"),
        witnessName: readText("witness-name"),
        enableWitness: readChecked("enable-witness")
    };
}

function readNumber(id) {
    const value = Number(document.getElementById(id)?.value || 0);
    return Number.isFinite(value) ? value : 0;
}

function readSelect(id) {
    return document.getElementById(id)?.value || "";
}

function readChecked(id) {
    return Boolean(document.getElementById(id)?.checked);
}

function readText(id) {
    return document.getElementById(id)?.value || "";
}

// -------------------------------------------------------------
// Timechain Block Height fetching
// -------------------------------------------------------------
async function fetchBlockHeight() {
    const el = document.getElementById("cert-block-height");
    if (!el) return;

    el.textContent = "Connecting to Timechain...";

    try {
        const response = await fetch("https://mempool.space/api/blocks/tip/height");
        if (response.ok) {
            const height = await response.text();
            savedBlockHeight = height.trim();
            renderBlockHeight();
        } else {
            throw new Error("HTTP error status");
        }
    } catch (e) {
        console.warn("Could not retrieve block height, estimating...", e);
        // Estimate based on standard block intervals
        const genesisTimestamp = 1231006505000;
        const elapsedMinutes = (Date.now() - genesisTimestamp) / 60000;
        const estHeight = Math.floor(elapsedMinutes / 10.02);
        savedBlockHeight = `${estHeight} (Est.)`;
        renderBlockHeight();
    }
}

function renderBlockHeight() {
    const el = document.getElementById("cert-block-height");
    if (!el) return;

    if (isSealed && savedBlockHeight) {
        el.innerHTML = `Block <strong>#${savedBlockHeight}</strong>`;
    } else {
        el.textContent = "Unsealed";
    }
}

// -------------------------------------------------------------
// Buttons & UI Actions
// -------------------------------------------------------------
function bindActions() {
    document.getElementById("btn-seal")?.addEventListener("click", toggleSeal);
    document.getElementById("copy-prenup")?.addEventListener("click", copyContractText);
    document.getElementById("print-prenup")?.addEventListener("click", () => window.print());
    document.getElementById("reset-prenup")?.addEventListener("click", resetState);
}

async function toggleSeal() {
    const docSheet = document.querySelector(".document-sheet");
    const waxSeal = document.getElementById("cert-wax-seal");
    const sealBtn = document.getElementById("btn-seal");
    const btnText = sealBtn?.querySelector(".btn-text");

    if (!isSealed) {
        // Start melting wax loader
        sealBtn.classList.add("loading-wax");
        if (btnText) btnText.textContent = "Melting Wax...";

        await new Promise(r => setTimeout(r, 900)); // wait for wax melting

        sealBtn.classList.remove("loading-wax");
        isSealed = true;

        // Fetch block height at the moment of sealing
        await fetchBlockHeight();

        // Lock Document & trigger animations
        docSheet?.classList.add("sealed-lock");

        // Add vibration feedback impact shake
        docSheet?.classList.remove("shake-effect");
        void docSheet?.offsetWidth; // Trigger reflow to restart animation
        docSheet?.classList.add("shake-effect");

        waxSeal?.classList.add("sealed");

        // Trigger ripple shockwave
        const ripple = document.getElementById("stamp-ripple");
        if (ripple) {
            ripple.classList.remove("active");
            void ripple.offsetWidth;
            ripple.classList.add("active");
        }

        if (btnText) btnText.textContent = "Unlock Vows";
        sealBtn?.classList.remove("glow-effect");
        sealBtn?.classList.add("secondary");

        // Trigger Confetti
        if (confettiSystem) {
            confettiSystem.spawn();
        }
    } else {
        // Unlock Document
        isSealed = false;
        docSheet?.classList.remove("sealed-lock");
        docSheet?.classList.remove("shake-effect");
        waxSeal?.classList.remove("sealed");

        const ripple = document.getElementById("stamp-ripple");
        ripple?.classList.remove("active");

        savedBlockHeight = "";
        renderBlockHeight();

        if (btnText) btnText.textContent = "Sign & Seal Vows";
        sealBtn?.classList.add("glow-effect");
        sealBtn?.classList.remove("secondary");
    }

    saveState();
}

async function copyContractText() {
    const values = readValues();
    const isJoint = getSetupType() === "joint";
    const nameA = values.partnerAName.trim() || "Satoshi";
    const nameB = values.partnerBName.trim() || "Hal Finney";
    const ceremonyDate = formatCeremonyDate(values.ceremonyDate);
    const ceremonyPlace = values.ceremonyPlace.trim() || "Cyberspace Chapel";

    const intro = isJoint
        ? `${nameA} and ${nameB} mark this day at ${ceremonyPlace} with these Bitcoin vows:`
        : `${nameA} marks this day at ${ceremonyPlace} with these Bitcoin vows:`;

    const rules = [];
    rules.push(`- Promise to stack ${formatCurrency(values.buyAmount)} of Bitcoin ${values.buyFrequency} with patience and care.`);
    if (values.noPanic) rules.push("- Hold firm through volatility and never panic sell under market pressure.");
    if (values.noLeverage) rules.push("- Reject derivative trading and never use leverage against shared peace of mind.");
    if (values.coldStorage) rules.push("- Keep private keys offline in secure cold storage, away from temptation and hurry.");
    if (values.noShitcoins) rules.push("- Stay faithful to Bitcoin and ignore altcoin noise.");
    if (values.customVow && values.customVow.trim() !== "") {
        rules.push(`- ${values.customVow.trim()}`);
    }

    const text = [
        "=========================================",
        "            BITCOIN VOW CERTIFICATE",
        "=========================================",
        `Date: ${ceremonyDate}`,
        `Place: ${ceremonyPlace}`,
        isSealed && savedBlockHeight ? `Timechain Block: #${savedBlockHeight}` : "Timechain Status: Unsealed",
        "",
        intro,
        "",
        ...rules,
        "",
        "Symbolic keepsake only. Never type a recovery seed into any website.",
        "",
        isJoint ? `Signed (Partner A): ${nameA}` : `Signed: ${nameA}`,
        isJoint ? `Signed (Partner B): ${nameB}` : "",
        values.enableWitness ? `Witnessed by: ${values.witnessName.trim() || "Witness"}` : "",
        "========================================="
    ].filter(line => line !== "").join("\n");

    try {
        await navigator.clipboard.writeText(text);
        showSavedToast("Copied");
    } catch (error) {
        fallbackCopy(text);
        showSavedToast("Copied");
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
}

// -------------------------------------------------------------
// State Management (LocalStorage)
// -------------------------------------------------------------
function saveState() {
    try {
        const data = {
            setupType: getSetupType(),
            isSealed: isSealed,
            savedBlockHeight: savedBlockHeight,
            canvasState: canvasState
        };

        FIELD_IDS.forEach((id) => {
            const field = document.getElementById(id);
            if (!field) return;
            data[id] = field.type === "checkbox" ? field.checked : field.value;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn("Unable to save prenup state", error);
    }
}

function restoreState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);

        // Restore Setup Type Solo/Joint
        const type = data.setupType || "solo";
        const btnSolo = document.getElementById("btn-solo");
        const btnJoint = document.getElementById("btn-joint");
        if (type === "solo" && btnSolo) {
            btnSolo.querySelector("input").checked = true;
        } else if (btnJoint) {
            btnJoint.querySelector("input").checked = true;
        }

        // Restore standard field values
        FIELD_IDS.forEach((id) => {
            const field = document.getElementById(id);
            if (!field || !(id in data)) return;
            if (field.type === "checkbox") {
                field.checked = Boolean(data[id]);
            } else {
                field.value = data[id];
            }
        });

        // Trigger view switches for Setup Type
        setSetupType(type);

        // Restore Block height
        savedBlockHeight = data.savedBlockHeight || "";

        // Restore canvas state
        if (data.canvasState) {
            Object.assign(canvasState, data.canvasState);
            Object.keys(canvasState).forEach((canvasId) => {
                const canvas = document.getElementById(canvasId);
                if (canvas && canvasState[canvasId]) {
                    const ctx = canvas.getContext("2d");
                    const img = new Image();
                    img.onload = function () {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = canvasState[canvasId];
                }
            });
        }

        // Restore Sealed Lock state
        if (data.isSealed) {
            isSealed = true;
            document.querySelector(".document-sheet")?.classList.add("sealed-lock");
            document.getElementById("cert-wax-seal")?.classList.add("sealed");
            const sealBtn = document.getElementById("btn-seal");
            const btnText = sealBtn?.querySelector(".btn-text");
            if (btnText) btnText.textContent = "Unlock Vows";
            sealBtn?.classList.remove("glow-effect");
            sealBtn?.classList.add("secondary");
        }
    } catch (error) {
        console.warn("Unable to restore prenup state", error);
    }
}

async function resetState() {
    const confirmed = await showConfirmModal();
    if (!confirmed) return;

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn("Unable to reset prenup state", error);
    }

    // Reset canvasses
    const canvases = ["sig-canvas-a", "sig-canvas-b", "sig-canvas-witness"];
    canvases.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        delete canvasState[id];
    });

    // Reset seal & block state
    isSealed = false;
    savedBlockHeight = "";
    renderBlockHeight();

    const docSheet = document.querySelector(".document-sheet");
    docSheet?.classList.remove("sealed-lock");
    docSheet?.classList.remove("shake-effect");
    document.getElementById("cert-wax-seal")?.classList.remove("sealed");

    const sealBtn = document.getElementById("btn-seal");
    const btnText = sealBtn?.querySelector(".btn-text");
    if (btnText) btnText.textContent = "Sign & Seal Vows";
    sealBtn?.classList.add("glow-effect");
    sealBtn?.classList.remove("secondary");

    // Reset Form
    document.getElementById("prenup-form")?.reset();

    // Set Default Radio View (Solo)
    const btnSolo = document.getElementById("btn-solo");
    if (btnSolo) btnSolo.querySelector("input").checked = true;
    setSetupType("solo");

    updateWitnessVisibility();
    updatePrenup();
    updateCardClasses();
    showSavedToast("Reset complete");
}

function showSavedToast(text) {
    const status = document.getElementById("saved-status");
    if (!status) return;
    status.textContent = text;
    window.clearTimeout(showSavedToast.timeout);
    showSavedToast.timeout = window.setTimeout(() => {
        status.textContent = "Saved locally";
    }, 1800);
}

// -------------------------------------------------------------
// Formatting Helpers
// -------------------------------------------------------------
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(Math.max(0, value));
}

function formatCeremonyDate(value) {
    if (!value) {
        return new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// Confetti / Gold Coin Particle System
// -------------------------------------------------------------
class ConfettiSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.particles = [];
        this.isActive = false;
        this.colors = [
            "#ffd700", // Gold
            "#d4af37", // Metallic Gold
            "#f7931a", // Bitcoin Orange
            "#fff275", // Pastel Gold
            "#a88118", // Dark Gold
            "#f8b153"  // Muted Orange
        ];

        window.addEventListener("resize", () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawn() {
        this.particles = [];
        const count = 180;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width + window.scrollX,
                y: -30 - Math.random() * 80 + window.scrollY,
                size: 5 + Math.random() * 9,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                speedX: -2.5 + Math.random() * 5,
                speedY: 2.5 + Math.random() * 6,
                rotation: Math.random() * 360,
                rotationSpeed: -3 + Math.random() * 6,
                isCoin: Math.random() < 0.28, // ~28% gold coins
                opacity: 0.85 + Math.random() * 0.15,
                isSparkle: false
            });
        }

        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
    }

    spawnSparkle(x, y) {
        if (Math.random() > 0.25) return; // subtle trailing

        this.particles.push({
            x: x + window.scrollX,
            y: y + window.scrollY,
            size: 1.2 + Math.random() * 2.8,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            speedX: -0.4 + Math.random() * 0.8,
            speedY: 0.3 + Math.random() * 0.7,
            rotation: Math.random() * 360,
            rotationSpeed: -2 + Math.random() * 4,
            isCoin: false,
            opacity: 0.75 + Math.random() * 0.25,
            isSparkle: true
        });

        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
    }

    animate() {
        if (this.particles.length === 0) {
            this.isActive = false;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            if (p.isSparkle) {
                p.opacity -= 0.012;
                if (p.opacity <= 0) {
                    this.particles.splice(i, 1);
                    continue;
                }
            }

            const drawX = p.x - window.scrollX;
            const drawY = p.y - window.scrollY;

            // Remove off-screen particles relative to viewport
            if (drawY > this.canvas.height + 20 || drawX < -20 || drawX > this.canvas.width + 20) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(drawX, drawY);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = p.opacity;

            if (p.isCoin) {
                // Draw a gold coin with ₿
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = "#9a7b1c";
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                // Draw tiny ₿ in coin center
                this.ctx.fillStyle = "#5c4608";
                this.ctx.font = `bold ${p.size * 1.1}px sans-serif`;
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText("₿", 0, p.size * 0.05);
            } else if (p.isSparkle) {
                // Draw small sparkle dot
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Draw normal rectangular confetti
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
            }

            this.ctx.restore();
        }

        requestAnimationFrame(() => this.animate());
    }
}

// -------------------------------------------------------------
// Custom Confirm Modal Dialog Helper
// -------------------------------------------------------------
function showConfirmModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirm-modal");
        const btnCancel = document.getElementById("modal-cancel");
        const btnConfirm = document.getElementById("modal-confirm");

        if (!modal || !btnCancel || !btnConfirm) {
            resolve(false);
            return;
        }

        // Show modal
        modal.classList.remove("hidden");
        btnConfirm.focus();

        function handleCancel() {
            cleanup();
            resolve(false);
        }

        function handleConfirm() {
            cleanup();
            resolve(true);
        }

        function cleanup() {
            modal.classList.add("hidden");
            btnCancel.removeEventListener("click", handleCancel);
            btnConfirm.removeEventListener("click", handleConfirm);
        }

        btnCancel.addEventListener("click", handleCancel);
        btnConfirm.addEventListener("click", handleConfirm);
    });
}

// -------------------------------------------------------------
// Scrollspy active navigation item highlighter
// -------------------------------------------------------------
function initScrollspy() {
    const rulesLink = document.querySelector('a[href="#rules"]');
    const prenupLink = document.querySelector('a[href="#prenup"]');

    window.addEventListener("scroll", () => {
        const scrollPos = window.scrollY + 180;
        const rulesSec = document.getElementById("rules");
        const prenupSec = document.getElementById("prenup");
        const eduSec = document.querySelector(".education-section");

        if (!rulesSec) return;

        const isDesktop = window.innerWidth > 1024;

        if (isDesktop) {
            // On desktop, columns are side-by-side. Highlight "Rules" when viewing the workspace.
            const workspaceTop = rulesSec.offsetTop;
            const workspaceBottom = rulesSec.offsetTop + rulesSec.offsetHeight;

            if (scrollPos >= workspaceTop && scrollPos < workspaceBottom) {
                rulesLink?.classList.add("active-nav");
                prenupLink?.classList.remove("active-nav");
            } else {
                rulesLink?.classList.remove("active-nav");
                prenupLink?.classList.remove("active-nav");
            }
        } else {
            // On mobile, modules stack vertically. Track bounds dynamically.
            const rulesTop = rulesSec.offsetTop;
            const prenupTop = prenupSec ? prenupSec.getBoundingClientRect().top + window.scrollY : 0;
            const eduTop = eduSec ? eduSec.offsetTop : document.body.scrollHeight;

            if (prenupTop && scrollPos >= prenupTop && scrollPos < eduTop) {
                prenupLink?.classList.add("active-nav");
                rulesLink?.classList.remove("active-nav");
            } else if (scrollPos >= rulesTop && scrollPos < prenupTop) {
                rulesLink?.classList.add("active-nav");
                prenupLink?.classList.remove("active-nav");
            } else {
                rulesLink?.classList.remove("active-nav");
                prenupLink?.classList.remove("active-nav");
            }
        }
    });
}

// -------------------------------------------------------------
// Scroll Reveal animation observer
// -------------------------------------------------------------
function initScrollReveal() {
    const targets = document.querySelectorAll(".education-section, .faq-section");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("reveal-active");
            }
        });
    }, { threshold: 0.02 });

    targets.forEach(t => {
        t.classList.add("reveal-hidden");
        observer.observe(t);
    });
}

// -------------------------------------------------------------
// Cursor-driven background blobs parallax animation
// -------------------------------------------------------------
function initBackgroundParallax() {
    let ticked = false;
    window.addEventListener("mousemove", (e) => {
        if (!ticked) {
            window.requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth) - 0.5;
                const y = (e.clientY / window.innerHeight) - 0.5;
                document.body.style.setProperty("--mx", `${x * 35}px`);
                document.body.style.setProperty("--my", `${y * 35}px`);
                ticked = false;
            });
            ticked = true;
        }
    });
}
