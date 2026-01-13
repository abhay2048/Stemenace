// --- 1. CONFIGURATION & STATE ---
let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = [];
let currentQ = null;
let score = 0;
let lives = 3;

// --- 2. DATA REPAIR SYSTEM (Prevents the 'total' of undefined error) ---
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};

let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || {};

// This ensures that even if your save data is old/broken, it gets fixed instantly
function sanitizeStorage() {
    const requiredChapters = ['global', 'calculus', 'trigonometry'];
    requiredChapters.forEach(chap => {
        if (!correctHistory[chap]) {
            correctHistory[chap] = { correct: 0, total: 0 };
        }
    });
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
}
sanitizeStorage();

let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- 3. AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = t;
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        gain.gain.setValueAtTime(v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + d);
    } catch(e) {}
}
const uiClick = () => playProceduralSound(600, 'sine', 0.1);
const failSound = () => { playProceduralSound(150, 'triangle', 0.5, 0.2); playProceduralSound(60, 'sine', 0.5, 0.3); };
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

function toggleMute() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- 4. INITIALIZATION ---
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
        console.warn("Files not found. Loading local emergency backup...");
        allQuestions = [
            { chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] },
            { chapter: "trigonometry", q: "\\sin^2 x + \\cos^2 x", correct: "1", options: ["1", "0", "\\tan x", "-1"] }
        ];
        roasts = ["Neural link unstable. Manual override required."];
    }

    updateHomeDashboard();
    showScreen('screen-home');
}

function updateHomeDashboard() {
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('total-drills').innerText = totalDrills;
    
    const getRank = (s) => {
        if (s >= 76) return "SINGULARITY";
        if (s >= 51) return "NEURAL ACE";
        if (s >= 31) return "ARCHITECT";
        if (s >= 16) return "OPERATOR";
        if (s >= 6) return "VARIABLE";
        return "CONSTANT";
    };
    document.getElementById('current-rank').innerText = getRank(highScore);
    
    // SAFE ACCESS using Optional Chaining
    const total = correctHistory?.global?.total || 0;
    const correct = correctHistory?.global?.correct || 0;
    const prof = total > 0 ? Math.round((correct / total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
}

// --- 5. NAVIGATION ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (timerId) clearInterval(timerId);
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions; 
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); 
    showScreen('screen-game'); 
    nextRound();
}

// --- 6. GAMEPLAY ---
function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');

    if (filteredQuestions.length === 0) return;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => { uiClick(); handleChoice(opt); };
        grid.appendChild(btn);
    });

    if (window.MathJax) MathJax.typesetPromise();
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
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (!currentQ) return;
    const isCorrect = (choice === currentQ.correct);
    
    // Safety: ensure chapter exists in history
    if (!correctHistory[currentQ.chapter]) {
        correctHistory[currentQ.chapter] = { correct: 0, total: 0 };
    }

    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    
    if (isCorrect) {
        score++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
        updateHUD(); 
        nextRound();
    } else {
        handleWrong();
    }
}

function handleWrong() {
    failSound(); 
    clearInterval(timerId); 
    lives--;
    
    const fID = currentQ ? currentQ.q : "unknown";
    formulaAnalytics[fID] = (formulaAnalytics[fID] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    
    if (currentQ) neuralDebt.push({ q: currentQ.q, a: currentQ.correct });

    const msg = roasts.length > 0 ? roasts[Math.floor(Math.random() * roasts.length)] : "NEURAL FAILURE.";
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = currentQ ? `\\[ ${currentQ.correct} \\]` : "";
    document.getElementById('roast-popup').classList.remove('hidden');
    if (window.MathJax) MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; 
        localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { 
            highScore = score; 
            localStorage.setItem('stemanaceHS', highScore); 
        }
        endGame();
    } else {
        nextRound();
    }
}

function endGame() {
    const rankObj = RANKS.slice().reverse().find(r => score >= r.threshold);
    document.getElementById('final-streak').innerText = score;
    const badge = document.getElementById('final-rank');
    badge.innerText = rankObj.name;
    badge.style.backgroundColor = rankObj.color;
    
    document.getElementById('debt-list').innerHTML = neuralDebt.length > 0 ? 
        neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="color:var(--text)">\\(${d.a}\\)</span></div>`).join('') :
        "<p>Neural pathways clear.</p>";
    
    if (window.MathJax) MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

const RANKS = [
    { name: "CONSTANT", threshold: 0, color: "#64748b" },
    { name: "VARIABLE", threshold: 6, color: "#10b981" },
    { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
    { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
    { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
    { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
];

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const getP = (sub) => {
        const data = correctHistory[sub];
        return (data && data.total > 0) ? Math.round((data.correct / data.total) * 100) : 0;
    };
    
    container.innerHTML = `
        <div class="diag-card"><span class="diag-title">CALCULUS_PROFICIENCY</span><div class="diag-subject">${getP('calculus')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('calculus')}%"></div></div></div>
        <div class="diag-card"><span class="diag-title">TRIG_PROFICIENCY</span><div class="diag-subject">${getP('trigonometry')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('trigonometry')}%"></div></div></div>
    `;
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => { (acc[q.chapter] = acc[q.chapter] || []).push(q); return acc; }, {});
    let html = "";
    for (const chap in grouped) {
        html += `<h3 class="vault-header">${chap.toUpperCase()}</h3>`;
        grouped[chap].forEach(q => { 
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><span class="vault-q">\\(${q.q}\\)</span><div class="vault-a">\\(${q.correct}\\)</div></div>`; 
        });
    }
    list.innerHTML = html;
    if (window.MathJax) MathJax.typesetPromise();
}

function shareResult() {
    const r = RANKS.slice().reverse().find(rank => score >= rank.threshold).name;
    const text = `SYSTEM REPORT: Streak [${score}] // Rank [${r}] on STEMANACE. Can you reach SINGULARITY? ${window.location.href}`;
    if (navigator.share) navigator.share({ title: 'STEMANACE', text: text, url: window.location.href });
    else alert("Copied: " + text);
}

init();
