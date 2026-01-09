let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('mathMasterHS') || 0;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;

// Initialize App
async function init() {
    try {
        const mathRes = await fetch('mathformula.txt');
        const mathText = await mathRes.text();
        // Parsing using double-colon separator
        allQuestions = mathText.split('\n').filter(l => l.includes('::')).map(line => {
            const p = line.split('::').map(s => s.trim());
            return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

        document.getElementById('high-score').innerText = highScore;
        showScreen('screen-home');
    } catch (e) {
        console.error("Data Load Error:", e);
    }
}

// State Management
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-learn') populateLearn();
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec;
    startGame();
}

// Game Logic
function startGame() {
    lives = 3;
    score = 0;
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
    if (filteredQuestions.length === 0) return;

    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    // Shuffle options array
    const shuffled = [...currentQ.options].sort(() => Math.random() - 0.5);
    
    shuffled.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    if (window.MathJax) MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-bar');
    bar.style.width = "100%";
    
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        bar.style.width = (timeLeft / timeLimit * 100) + "%";
        if (timeLeft <= 0) {
            clearInterval(timerId);
            handleWrong();
        }
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        score++;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('mathMasterHS', highScore);
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
    if (lives <= 0) {
        endGame();
    } else {
        // Visual feedback before next Q
        document.getElementById('formula-display').style.color = "#ff4757";
        setTimeout(() => {
            document.getElementById('formula-display').style.color = "white";
            nextRound();
        }, 600);
    }
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    const msg = roasts.length > 0 ? roasts[Math.floor(Math.random() * roasts.length)] : "Study harder!";
    document.getElementById('roast-text').innerText = msg;
    showScreen('screen-over');
}

// Categorized Learn Section
function populateLearn() {
    const list = document.getElementById('learn-list');
    if (!list) return;

    const grouped = allQuestions.reduce((acc, q) => {
        if (!acc[q.chapter]) acc[q.chapter] = [];
        acc[q.chapter].push(q);
        return acc;
    }, {});

    let html = "";
    for (const chapter in grouped) {
        html += `<h3 class="chapter-header">${chapter.toUpperCase()}</h3>`;
        html += `<table class="learn-table"><tbody>`;
        grouped[chapter].forEach(q => {
            html += `<tr><td>\\(${q.q}\\)</td><td class="correct-ans">\\(${q.correct}\\)</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    list.innerHTML = html;
    if (window.MathJax) MathJax.typesetPromise();
}

init();
