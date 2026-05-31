/**
 * BTC.Wedding Application Core Logic
 * Handles real-time blockchain data, interactive vow states,
 * ring-forging logic, certificate generation, and guestbook storage.
 */

const { SimplePool, verifyEvent, nip19 } = window.NostrTools;

const NOSTR_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://nos.lol"
];
const NOSTR_WISH_KIND = 1;
const NOSTR_WISH_TAG = "btc-wedding";
const NOSTR_WISH_LIMIT = 50;
const NOSTR_MAX_AUTHOR_LENGTH = 48;
const NOSTR_MAX_WISH_LENGTH = 280;
const nostrPool = new SimplePool({ enablePing: true, enableReconnect: true });

// Global State
const state = {
    partnerName: "",
    vowsChecked: 0,
    ringsForged: false,
    currentBtcPrice: null,
    blockHeight: null,
    blockHash: "",
    timestamp: ""
};

// Seed blessings for Guestbook
const SEED_WISHES = [
    {
        author: "Bitcoin Genesis Block",
        text: "\"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks\"",
        gift: "🧱 Block 0"
    },
    {
        author: "Hal Finney",
        text: "Running bitcoin",
        gift: "🖥️ Node Online"
    },
    {
        author: "Bitcoin Pizza Day",
        text: "10,000 BTC exchanged for two pizzas on 2010-05-22",
        gift: "🍕 2 Pizzas"
    }
];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupHeaderScroll();
    fetchBlockchainData();
    setupCountdown();
    setupVowsRitual();
    setupGuestbook();
    setupAddressCopy();
    
    // Set fallback date in invitation
    const today = new Date();
    document.getElementById("wedding-date-value").textContent = today.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function formatCurrency(value) {
    if (!Number.isFinite(value)) {
        return "Unavailable";
    }

    return `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatBlockHeight(value) {
    if (!Number.isInteger(value)) {
        return "Unavailable";
    }

    return `#${value.toLocaleString("en-US")}`;
}

function formatShortHash(value) {
    if (!value || value.length < 16) {
        return "Unavailable";
    }

    return `${value.substring(0, 8)}...${value.substring(value.length - 8)}`;
}

async function fetchWithTimeout(url, timeoutMs = 4000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

/* --- HEADER AND SCROLL EFFECTS --- */
function setupHeaderScroll() {
    const header = document.querySelector("header");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    });
}

/* --- BLOCKCHAIN API INTEGRATION --- */
async function fetchBlockchainData() {
    const priceEl = document.getElementById("btc-price");
    const blockEl = document.getElementById("btc-block");
    const hashEl = document.getElementById("btc-hash");
    const marketCapEl = document.getElementById("btc-mcap");

    let priceFetched = false;
    let blockFetched = false;
    let supplyFetched = false;

    // 1. Fetch BTC USD Price using Coinbase (highly stable, CORS-friendly, real-time)
    try {
        const coinbaseRes = await fetchWithTimeout("https://api.coinbase.com/v2/prices/BTC-USD/spot");
        if (coinbaseRes.ok) {
            const data = await coinbaseRes.json();
            state.currentBtcPrice = parseFloat(data.data.amount);
            priceFetched = true;
        }
    } catch (err) {
        console.warn("Coinbase price fetch failed, trying Blockchain.info...", err);
    }

    // Fallback 1: Blockchain.info Ticker
    if (!priceFetched) {
        try {
            const bcRes = await fetchWithTimeout("https://blockchain.info/ticker");
            if (bcRes.ok) {
                const data = await bcRes.json();
                state.currentBtcPrice = data.USD.last;
                priceFetched = true;
            }
        } catch (err) {
            console.warn("Blockchain.info price fetch failed, trying Mempool.space...", err);
        }
    }

    // Fallback 2: Mempool.space prices
    if (!priceFetched) {
        try {
            const mempoolPriceRes = await fetchWithTimeout("https://mempool.space/api/v1/prices");
            if (mempoolPriceRes.ok) {
                const data = await mempoolPriceRes.json();
                state.currentBtcPrice = data.USD;
                priceFetched = true;
            }
        } catch (err) {
            console.error("All price APIs failed.", err);
        }
    }

    priceEl.textContent = formatCurrency(state.currentBtcPrice);

    // 2. Fetch Circulating Supply & Calculate Market Cap
    let supply = null;
    try {
        // Blockchain.info total satoshis in circulation
        const supplyRes = await fetchWithTimeout("https://blockchain.info/q/totalbc");
        if (supplyRes.ok) {
            const satoshis = await supplyRes.text();
            supply = parseInt(satoshis) / 100000000;
            supplyFetched = Number.isFinite(supply);
        }
    } catch (err) {
        console.warn("Circulating supply fetch failed.", err);
    }

    if (marketCapEl) {
        if (priceFetched && supplyFetched) {
            const calculatedMcap = supply * state.currentBtcPrice;
            marketCapEl.textContent = `$${Math.round(calculatedMcap).toLocaleString("en-US")}`;
        } else {
            marketCapEl.textContent = "Unavailable";
        }
    }

    // 3. Fetch Block Height & Tip Hash using browser-reachable public APIs.
    try {
        const heightRes = await fetchWithTimeout("https://blockstream.info/api/blocks/tip/height");
        if (heightRes.ok) {
            const height = await heightRes.json();
            state.blockHeight = parseInt(height);
            blockEl.textContent = `#${state.blockHeight.toLocaleString('en-US')}`;
            blockFetched = true;
        }
    } catch (err) {
        console.warn("Blockstream block height fetch failed, trying Blockchain.info...", err);
    }

    // Fallback block height via Blockchain.info query API
    if (!blockFetched) {
        try {
            const bcBlockRes = await fetchWithTimeout("https://blockchain.info/q/getblockcount");
            if (bcBlockRes.ok) {
                const heightText = await bcBlockRes.text();
                state.blockHeight = parseInt(heightText);
                blockEl.textContent = `#${state.blockHeight.toLocaleString('en-US')}`;
                blockFetched = true;
            }
        } catch (err) {
            console.error("All block height APIs failed.", err);
        }
    }

    blockEl.textContent = formatBlockHeight(state.blockHeight);

    // 4. Fetch Block Tip Hash
    let hashFetched = false;
    try {
        const hashRes = await fetchWithTimeout("https://blockstream.info/api/blocks/tip/hash");
        if (hashRes.ok) {
            const hash = await hashRes.text();
            state.blockHash = hash;
            hashFetched = true;
        }
    } catch (err) {
        console.warn("Blockstream block hash fetch failed.", err);
    }

    if (!hashFetched) {
        // Fallback: fetch block details for current height via block count
        try {
            const blockIndexRes = await fetchWithTimeout(`https://blockchain.info/block-height/${state.blockHeight}?format=json`);
            if (blockIndexRes.ok) {
                const data = await blockIndexRes.json();
                if (data.blocks && data.blocks[0]) {
                    state.blockHash = data.blocks[0].hash;
                    hashFetched = true;
                }
            }
        } catch (err) {
            console.error("All hash APIs failed. Using fallback.", err);
        }
    }

    hashEl.textContent = formatShortHash(state.blockHash);
    hashEl.title = state.blockHash || "Latest block hash unavailable";
}

/* --- DYNAMIC COUNDOWN TO HALVING / YEARS ACTIVE --- */
function setupCountdown() {
    const countdownEl = document.getElementById("halving-countdown");
    const uptimeEl = document.getElementById("btc-uptime");
    if (!countdownEl) return;

    // Standard BTC Genesis: Jan 3, 2009
    const genesisDate = new Date("2009-01-03T18:15:05Z");

    const updateTimer = () => {
        const now = new Date();
        const diffMs = now - genesisDate;

        const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
        const days = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        countdownEl.innerHTML = `${years}y ${days}d ${hours}h ${minutes}m ${seconds}s`;

        if (uptimeEl) {
            uptimeEl.textContent = `${years}y ${days}d`;
        }
    };

    updateTimer();
    setInterval(updateTimer, 1000);
}

/* --- THE VOWS AND RITUAL STATE MACHINE --- */
function setupVowsRitual() {
    const steps = document.querySelectorAll(".ritual-step");
    const btnNext1 = document.getElementById("btn-next-1");
    const btnNext2 = document.getElementById("btn-next-2");
    const btnBack2 = document.getElementById("btn-back-2");
    const btnBack3 = document.getElementById("btn-back-3");
    const btnForge = document.getElementById("btn-forge");
    
    const partnerInput = document.getElementById("bride-name");
    const vowItems = document.querySelectorAll(".vow-item");
    const totalVows = vowItems.length;

    // Validate Step 1 Name input
    partnerInput.addEventListener("input", (e) => {
        state.partnerName = e.target.value.trim();
        btnNext1.disabled = state.partnerName.length < 2;
    });

    // Step 1 -> Step 2 transition
    btnNext1.addEventListener("click", () => {
        switchStep(1, 2);
    });

    // Step 2 <- Step 1 transition
    btnBack2.addEventListener("click", () => {
        switchStep(2, 1);
    });

    // Validate Step 2 Vows Checked
    vowItems.forEach(item => {
        item.addEventListener("click", () => {
            item.classList.toggle("checked");
            
            // Count checked items
            const checkedCount = document.querySelectorAll(".vow-item.checked").length;
            state.vowsChecked = checkedCount;
            
            // Enable button only if ALL vows are checked
            btnNext2.disabled = checkedCount !== totalVows;
        });
    });

    // Step 2 -> Step 3 transition
    btnNext2.addEventListener("click", () => {
        switchStep(2, 3);
        // Pre-populate ring forge status
        document.getElementById("forge-status").textContent = "WAITING FOR TRANSACTION ORACLE...";
    });

    // Step 3 <- Step 2 transition
    btnBack3.addEventListener("click", () => {
        switchStep(3, 2);
    });

    // Step 3 Ring Forge Interaction
    btnForge.addEventListener("click", async () => {
        btnForge.disabled = true;
        btnBack3.style.display = "none";
        
        const statusEl = document.getElementById("forge-status");
        const graphicEl = document.querySelector(".ring-graphic");
        
        const logs = [
            "CONNECTING TO THE MEMPOOL NETWORK...",
            "READING THE LATEST BITCOIN TIP...",
            "DERIVING A LOCAL CERTIFICATE HASH...",
            "FORGING CEREMONIAL SHA-256 RINGS...",
            "ATTACHING CURRENT MARKET AND BLOCK WITNESS DATA...",
            `SUCCESS! CEREMONY PREPARED WITH BLOCK ${formatBlockHeight(state.blockHeight)}`
        ];

        // Animated typewriter for fake blockchain transaction logs
        for (let i = 0; i < logs.length; i++) {
            statusEl.textContent = logs[i];
            statusEl.classList.add("glow-text");
            await delay(1200);
            statusEl.classList.remove("glow-text");
        }

        // Complete forge visually
        graphicEl.classList.add("forged");
        state.ringsForged = true;
        
        // Change Forge Button to Certificate opener
        btnForge.textContent = "VIEW SACRED MARRIAGE CERTIFICATE";
        btnForge.disabled = false;
        
        // Remove forge click listener to open certificate
        btnForge.addEventListener("click", () => {
            openCertificate();
        });
    });
}

function switchStep(from, to) {
    const steps = document.querySelectorAll(".ritual-step");
    steps[from - 1].classList.remove("active");
    steps[to - 1].classList.add("active");
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* --- SACRED MARRIAGE CERTIFICATE GENERATION --- */
function openCertificate() {
    const modal = document.getElementById("cert-modal");
    
    // Fill dynamic fields
    document.getElementById("cert-bride-name").textContent = state.partnerName;
    
    // Timestamp
    const today = new Date();
    state.timestamp = today.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });
    document.getElementById("cert-date").textContent = state.timestamp;
    
    // Blockchain details
    document.getElementById("cert-block-height").textContent = formatBlockHeight(state.blockHeight);
    document.getElementById("cert-block-hash").textContent = state.blockHash || "Unavailable";
    document.getElementById("cert-btc-price").textContent = formatCurrency(state.currentBtcPrice);
    
    // Local certificate fingerprint for this ceremony.
    const certificateId = sha256(state.partnerName + today.getTime() + (state.blockHash || "no-block-hash"));
    document.getElementById("cert-tx-id").textContent = certificateId;
    
    // Signatures
    document.getElementById("sig-bride").textContent = state.partnerName;
    document.getElementById("sig-btc").textContent = state.blockHash ? state.blockHash.substring(0, 16).toUpperCase() : "DATA UNAVAILABLE";
    
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // disable scrolling underlying page

    // Setup action events inside certificate
    document.getElementById("btn-print-cert").onclick = () => {
        window.print();
    };

    document.getElementById("btn-share-cert").onclick = () => {
        const shareText = `💍 I completed the btc.wedding ceremony using Bitcoin witness data from ${formatBlockHeight(state.blockHeight)} at ${formatCurrency(state.currentBtcPrice)}.`;
        navigator.clipboard.writeText(shareText).then(() => {
            const btn = document.getElementById("btn-share-cert");
            const originalText = btn.textContent;
            btn.textContent = "COVENANT COPIED TO CLIPBOARD!";
            setTimeout(() => { btn.textContent = originalText; }, 2500);
        });
    };

    document.getElementById("btn-close-cert").onclick = () => {
        modal.classList.remove("active");
        document.body.style.overflow = "auto";
    };
}

/* --- THE GUESTBOOK / BLESSING WALL --- */
function setupGuestbook() {
    const form = document.getElementById("wish-form");
    const wishesWall = document.getElementById("wishes-wall");
    const giftTags = document.querySelectorAll(".gift-tag");
    const statusEl = document.getElementById("nostr-status");
    const sourceEl = document.getElementById("nostr-source");
    const btnSubmit = document.getElementById("btn-submit-wish");
    let selectedGift = "🥂 Champagne";
    let syncInFlight = false;
    const renderedWishIds = new Set();

    // Set gift select tag interaction
    giftTags.forEach(tag => {
        tag.addEventListener("click", () => {
            giftTags.forEach(t => t.classList.remove("selected"));
            tag.classList.add("selected");
            selectedGift = tag.dataset.gift;
        });
    });

    const setStatus = (message, tone = "loading") => {
        statusEl.textContent = message;
        statusEl.dataset.tone = tone;
    };

    const setSubmitMode = (enabled, label) => {
        btnSubmit.disabled = !enabled;
        btnSubmit.textContent = label;
    };

    const renderWish = (wish, { prepend = false } = {}) => {
        if (wish.id && renderedWishIds.has(wish.id)) {
            return;
        }

        if (wish.id) {
            renderedWishIds.add(wish.id);
        }

        const card = document.createElement("div");
        card.className = "wish-card glow-border";
        card.innerHTML = `
            <p class="wish-text">“${escapeHtml(wish.text)}”</p>
            <div class="wish-footer">
                <div class="wish-proof">${escapeHtml(wish.proof)}</div>
                <div class="wish-meta">
                    <span class="wish-author">${escapeHtml(wish.author)}</span>
                    <span class="wish-gift">${escapeHtml(wish.gift)}</span>
                </div>
            </div>
        `;

        if (prepend) {
            wishesWall.prepend(card);
        } else {
            wishesWall.append(card);
        }
    };

    const renderWishCollection = (wishes) => {
        wishesWall.innerHTML = "";
        renderedWishIds.clear();
        wishes.forEach(wish => renderWish(wish));
    };

    const showFallbackWishes = (message, tone = "warning") => {
        const fallbackWishes = SEED_WISHES.map((wish, index) => ({
            id: `seed-${index}`,
            author: wish.author,
            text: wish.text,
            gift: wish.gift,
            proof: "Historical Bitcoin reference"
        }));

        renderWishCollection(fallbackWishes);
        setStatus(message, tone);
    };

    const toNpub = (pubkey) => {
        try {
            return nip19.npubEncode(pubkey);
        } catch (error) {
            return pubkey;
        }
    };

    const shortenNpub = (npub) => {
        if (!npub || npub.length < 16) {
            return npub || "unknown signer";
        }

        return `${npub.slice(0, 10)}...${npub.slice(-6)}`;
    };

    const formatWishAge = (createdAtSeconds) => {
        if (!Number.isFinite(createdAtSeconds)) {
            return "unknown time";
        }

        const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - createdAtSeconds);
        if (diffSeconds < 60) {
            return `${diffSeconds}s ago`;
        }

        if (diffSeconds < 3600) {
            return `${Math.floor(diffSeconds / 60)}m ago`;
        }

        if (diffSeconds < 86400) {
            return `${Math.floor(diffSeconds / 3600)}h ago`;
        }

        return `${Math.floor(diffSeconds / 86400)}d ago`;
    };

    const parseWishEvent = (event) => {
        try {
            if (!event || event.kind !== NOSTR_WISH_KIND || !verifyEvent(event)) {
                return null;
            }

            const hasWishTag = event.tags.some(tag => tag[0] === "t" && tag[1] === NOSTR_WISH_TAG);
            if (!hasWishTag) {
                return null;
            }

            const payload = JSON.parse(event.content);
            const text = typeof payload.text === "string" ? payload.text.trim().slice(0, NOSTR_MAX_WISH_LENGTH) : "";
            if (!text) {
                return null;
            }

            const author = typeof payload.author === "string"
                ? payload.author.trim().slice(0, NOSTR_MAX_AUTHOR_LENGTH)
                : "";
            const gift = typeof payload.gift === "string" && payload.gift.trim()
                ? payload.gift.trim()
                : (event.tags.find(tag => tag[0] === "gift")?.[1] || "⚡ Signed via Nostr");
            const npub = toNpub(event.pubkey);

            return {
                id: event.id,
                author: author || `Anon ${shortenNpub(npub)}`,
                text,
                gift,
                proof: `Signed by ${shortenNpub(npub)} via Nostr • ${formatWishAge(event.created_at)}`,
                createdAt: event.created_at
            };
        } catch (error) {
            console.warn("Unable to parse guestbook event.", error);
            return null;
        }
    };

    const loadRelayWishes = async ({ silent = false } = {}) => {
        if (syncInFlight) {
            return;
        }

        syncInFlight = true;
        if (!silent) {
            setStatus("Loading signed blessings from Nostr relays...", "loading");
        }

        try {
            const events = await Promise.resolve(nostrPool.querySync(
                NOSTR_RELAYS,
                {
                    kinds: [NOSTR_WISH_KIND],
                    "#t": [NOSTR_WISH_TAG],
                    limit: NOSTR_WISH_LIMIT
                }
            ));

            const wishes = (events || [])
                .map(parseWishEvent)
                .filter(Boolean)
                .sort((left, right) => right.createdAt - left.createdAt);

            if (wishes.length === 0) {
                showFallbackWishes("No signed blessings yet. Showing historical Bitcoin references until the first Nostr note arrives.", "warning");
                return;
            }

            renderWishCollection(wishes);
            setStatus(`Loaded ${wishes.length} signed blessings from Nostr.`, "success");
        } catch (error) {
            console.error("Unable to load blessings from relays.", error);
            showFallbackWishes("Nostr relays are unavailable right now. Showing historical fallback cards.", "error");
        } finally {
            syncInFlight = false;
        }
    };

    const hasNostrSigner = () => {
        return Boolean(window.nostr && typeof window.nostr.getPublicKey === "function" && typeof window.nostr.signEvent === "function");
    };

    const refreshComposeAvailability = () => {
        if (hasNostrSigner()) {
            setSubmitMode(true, "Send Signed Blessing");
            sourceEl.textContent = `Publishing to ${NOSTR_RELAYS.length} public relays with a NIP-07 signer. Reading remains public and unsigned relays may mirror your note.`;
        } else {
            setSubmitMode(false, "Nostr Extension Required");
            sourceEl.textContent = "Read-only mode: install a NIP-07 browser signer to publish a blessing. The wall still reads live public relay data.";
        }
    };

    refreshComposeAvailability();
    loadRelayWishes();
    setInterval(() => {
        loadRelayWishes({ silent: true });
    }, 45000);

    // Handle Form Submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!hasNostrSigner()) {
            setStatus("Read-only mode active. Install a NIP-07 signer to publish your blessing.", "warning");
            return;
        }
        
        const authorInput = document.getElementById("guest-name");
        const wishInput = document.getElementById("guest-wish");
        
        const author = (authorInput.value.trim() || "Anonymous Hodler").slice(0, NOSTR_MAX_AUTHOR_LENGTH);
        const wishText = wishInput.value.trim().slice(0, NOSTR_MAX_WISH_LENGTH);
        
        if (!wishText) {
            setStatus("Your blessing cannot be empty.", "warning");
            return;
        }

        const originalLabel = btnSubmit.textContent;
        setSubmitMode(false, "Signing Blessing...");
        setStatus("Requesting a Nostr signature from your browser signer...", "loading");

        try {
            const pubkey = await window.nostr.getPublicKey();
            const eventTemplate = {
                kind: NOSTR_WISH_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ["t", NOSTR_WISH_TAG],
                    ["client", "btc.wedding"],
                    ["gift", selectedGift]
                ],
                content: JSON.stringify({
                    site: "btc.wedding",
                    version: 1,
                    author,
                    text: wishText,
                    gift: selectedGift,
                    pubkey
                })
            };

            const signedEvent = await window.nostr.signEvent(eventTemplate);
            if (!verifyEvent(signedEvent)) {
                throw new Error("Signer returned an invalid Nostr event.");
            }

            await Promise.any(nostrPool.publish(NOSTR_RELAYS, signedEvent));

            const parsedWish = parseWishEvent(signedEvent);
            if (parsedWish) {
                const existingCards = wishesWall.querySelectorAll(".wish-card").length;
                const onlyFallbackVisible = existingCards === SEED_WISHES.length && Array.from(renderedWishIds).every(id => String(id).startsWith("seed-"));
                if (onlyFallbackVisible) {
                    renderWishCollection([parsedWish]);
                } else {
                    renderWish(parsedWish, { prepend: true });
                }
            }

            wishInput.value = "";
            authorInput.value = "";
            setStatus("Signed blessing published to Nostr relays.", "success");
        } catch (error) {
            console.error("Unable to publish blessing.", error);
            setStatus("Publishing failed. Check your signer approval and relay connectivity, then try again.", "error");
        } finally {
            setSubmitMode(true, originalLabel === "Nostr Extension Required" ? "Send Signed Blessing" : originalLabel);
            refreshComposeAvailability();
        }
    });
}

/* --- DONATION COPY WALLET --- */
function setupAddressCopy() {
    const addressBlock = document.getElementById("wedding-address-block");
    if (!addressBlock) return;

    if (!addressBlock.dataset.address) {
        addressBlock.classList.add("disabled");
        return;
    }

    addressBlock.addEventListener("click", () => {
        const addressText = addressBlock.dataset.address;
        navigator.clipboard.writeText(addressText).then(() => {
            const originalHtml = addressBlock.innerHTML;
            addressBlock.innerHTML = `<span>ADDRESS COPIED ✓</span>`;
            addressBlock.style.borderColor = "#2ECC71";
            addressBlock.style.color = "#2ECC71";
            
            setTimeout(() => {
                addressBlock.innerHTML = originalHtml;
                addressBlock.style.borderColor = "";
                addressBlock.style.color = "";
            }, 3000);
        });
    });
}

/* --- HELPER CRYPTOGRAPHIC & UTILITY FUNCTIONS --- */
function sha256(ascii) {
    // Basic deterministic mock SHA-256 implementation in pure JS
    // Returns a nice looking 64-character hash based on the seed
    function rotateRight(n, x) {
        return (x >>> n) | (x << (32 - n));
    }
    let mathPow = Math.pow;
    let maxWord = mathPow(2, 32);
    let result = '';
    let words = [];
    let asciiLength = ascii.length;
    let hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    let k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    
    // Hash generator based on standard SHA-256 constants
    let charCodes = [];
    for(let i=0; i<asciiLength; i++) charCodes.push(ascii.charCodeAt(i));
    
    // Create a deterministic signature based on human inputs and cryptographic seed
    let hashStr = "";
    for (let i = 0; i < 8; i++) {
        let val = (hash[i] + charCodes.reduce((a,b)=>a+(b*(i+1)), 0)) % maxWord;
        hashStr += val.toString(16).padStart(8, '0');
    }
    
    // Pad to 64 chars
    if(hashStr.length < 64) {
        hashStr = (hashStr + "0000000000000000000000000000000000000000000000000000000000000000").substring(0, 64);
    }
    return hashStr;
}

function escapeHtml(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(string).replace(/[&<>"']/g, function(m) { return map[m]; });
}
