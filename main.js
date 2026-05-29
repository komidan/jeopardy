// Configuration
const GAMEFILE      = 'game.jsonc';
const PREVENT_RELOAD = true;
const ROWS           = 5;
const ROW_VALUE      = 100; // multiplier per row

// State
let gameData = null;
let scores   = {};

// Utilities
const el = id => document.getElementById(id);

function showError(e) {
    const err = el("error");
    err.textContent = "Error, check console.";
    err.style.display = "block";
    console.error(`[JEOPARDY] ${e}`);
}

// Gruvbox colors mapped to row values
const VALUE_COLORS = {
    100: "var(--thm_green)",
    200: "var(--thm_aqua)",
    300: "var(--thm_yellow)",
    400: "var(--thm_orange)",
    500: "var(--thm_red)",
};

function valueColor(n) {
    return VALUE_COLORS[n] ?? "var(--thm_fg)";
}

// Normalise a field to always be an array (or empty array if missing)
function toArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
}

// Strip single-line comments so .jsonc files parse cleanly
async function fetchJsonc(path) {
    const text = await fetch(path).then(r => r.text());
    return JSON.parse(text.replace(/\/\/.*$/gm, ""));
}

// Create a DOM element with optional props and children
function make(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    children.forEach(c => c && node.appendChild(c));
    return node;
}

// Score Functions
function refreshScoreHighlight() {
    const max = Math.max(...Object.values(scores).map(p => p.value));
    Object.values(scores).forEach(p => {
        p.el.style.color = p.value === max ? "var(--thm_yellow)" : "";
    });
}

function adjustScore(playerName, delta) {
    scores[playerName].value += delta;
    scores[playerName].el.textContent = scores[playerName].value;
    refreshScoreHighlight();
}

function submitScore() {
    const playerName = el("points-handler-select").value;
    const num = parseInt(el("points-handler-input").value);
    if (!isNaN(num)) adjustScore(playerName, num);

    // Clear the avatar selection, and input field
    document.querySelectorAll(".player-avatar").forEach(c => c.classList.remove("active"));
    el("points-handler-input").value = "";
}

// Modal
const modal = (() => {
    const overlay        = el("modal-overlay");
    const answerText     = el("modal-answer-text");
    const audioContainer = el("modal-audio-container");
    const imageContainer = el("modal-image-container");

    // Track handlers to avoid stacking listeners across opens
    let closeHandler  = null;
    let revealHandler = null;

    function setListener(id, handler) {
        const btn = el(id);
        if (id === "close-btn"  && closeHandler)  btn.removeEventListener("click", closeHandler);
        if (id === "reveal-btn" && revealHandler) btn.removeEventListener("click", revealHandler);
        btn.addEventListener("click", handler);
        if (id === "close-btn")  closeHandler  = handler;
        if (id === "reveal-btn") revealHandler = handler;
    }

    function buildAudio(src) {
        return make("audio", { src, controls: true });
    }

    // Wrap each image in a div so the blur overlay can be click-to-reveal
    function buildImage(src, hidden = false) {
        const img = make("img", { src, alt: "", className: "modal-media-img" });
        const wrapper = make("div", { className: "modal-image-wrapper" }, img);

        if (hidden) {
            img.classList.add("hidden");
            wrapper.classList.add("hidden-wrapper");
            wrapper.addEventListener("click", () => {
                img.classList.remove("hidden");
                wrapper.classList.remove("hidden-wrapper");
            });
        }

        return wrapper;
    }

    // Populate audio/image containers from a question object
    function populateMedia(q) {
        const audios  = toArray(q.audio);
        const images  = toArray(q.image);
        const hidden = q["hide"] === true;

        audios.forEach(src => audioContainer.appendChild(buildAudio(src)));
        images.forEach(src => imageContainer.appendChild(buildImage(src, hidden)));

        audioContainer.style.display = audios.length ? "flex" : "none";
        imageContainer.style.display = images.length ? "flex" : "none";
    }

    function clearMedia() {
        audioContainer.replaceChildren();
        imageContainer.replaceChildren();
        audioContainer.style.display = "none";
        imageContainer.style.display = "none";
    }

    function close() {
        overlay.style.display = "none";
        answerText.style.display = "none";
        clearMedia();
    }

    function open(catIndex, row) {
        const category = gameData.categories[catIndex];
        const q        = category.questions[row - 1];
        const value    = row * ROW_VALUE;

        el("modal-category").textContent      = category.name;
        el("modal-value").textContent         = value;
        el("modal-value").style.color         = valueColor(value);
        el("modal-question-text").textContent = q.question;

        // Answer hidden until revealed
        answerText.textContent   = q.answer;
        answerText.style.display = "none";

        populateMedia(q);

        setListener("close-btn",  close);
        setListener("reveal-btn", () => { answerText.style.display = "block"; });

        overlay.style.display = "flex";
    }

    return { open, close };
})();


// Board
function buildBoard() {
    const table  = make("table");
    const header = make("tr");

    gameData.categories.forEach(cat => {
        header.appendChild(make("th", { textContent: cat.name }));
    });
    table.appendChild(header);

    for (let row = 1; row <= ROWS; row++) {
        const tr = make("tr");
        const value = row * ROW_VALUE;

        gameData.categories.forEach((_, catIndex) => {
            const btn = make("button", {
                textContent: value,
            });
            btn.style.color = valueColor(value);

            btn.addEventListener("click", () => {
                if (btn.classList.contains("used")) {
                    btn.classList.remove("used");
                    return;
                };
                btn.classList.add("used");
                modal.open(catIndex, row);
            });

            tr.appendChild(make("td", {}, btn));
        });

        table.appendChild(tr);
    }

    el("board").appendChild(table);
}

// Scoreboard
function buildScoreboard() {
    const scoreboard = el("scoreboard");

    gameData.players.forEach(player => {
        scores[player.name] = { value: 0, el: null };

        const scoreEl = make("div", { className: "player-score", textContent: "0" });
        scores[player.name].el = scoreEl;

        const card = make("div", { className: "player-card" });
        card.value = player.name;

        if (player.image) {
            const img = make("img", {
                className: "player-avatar",
                id: "player-avatar",
                src: player.image + "?v=" + Date.now(),
                alt: player.name,
            });
            img.onload = () => {
                if (img.naturalWidth === 0) img.remove();
            };

            // Card styling to select through clicking profile picture to add scores too.
            img.addEventListener("click", () => {
                document.querySelectorAll(".player-avatar").forEach(c => c.classList.remove("active"));
                img.classList.add("active");
                el("points-handler-select").value = player.name;
            });

            card.appendChild(img);
        }

        card.appendChild(make("p", { className: "player-name", textContent: player.name }));
        card.appendChild(scoreEl);

        scoreboard.appendChild(card);
    });
}

// Controls
function buildControls() {
    const select = el("points-handler-select");

    gameData.players.forEach(player => {
        select.appendChild(make("option", {
            textContent: player.name,
            value: player.name,
        }));
    });

    el("points-handler-submit").addEventListener("click", submitScore);
    el("points-handler-submit").removeAttribute("disabled");

    el("btn-reset").addEventListener("click", () => {
        if (confirm("Reset the board?")) location.reload();
    });

    // Preset Buttons
    let input = el("points-handler-input");
    el("points-100").addEventListener("click", () => { input.value = 100 });
    el("points-200").addEventListener("click", () => { input.value = 200 });
    el("points-300").addEventListener("click", () => { input.value = 300 });
    el("points-400").addEventListener("click", () => { input.value = 400 });
    el("points-500").addEventListener("click", () => { input.value = 500 });
}

// Initialization
async function game() {
    try {
        gameData = await fetchJsonc(GAMEFILE);
    } catch (e) {
        showError(e);
        return;
    }

    // Title is optional
    if (gameData.title) {
        let gt = el("game-title");
        gt.style.display = 'block';
        gt.textContent = gameData.title;
    }

    buildBoard();
    buildScoreboard();
    buildControls();
}

game();

// This prevents accidentally reloading the page and losing progress
if (PREVENT_RELOAD) {
    window.addEventListener("beforeunload", e => {
        e.preventDefault();
        e.returnValue = "";
    });
}