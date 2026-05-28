// Set this to the json file of your game data!
const GAMEFILE = 'game.jsonc';

// State
let gameData = null;
let scores = {};

function error(e) {
    let err = document.getElementById("error");
    err.textContent = "Error, check console.";
    err.style.display = "block";
    console.log(`[JEOPARDY-ERROR] ${e}`);
}

function getColor(num) {
    switch(num) {
        case 100:
            return "#a9b665";
            break;
        case 200:
            return "#8b9482";
            break;
        case 300:
            return "#d8a657";
            break;
        case 400:
            return "#e78a4e";
            break;
        case 500:
            return "#ea6962";
            break;
    };
}

function updateScores() {
    let player = document.getElementById("points-handler-select").value;
    let num = parseInt(document.getElementById("points-handler-input").value);

    if (!isNaN(num)) {
        scores[player].value += num;
        scores[player].el.textContent = scores[player].value;
    }

    // thank claudy boi
    const maxScore = Math.max(...Object.values(scores).map(p => p.value));
    Object.values(scores).forEach(p => {
        p.el.style.color = p.value === maxScore ? 'var(--thm_yellow)' : '';
    });
}

function showModal(catIndex, row, button) {
    const category = gameData.categories[catIndex];
    console.log(`C ${category.name} R ${row}`);

    let overlay = document.getElementById("modal-overlay");
    if (!button.classList.contains("used")) { return; }

    // Setup modal category/name
    document.getElementById("modal-category").textContent = category.name;
    let value = document.getElementById("modal-value");
    value.textContent = row * 100;
    value.style.color = getColor(parseInt(row * 100));

    const q = gameData.categories[catIndex].questions[row - 1];

    document.getElementById("modal-question-text").textContent = q.question;
    let a = document.getElementById("modal-answer-text");
    a.textContent = q.answer;
    if (q.type === "img") {
        let modalImg = document.getElementById("modal-answer-img");
        modalImg.style.display = 'block';
    }

    // Handlers
    overlay.style.display = 'flex';
    document.getElementById("close-btn").addEventListener("click", () => {
        overlay.style.display = 'none';
        a.style.display = 'none';
    })

    document.getElementById("reveal-btn").addEventListener("click", () => {
        a.style.display = 'block';
    });
}

async function game() {
    // Fetch the GAMEFILE data
    try {
        const res = await fetch(GAMEFILE)
            .then(response => response.text())
            .then(text => {
                const json = text.replace(
                    /\/\/.*$/gm,
                    ""
                );
                gameData = JSON.parse(json);

                console.log(gameData);
            })
    } catch (e) {
        error(e);
    }

    if (gameData.title) {
        document.getElementById("game-title").textContent = gameData.title;
    }

    // Create Jeopardy Board
    const board = document.getElementById('board');
    const table = document.createElement('table');

    const header = document.createElement('tr');
    gameData.categories.forEach(category => {
        const th = document.createElement('th');
        th.textContent = category.name;
        header.appendChild(th);
    });

    table.appendChild(header);

    // Generate Rows
    for (let row = 1; row <= 5; row++) {
        const tr = document.createElement('tr');

        gameData.categories.forEach((category, i) => {
            const td = document.createElement('td');
            const button = document.createElement('button');

            // color the text depending on value
            let num = row * 100;
            button.textContent = num;
            button.style.color = getColor(num);

            button.addEventListener('click', () => {
                button.classList.toggle("used");

                showModal(i, row, button);
            });

            td.appendChild(button);
            tr.appendChild(td);
        });
        table.append(tr);
    }
    board.appendChild(table);

    // Scoreboard Creation
    gameData.players.forEach(player => {
        scores[player.name] = { value: 0, el: null };
    });

    let scoreboard = document.getElementById("scoreboard");
    gameData.players.forEach((player, i) => {
        const card = document.createElement('div');
        card.className = 'player-card';

        if (player.image) {
            const img = document.createElement('img');
            img.className = 'player-avatar';
            img.src = player.image + '?v=' + Date.now();
            img.alt = player.name;
            card.appendChild(img);
            console.log(img.src);
        }

        const name = document.createElement('p');
        name.className = 'player-name';
        name.textContent = player.name;
        card.appendChild(name);

        let score = document.createElement('div');
        score.className = 'player-score';
        score.textContent = scores[player.name].value;
        scores[player.name].el = score;
        card.appendChild(score);
        scoreboard.appendChild(card);
    });

    // Controller Creation
    let pointsHandler = document.getElementById("points-handler-select");
    gameData.players.forEach(player => {
        let option = document.createElement('option');
        option.textContent = player.name;
        option.value = player.name;
        pointsHandler.appendChild(option);
    });
    document.getElementById("points-handler-submit").addEventListener("click", () => {
        updateScores();
    })

    // Modal Handlers
    // let close = document.getElementById("");

}

game();