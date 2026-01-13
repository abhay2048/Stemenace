let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('stemanaceHS') || 0;
let totalDrills = localStorage.getItem('stemanaceDrills') || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};

// SAFER HISTORY INITIALIZATION
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { 
    calculus: { correct: 0, total: 0 }, 
    trigonometry: { correct: 0, total: 0 },
    global: { correct: 0, total: 0 } 
};

let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}
const uiClick = () => playProceduralSound(600, 'sine', 0.1);
const successSound = () => playProceduralSound(1200, 'sine', 0.2, 0.05);
const failSound = () => { playProceduralSound(150, 'triangle', 0.5, 0.2); playProceduralSound(60, 'sine', 0.5, 0.3); };
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- INIT WITH BACKUP DATA ---
async function init() {
    try {
        const res = await fetch('mathformula.txt');
        if (!res.ok) throw new Error("404");
        const text = await res.text();
        allQuestions = text.split('\n').filter(l => l.includes('::')).map(line => {
            const p = line.split('::').map(s => s.trim());
            return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

    } catch (e) {
        console.warn("Database files not found on server. Loading internal backup...");
        // BACKUP DATA SO IT NEVER CRASHES
        allQuestions = [
            { chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "\\frac{x^n}{n}"] },
            { chapter: "trigonometry", q: "\\sin^2 x + \\cos^2 x", correct: "1", options: ["1", "0", "\\sec^2 x", "\\sin 2x"] }
        ];
        roasts = ["Neural link unstable.", "Data corruption detected.", "Inefficiency identified."];
    }

    updateHomeDashboard();
    showScreen('screen-home');
}

function updateHomeDashboard() {
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('total-drills').innerText = totalDrills;
    
    // Safety check for Ranks
    const rankName = (score) => {
        if (score >= 76) return "SINGULARITY";
        if (score >= 51) return "NEURAL ACE";
        if (score >= 31) return "ARCHITECT";
        if (score >= 16) return "OPERATOR";
        if (score >= 6) return "VARIABLE";
        return "CONSTANT";
    };
    document.getElementById('current-rank').innerText = rankName(highScore);
    
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (timerId) clearInterval(timerId);
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    if(filteredQuestions.length === 0) filteredQuestions = allQuestions; // Failsafe
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); showScreen('screen-game'); nextRound();
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');
    document.getElementById('timer-fill').style.background = "";

    if (filteredQuestions.length === 0) return;
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
    if(window.MathJax) MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        bar.style.width = ratio + "%";
        document.getElementById('efficiency').innerText = Math.max(0, Math.round(ratio)) + "%";
        if (timeLeft < 3) {
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            document.getElementById('red-alert').classList.remove('hidden');
            document.querySelector('#screen-game').classList.add('panic');
            bar.style.background = "var(--text)";
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (!currentQ) return;
    const isCorrect = (choice === currentQ.correct);
    
    // FIX: AUTO-CREATE CHAPTER IF MISSING IN HISTORY
    if (!correctHistory[currentQ.chapter]) {
        correctHistory[currentQ.chapter] = { correct: 0, total: 0 };
    }

    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    
    if (isCorrect) {
        successSound(); score++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
        updateHUD(); nextRound();
    } else {
        handleWrong();
    }
}

function handleWrong() {
    failSound(); clearInterval(timerId); lives--;
    const fID = currentQ ? currentQ.q : "Unknown";
    formulaAnalytics[fID] = (formulaAnalytics[fID] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    
    if (currentQ) neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    
    const msg = roasts.length > 0 ? roasts[Math.floor(Math.random() * roasts.length)] : "FAILED.";
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = currentQ ? `\\[ ${currentQ.correct} \\]` : "";
    document.getElementById('roast-popup').classList.remove('hidden');
    if(window.MathJax) MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
        endGame();
    } else nextRound();
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    document.getElementById('debt-list').innerHTML = neuralDebt.length > 0 ? 
        neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="color:var(--accent)">\\(${d.a}\\)</span></div>`).join('') :
        "<p>No debt.</p>";
    if(window.MathJax) MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const getP = (sub) => (correctHistory[sub] && correctHistory[sub].total > 0) ? Math.round((correctHistory[sub].correct / correctHistory[sub].total) * 100) : 0;
    
    const sortedFails = Object.entries(formulaAnalytics).sort(([,a], [,b]) => b - a).slice(0, 3);

    container.innerHTML = `
        <div class="diag-card"><span class="diag-title">CALCULUS_PROFICIENCY</span><div class="diag-subject">${getP('calculus')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('calculus')}%"></div></div></div>
        <div class="diag-card"><span class="diag-title">TRIG_PROFICIENCY</span><div class="diag-subject">${getP('trigonometry')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('trigonometry')}%"></div></div></div>
    `;
    if(window.MathJax) MathJax.typesetPromise();
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => { (acc[q.chapter] = acc[q.chapter] || []).push(q); return acc; }, {});
    let html = "";
    for (const chap in grouped) {
        html += `<h3 class="vault-header">${chap.toUpperCase()}</h3>`;
        grouped[chap].forEach(q => { html += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><span class="vault-q">\\(${q.q}\\)</span><div class="vault-a">\\(${q.correct}\\)</div></div>`; });
    }
    list.innerHTML = html;
    if(window.MathJax) MathJax.typesetPromise();
}

function shareResult() {
    const text = `I cleared STEMANACE with a streak of ${score}! Can you beat me? ${window.location.href}`;
    navigator.share ? navigator.share({ title: 'STEMANACE', text: text, url: window.location.href }) : alert("Copied!");
}

init();
