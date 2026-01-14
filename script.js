// --- 1. GLOBAL STATE (Declared ONCE) ---
let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = [];
let currentQ = null;
let score = 0;
let lives = 3;

// --- 2. PERMANENT STORAGE & DATA REPAIR ---
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || {};

// Ensure memory structure is perfect
const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => {
    if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 };
});

let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- 3. AUDIO ENGINE (Procedural Thud & Click) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}

// These are called by HTML onclicks
window.uiClick = function() { 
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playProceduralSound(600, 'sine', 0.1); 
};
const successSound = () => playProceduralSound(1200, 'sine', 0.2, 0.05);
const failSound = () => {
    playProceduralSound(100, 'sine', 0.5, 0.4); // The deep thud
    playProceduralSound(50, 'sine', 0.5, 0.4);
};
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

window.toggleMute = function() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
};

// --- 4. INITIALIZATION ---
async function init() {
    // Default backup content
    allQuestions = [
        { chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] },
        { chapter: "trigonometry", q: "\\sin^2 x + \\cos^2 x", correct: "1", options: ["1", "0", "\\tan x", "-1"] }
    ];
    roasts = ["Neural drift identified.", "Pattern mismatch detected.", "Inefficiency levels rising."];

    try {
        const res = await fetch('mathformula.txt');
        if (res.ok) {
            const text = await res.text();
            const parsed = text.split('\n').filter(l => l.includes('::')).map(line => {
                const p = line.split('::').map(s => s.trim());
                return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
            });
            if (parsed.length > 0) allQuestions = parsed;
        }
        const rRes = await fetch('roast.txt');
        if (rRes.ok) {
            const rText = await rRes.text();
            const rParsed = rText.split('\n').filter(l => l.trim() !== "");
            if (rParsed.length > 0) roasts = rParsed;
        }
    } catch (e) { console.warn("Using Neural Backup."); }

    updateHomeDashboard();
    showScreen('screen-home');
}

window.showScreen = function(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (timerId) clearInterval(timerId);
};

window.selectChapter = function(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    if(filteredQuestions.length === 0) filteredQuestions = allQuestions; 
    showScreen('screen-difficulty');
};

window.selectDifficulty = function(sec) {
    timeLimit = sec;
    lives = 3; // Reset lives for new game
    score = 0;
    neuralDebt = [];
    updateHUD();
    showScreen('screen-game');
    nextRound();
};

// --- 5. GAMEPLAY LOGIC ---
function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');
    document.getElementById('timer-fill').style.background = "";

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
        const ratio = (timeLeft / timeLimit) * 100;
        bar.style.width = ratio + "%";
        document.getElementById('efficiency').innerText = Math.round(ratio) + "%";

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
    const isCorrect = (choice === currentQ.correct);
    if (!correctHistory[currentQ.chapter]) correctHistory[currentQ.chapter] = { correct: 0, total: 0 };
    
    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;

    if (isCorrect) {
        successSound();
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
    lives--; // Life removed
    updateHUD();

    const fID = currentQ ? currentQ.q : "unknown";
    formulaAnalytics[fID] = (formulaAnalytics[fID] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });

    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "NEURAL_ERROR";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    MathJax.typesetPromise();
}

window.resumeAfterRoast = function() {
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
};

function endGame() {
    const rankObj = getRankInfo(score);
    document.getElementById('final-streak').innerText = score;
    const badge = document.getElementById('final-rank');
    badge.innerText = rankObj.name;
    badge.style.backgroundColor = rankObj.color;
    
    document.getElementById('debt-list').innerHTML = neuralDebt.length > 0 ? 
        neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="font-weight:bold">\\(${d.a}\\)</span></div>`).join('') :
        "<p>No debt incurred.</p>";
    
    MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

// --- 6. RANKING & UTILS ---
const RANKS = [
    { name: "CONSTANT", threshold: 0, color: "#64748b" },
    { name: "VARIABLE", threshold: 6, color: "#10b981" },
    { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
    { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
    { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
    { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
];
function getRankInfo(s) { return [...RANKS].reverse().find(r => s >= r.threshold); }

function updateHomeDashboard() {
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('total-drills').innerText = totalDrills;
    document.getElementById('current-rank').innerText = getRankInfo(highScore).name;
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const getP = (sub) => (correctHistory[sub] && correctHistory[sub].total > 0) ? Math.round((correctHistory[sub].correct / correctHistory[sub].total) * 100) : 0;
    container.innerHTML = `
        <div class="diag-card"><span class="diag-title">CALCULUS_STABILITY</span><div class="diag-subject">${getP('calculus')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('calculus')}%"></div></div></div>
        <div class="diag-card"><span class="diag-title">TRIG_STABILITY</span><div class="diag-subject">${getP('trigonometry')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('trigonometry')}%"></div></div></div>
    `;
    MathJax.typesetPromise();
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => { (acc[q.chapter] = acc[q.chapter] || []).push(q); return acc; }, {});
    let html = "<p style='font-size:0.65rem; color:var(--accent); margin-bottom:20px; font-weight:bold'>CLICK TO REVEAL IDENTITY</p>";
    for (const chap in grouped) {
        html += `<h3 class="vault-header">${chap.toUpperCase()}</h3>`;
        grouped[chap].forEach(q => { 
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><span class="vault-q">\\(${q.q}\\)</span><div class="vault-a">\\(${q.correct}\\)</div></div>`; 
        });
    }
    list.innerHTML = html;
    MathJax.typesetPromise();
}

window.shareResult = function() {
    const text = `SYSTEM REPORT: Streak [${score}] on STEMANACE Arena. Can you reach SINGULARITY? ${window.location.href}`;
    if (navigator.share) navigator.share({ title: 'STEMANACE', text: text, url: window.location.href });
    else alert("Copied!");
};

init();
