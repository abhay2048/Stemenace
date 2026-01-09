let questions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('mathMasterHS') || 0;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;

async function init() {
    try {
        const mathRes = await fetch('mathformula.txt');
        const mathText = await mathRes.text();
        questions = mathText.split('\n').filter(l => l.includes('|')).map(line => {
            const p = line.split('|').map(s => s.trim());
            return { q: p[0], correct: p[1], options: [p[1], p[2], p[3], p[4]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

        const hsEl = document.getElementById('high-score');
        if(hsEl) hsEl.innerText = highScore;
        
        showScreen('screen-home');
    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    if (timerId) clearInterval(timerId);
    if (id === 'screen-learn') populateLearn();
}

function populateLearn() {
    const list = document.getElementById('learn-list');
    if(!list) return;
    let html = `<table class="learn-table"><thead><tr><th>QUESTION</th><th>ANSWER</th></tr></thead><tbody>`;
    questions.forEach(q => {
        html += `<tr><td>\\(${q.q}\\)</td><td class="correct-ans">\\(${q.correct}\\)</td></tr>`;
    });
    html += `</tbody></table>`;
    list.innerHTML = html;
    if(window.MathJax) MathJax.typesetPromise();
}

function selectDifficulty(sec) {
    timeLimit = sec;
    startGame();
}

function startGame() {
    lives = 3;
    score = 0;
    updateHUD();
    showScreen('screen-game');
    nextRound();
}

function updateHUD() {
    const livesEl = document.getElementById('lives');
    const streakEl = document.getElementById('streak');
    // FIX: Math.max(0, lives) prevents RangeError
    if(livesEl) livesEl.innerText = "❤️".repeat(Math.max(0, lives));
    if(streakEl) streakEl.innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    if (questions.length === 0) return;

    currentQ = questions[Math.floor(Math.random() * questions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\(${opt}\\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    if(window.MathJax) MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-bar');
    if(bar) bar.style.width = "100%";
    
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        if(bar) bar.style.width = (timeLeft / timeLimit * 100) + "%";
        if (timeLeft <= 0) {
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
        // Short delay so user sees they were wrong before next Q
        setTimeout(nextRound, 500); 
    }
}

function endGame() {
    const finalStreakEl = document.getElementById('final-streak');
    const roastMsgEl = document.getElementById('roast-msg');
    
    if(finalStreakEl) finalStreakEl.innerText = score;
    if(roastMsgEl) {
        const msg = roasts.length > 0 ? roasts[Math.floor(Math.random() * roasts.length)] : "Game Over!";
        roastMsgEl.innerText = msg;
    }
    showScreen('screen-over');
}

// Start the app
init();
