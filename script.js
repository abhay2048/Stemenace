let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('stemanaceScore') || 0;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;

async function init() {
    try {
        const mathRes = await fetch('mathformula.txt');
        const mathText = await mathRes.text();
        allQuestions = mathText.split('\n').filter(l => l.includes('::')).map(line => {
            const p = line.split('::').map(s => s.trim());
            return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

        document.getElementById('high-score').innerText = highScore;
        showScreen('screen-home');
    } catch (e) { console.error("STEMANACE Initialization Failed:", e); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-learn') populateVault();
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec;
    startGame();
}

function startGame() {
    lives = 3; score = 0;
    updateHUD();
    showScreen('screen-game');
    nextRound();
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        bar.style.width = (timeLeft / timeLimit * 100) + "%";
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        score++;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('stemanaceScore', highScore);
            document.getElementById('high-score').innerText = highScore;
        }
        updateHUD();
        nextRound();
    } else {
        handleWrong();
    }
}

function handleWrong() {
    clearInterval(timerId);
    lives--;
    updateHUD();
    
    // Show Roast + Correct Answer
    const roast = roasts.length > 0 ? roasts[Math.floor(Math.random() * roasts.length)] : "Critical Failure.";
    document.getElementById('roast-message').innerText = roast;
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    
    document.getElementById('roast-popup').classList.remove('hidden');
    MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    document.getElementById('final-roast').innerText = "Simulation Terminated. Efficiency below threshold.";
    showScreen('screen-over');
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => {
        if (!acc[q.chapter]) acc[q.chapter] = [];
        acc[q.chapter].push(q);
        return acc;
    }, {});

    let html = "";
    for (const chap in grouped) {
        html += `<h3 class="chap-header">${chap.toUpperCase()}</h3>`;
        html += `<table class="v-table"><tbody>`;
        grouped[chap].forEach(q => {
            html += `<tr><td>\\(${q.q}\\)</td><td class="v-ans">\\(${q.correct}\\)</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    list.innerHTML = html;
    MathJax.typesetPromise();
}

init();
