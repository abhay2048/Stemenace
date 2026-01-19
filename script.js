// --- STATE & STORAGE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global: {correct:0, total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLeft = 30, isMuted = false, currentDifficulty = 30;

// --- INITIALIZATION ---
async function init() {
    // Force initial screen state to prevent "Flatlined" showing first
    showScreen('screen-login');

    try {
        // Fetch Formulas
        const fRes = await fetch('mathformula.txt');
        if (fRes.ok) {
            const text = await fRes.text();
            allQuestions = text.split('\n').filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }
        // Fetch Roasts
        const rRes = await fetch('roast.txt');
        if (rRes.ok) roasts = (await rRes.text()).split('\n').filter(l => l.trim().length > 0);
    } catch (e) { console.error("Session initialization failure:", e); }

    if (callsign) {
        updateHomeDashboard();
        showScreen('screen-home');
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function updateHomeDashboard() {
    const r = highScore > 50 ? "SINGULARITY" : highScore > 25 ? "NEURAL ACE" : "CONSTANT";
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;

    // Home Screen
    document.getElementById('user-callsign').innerText = callsign || "---";
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('current-rank').innerText = r;
    document.getElementById('global-proficiency').innerText = prof + "%";

    // Sidebar
    document.getElementById('side-high-score').innerText = highScore;
    document.getElementById('side-proficiency').innerText = prof + "%";
    document.getElementById('side-rank').innerText = r;

    updateAchievementRack();
}

function updateAchievementRack() {
    const medals = [{ id: 'titan', icon: '💎' }, { id: 'survivor', icon: '🛡️' }, { id: 'singularity', icon: '🌌' }];
    const html = medals.map(m => `<div class="medal ${achievements[m.id] ? 'unlocked' : ''}" style="filter: drop-shadow(0 2px 5px var(--shadow))">${m.icon}</div>`).join('');
    document.getElementById('achievement-rack').innerHTML = html;
    document.getElementById('side-achievement-rack').innerHTML = html;
}

// --- GAMEPLAY CORE ---
function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter === chap);
    showScreen('screen-difficulty');
}

function selectDifficulty(time) {
    currentDifficulty = time;
    startSession();
}

function startSession() {
    score = 0; lives = 3; neuralDebt = [];
    showScreen('screen-game');
    nextRound();
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    // Formula Chamber Scaling
    const display = document.getElementById('formula-display');
    display.innerHTML = `\\[ ${currentQ.q} \\]`;
    display.style.fontSize = currentQ.q.length > 40 ? '0.9rem' : '1.3rem';

    // 2x2 Tactic Grid
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    window.MathJax.typesetPromise();
    timeLeft = currentDifficulty;
    resetTimer();
}

function resetTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-fill').style.width = (timeLeft / currentDifficulty * 100) + "%";
        if (timeLeft <= 0) handleChoice(null);
    }, 100);
}

function handleChoice(choice) {
    clearInterval(timerId);
    if (choice === currentQ.correct) {
        score++;
        updateCorrectStats(true);
        nextRound();
    } else {
        lives--;
        neuralDebt.push(currentQ);
        updateCorrectStats(false);
        trackFailure(currentQ.q);
        showRoast();
    }
}

function trackFailure(formula) {
    if (!formulaAnalytics[formula]) formulaAnalytics[formula] = 0;
    formulaAnalytics[formula]++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
}

function showRoast() {
    const msg = roasts[Math.floor(Math.random() * roasts.length)];
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
}

function endGame() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('stemanaceHS', highScore);
    }
    document.getElementById('final-streak').innerText = score;
    renderDebtList();
    showScreen('screen-over');
    updateHomeDashboard();
}

function renderDebtList() {
    const list = document.getElementById('debt-list');
    list.innerHTML = neuralDebt.map(q => `
        <div class="debt-card">
            <div class="debt-q">\\[ ${q.q} \\]</div>
            <div class="debt-a">\\[ ${q.correct} \\]</div>
        </div>
    `).join('');
    window.MathJax.typesetPromise();
}

function updateCorrectStats(isCorrect) {
    correctHistory.global.total++;
    if (isCorrect) correctHistory.global.correct++;
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
}

function submitLogin() {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val;
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard();
        showScreen('screen-home');
    }
}

window.onload = init;
