const STORAGE_KEY = "btc_wedding_household_plan_v1";

const DEFAULT_PLAN = {
    personA: "",
    personB: "",
    ownership: "mixed",
    recurringEnabled: false,
    buyAmount: "",
    buyFrequency: "monthly",
    noMarketReactions: true,
    custody: "individual",
    separateSecrets: true,
    emergencyGuide: true,
    annualReview: true
};

const OWNERSHIP_COPY = {
    separate: "We treat our bitcoin as separate property. Each person remains responsible for their own purchases, records, custody, and decisions.",
    shared: "We treat our bitcoin plan as part of one household reserve. We discuss material purchases, sales, and custody changes together.",
    mixed: "We may each hold personal bitcoin while also maintaining a shared household plan. We keep those purposes and records clearly separated."
};

const CUSTODY_COPY = {
    individual: "Our primary approach is individual self-custody. Each person is responsible for maintaining their own keys and verified backups.",
    multisig: "Our primary approach is shared multisignature custody. We document participants, device locations, and recovery procedures offline."
};

let currentStep = 0;
let saveTimer = 0;
let resetArmed = false;
let resetTimer = 0;

const form = document.getElementById("plan-form");
const planner = document.getElementById("planner");
const stepTabs = Array.from(document.querySelectorAll(".step-tab"));
const stepPanels = Array.from(document.querySelectorAll(".step-panel"));
const previousButton = document.getElementById("previous-step");
const nextButton = document.getElementById("next-step");
const previewButton = document.getElementById("show-preview");
const recurringToggle = document.getElementById("recurring-enabled");
const recurringFields = document.getElementById("recurring-fields");
const saveState = document.getElementById("save-state");
const actionStatus = document.getElementById("action-status");

function readPlan() {
    const data = new FormData(form);
    return {
        personA: String(data.get("personA") || "").trim(),
        personB: String(data.get("personB") || "").trim(),
        ownership: String(data.get("ownership") || DEFAULT_PLAN.ownership),
        recurringEnabled: data.has("recurringEnabled"),
        buyAmount: String(data.get("buyAmount") || "").trim(),
        buyFrequency: String(data.get("buyFrequency") || DEFAULT_PLAN.buyFrequency),
        noMarketReactions: data.has("noMarketReactions"),
        custody: String(data.get("custody") || DEFAULT_PLAN.custody),
        separateSecrets: data.has("separateSecrets"),
        emergencyGuide: data.has("emergencyGuide"),
        annualReview: data.has("annualReview")
    };
}

function applyPlan(plan) {
    Object.entries(plan).forEach(([name, value]) => {
        const fields = Array.from(form.elements).filter((field) => field.name === name);
        fields.forEach((field) => {
            if (field.type === "radio") {
                field.checked = field.value === value;
            } else if (field.type === "checkbox") {
                field.checked = Boolean(value);
            } else {
                field.value = String(value ?? "");
            }
        });
    });

    updateRecurringFields();
    renderPlan();
}

function restorePlan() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        applyPlan({ ...DEFAULT_PLAN, ...(stored || {}) });
    } catch {
        applyPlan(DEFAULT_PLAN);
    }
}

function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveState.textContent = "Saving…";
    saveState.classList.add("saving");
    saveTimer = window.setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readPlan()));
        saveState.textContent = "Saved locally";
        saveState.classList.remove("saving");
    }, 250);
}

function updateRecurringFields() {
    recurringFields.hidden = !recurringToggle.checked;
}

function formatFrequency(value) {
    return {
        weekly: "every week",
        biweekly: "every two weeks",
        monthly: "every month",
        quarterly: "every quarter"
    }[value] || "on a regular schedule";
}

function formatAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(amount);
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function getPartiesIntro(plan) {
    if (plan.personA && plan.personB) {
        return `${plan.personA} and ${plan.personB} made this plan to keep household Bitcoin decisions calm, explicit, and recoverable.`;
    }
    if (plan.personA) {
        return `${plan.personA} made this plan to keep Bitcoin decisions calm, explicit, and recoverable.`;
    }
    return "A plan made with patience, clear responsibilities, and no secrets stored online.";
}

function getRhythmCopy(plan) {
    const amount = formatAmount(plan.buyAmount);
    if (!plan.recurringEnabled) {
        return plan.noMarketReactions
            ? "We have not set a recurring purchase. Any future change will be discussed on a schedule, not made in reaction to a single market day."
            : "We have not set a recurring purchase. We will document a buying rhythm before treating it as a household commitment.";
    }

    const target = amount || "an agreed amount";
    const discipline = plan.noMarketReactions
        ? " We review this rhythm deliberately, not in reaction to a single market day."
        : "";
    return `Our current planning target is ${target} ${formatFrequency(plan.buyFrequency)}.${discipline}`;
}

function getSafetyRules(plan) {
    const rules = [];
    if (plan.separateSecrets) {
        rules.push("Seed phrases and private keys remain offline and separate from this document.");
    }
    if (plan.emergencyGuide) {
        rules.push("We maintain an offline emergency guide that the right person can find.");
    }
    if (plan.annualReview) {
        rules.push("We review custody, backups, and access once a year.");
    }
    if (rules.length === 0) {
        rules.push("We will document household safety and recovery responsibilities offline.");
    }
    return rules;
}

function renderPlan() {
    const plan = readPlan();
    setText("document-date", new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date()));
    setText("document-parties", getPartiesIntro(plan));
    setText("ownership-output", OWNERSHIP_COPY[plan.ownership] || OWNERSHIP_COPY.mixed);
    setText("rhythm-output", getRhythmCopy(plan));
    setText("custody-output", CUSTODY_COPY[plan.custody] || CUSTODY_COPY.individual);
    setText("signature-a", plan.personA || "Your name");
    setText("signature-b", plan.personB || "Partner");

    const signatureB = document.getElementById("signature-b-wrap");
    signatureB.classList.toggle("hidden", !plan.personB);

    const list = document.getElementById("safety-output");
    list.replaceChildren(...getSafetyRules(plan).map((rule) => {
        const item = document.createElement("li");
        item.textContent = rule;
        return item;
    }));
}

function setStep(step, focusPanel = false) {
    currentStep = Math.max(0, Math.min(stepPanels.length - 1, step));

    stepTabs.forEach((tab, index) => {
        const active = index === currentStep;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
    });

    stepPanels.forEach((panel, index) => {
        const active = index === currentStep;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
    });

    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === stepPanels.length - 1;
    previewButton.hidden = currentStep !== stepPanels.length - 1;

    if (focusPanel) {
        stepPanels[currentStep].querySelector("h3")?.setAttribute("tabindex", "-1");
        stepPanels[currentStep].querySelector("h3")?.focus({ preventScroll: true });
    }
}

function setMobileView(view, scroll = true) {
    const showPreview = view === "preview";
    planner.classList.toggle("show-preview", showPreview);

    const planTab = document.getElementById("view-plan");
    const previewTab = document.getElementById("view-preview");
    planTab.classList.toggle("active", !showPreview);
    previewTab.classList.toggle("active", showPreview);
    planTab.setAttribute("aria-selected", String(!showPreview));
    previewTab.setAttribute("aria-selected", String(showPreview));
    planTab.tabIndex = showPreview ? -1 : 0;
    previewTab.tabIndex = showPreview ? 0 : -1;

    if (scroll && window.matchMedia("(max-width: 820px)").matches) {
        planner.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start"
        });
    }
}

function getPlanText() {
    const plan = readPlan();
    const names = plan.personA && plan.personB
        ? `${plan.personA} and ${plan.personB}`
        : plan.personA || "Household";
    const safety = getSafetyRules(plan).map((rule) => `- ${rule}`).join("\n");

    return `OUR BITCOIN PLAN
${names}

1. OWNERSHIP
${OWNERSHIP_COPY[plan.ownership] || OWNERSHIP_COPY.mixed}

2. BUYING RHYTHM
${getRhythmCopy(plan)}

3. CUSTODY & CONTINUITY
${CUSTODY_COPY[plan.custody] || CUSTODY_COPY.individual}
${safety}

This is a personal planning document, not a legal contract or financial advice. It contains no wallet credentials or recovery material.

Created with btc.wedding`;
}

async function copyPlan() {
    try {
        await navigator.clipboard.writeText(getPlanText());
        actionStatus.textContent = "Plan copied to clipboard.";
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = getPlanText();
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        actionStatus.textContent = "Plan copied to clipboard.";
    }
}

function resetPlan() {
    const button = document.getElementById("reset-plan");
    if (!resetArmed) {
        resetArmed = true;
        button.textContent = "Reset now";
        button.classList.add("confirm-reset");
        actionStatus.textContent = "Press “Reset now” to clear this device’s draft.";
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(disarmReset, 5000);
        return;
    }

    window.clearTimeout(resetTimer);
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    applyPlan(DEFAULT_PLAN);
    setStep(0);
    setMobileView("plan");
    disarmReset();
    actionStatus.textContent = "Plan reset.";
}

function disarmReset() {
    resetArmed = false;
    const button = document.getElementById("reset-plan");
    button.textContent = "Reset plan";
    button.classList.remove("confirm-reset");
}

form.addEventListener("input", () => {
    updateRecurringFields();
    renderPlan();
    scheduleSave();
});

form.addEventListener("change", () => {
    updateRecurringFields();
    renderPlan();
    scheduleSave();
});

stepTabs.forEach((tab) => {
    tab.addEventListener("click", () => setStep(Number(tab.dataset.step), true));
    tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        setStep((currentStep + delta + stepTabs.length) % stepTabs.length, true);
        stepTabs[currentStep].focus();
    });
});

previousButton.addEventListener("click", () => setStep(currentStep - 1, true));
nextButton.addEventListener("click", () => setStep(currentStep + 1, true));
previewButton.addEventListener("click", () => setMobileView("preview"));

document.getElementById("view-plan").addEventListener("click", () => setMobileView("plan"));
document.getElementById("view-preview").addEventListener("click", () => setMobileView("preview"));
document.getElementById("print-plan").addEventListener("click", () => window.print());
document.getElementById("copy-plan").addEventListener("click", copyPlan);
document.getElementById("reset-plan").addEventListener("click", resetPlan);

window.addEventListener("pagehide", () => {
    window.clearTimeout(saveTimer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readPlan()));
});

restorePlan();
setStep(0);
