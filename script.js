// --- 1. GLOBAL STATE ---
let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = [];
let currentQ = null;
let score = 0;
let lives = 3;
let callsign = localStorage.getItem('stemanaceCallsign') || "";

// --- 2. STORAGE MANAGEMENT ---
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0}, global:{correct:0,total:0} };

// Fix potentially broken storage
const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => { if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 }; });

let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- 3. AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}
window.uiClick = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); playProceduralSound(600, 'sine', 0.1); };
const successSound = () => playProceduralSound(1200, 'sine', 0.2, 0.05);
const failSound = () => { playProceduralSound(100, 'sine', 0.5, 0.4); playProceduralSound(50, 'sine', 0.5, 0.4); };
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON"; };

// --- 4. IDENTITY MANAGEMENT ---
window.submitLogin = function() {
    const input = document.getElementById('callsign-input').value;
    if (input && input.trim().length > 1) {
        callsign = input.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        uiClick();
        updateHomeDashboard();
        showScreen('screen-home');
    } else { alert("INVALID_OPERATOR_ID"); }
};

window.changeCallsign = function() {
    const newName = prompt("RE-INITIALIZE IDENTITY (MAX 15 CHARS):");
    if (newName && newName.trim().length > 1) {
        callsign = newName.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard();
    }
};

// --- 5. INITIALIZATION ---
async function init() {
    allQuestions = [
        { chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] },
        { chapter: "trigonometry", q: "\\sin^2 x + \\cos^2 x", correct: "1", options: ["1", "0", "\\tan x", "-1"] }
    ];
    try {
        const res = await fetch('mathformula.txt');
        if (res.ok) {
            const text = await res.text();
            allQuestions = text.split('\n').filter(l => l.includes('::')).map(line => {
                const p = line.split('::').map(s => s.trim());
                return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
            });
        }
        const rRes = await fetch('roast.txt');
        if (rRes.ok) {
            const rText = await rRes.text();
            roasts = rText.split('\n').filter(l => l.trim() !== "");
        }
    } catch (e) { console.warn("Fetch failed, using local backup."); }

    if (!callsign) { showScreen('screen-login'); } else { updateHomeDashboard(); showScreen('screen-home'); }
}

function updateHomeDashboard() {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    set('high-score', highScore);
    set('total-drills', totalDrills);
    set('display-callsign', callsign);
    set('user-callsign', callsign);
    set('current-rank', getRankInfo(highScore).name);
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    set('global-proficiency', prof + "%");
    const pBtn = document.getElementById('priority-btn');
    if(pBtn) pBtn.style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';
}

// --- 6. NAVIGATION & GAMEPLAY ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (timerId) clearInterval(timerId);
};

window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    if(filteredQuestions.length === 0) filteredQuestions = allQuestions; 
    showScreen('screen-difficulty');
};

window.selectPriorityDrill = function() {
    const failedQs = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedQs.includes(q.q));
    showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); showScreen('screen-game'); nextRound();
};

function updateHUD() {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    set('lives', "❤️".repeat(Math.max(0, lives)));
    set('streak', score);
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');
    document.getElementById('timer-fill').style.background = "";
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
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
    if (window.MathJax) window.MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        if (bar) bar.style.width = ratio + "%";
        const eff = document.getElementById('efficiency');
        if (eff) eff.innerText = Math.max(0, Math.round(ratio)) + "%";
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
    correctHistory.global.total++;
    if (!correctHistory[currentQ.chapter]) correctHistory[currentQ.chapter] = {correct:0, total:0};
    correctHistory[currentQ.chapter].total++;
    if (isCorrect) {
        successSound(); score++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
        updateHUD(); nextRound();
    } else { handleWrong(); }
}

function handleWrong() {
    failSound(); clearInterval(timerId); lives--;
    updateHUD(); 
    const fID = currentQ ? currentQ.q : "unknown";
    formulaAnalytics[fID] = (formulaAnalytics[fID] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    if (currentQ) neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "NEURAL FAILURE.";
    document.getElementById('correction-display').innerHTML = currentQ ? `\\[ ${currentQ.correct} \\]` : "";
    document.getElementById('roast-popup').classList.remove('hidden');
    if (window.MathJax) window.MathJax.typesetPromise();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
        endGame();
    } else nextRound();
};

function endGame() {
    const rInfo = getRankInfo(score);
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    set('final-streak', score);
    const badge = document.getElementById('final-rank');
    if (badge) { badge.innerText = rInfo.name; badge.style.backgroundColor = rInfo.color; }
    const debtEl = document.getElementById('debt-list');
    if (debtEl) {
        debtEl.innerHTML = neuralDebt.length > 0 ? 
            neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="font-weight:bold">\\(${d.a}\\)</span></div>`).join('') :
            "<p>Debt clear. Brain optimal.</p>";
    }
    if (window.MathJax) window.MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

function getRankInfo(s) {
    const r = [
        { name: "CONSTANT", threshold: 0, color: "#64748b" },
        { name: "VARIABLE", threshold: 6, color: "#10b981" },
        { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
        { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
        { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
        { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
    ];
    return r.slice().reverse().find(rank => s >= rank.threshold);
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const sortedFails = Object.entries(formulaAnalytics).filter(([f, c]) => c > 0).sort(([, a], [, b]) => b - a);
    let html = `<div class="diag-summary-header"><span class="hud-label">TOTAL_RUNS</span><div class="stat-value" style="font-size:2rem; color:var(--accent)">${totalDrills}</div></div><h3 class="vault-header">NEURAL_FAIL_LOG (Sorted)</h3>`;
    if (sortedFails.length === 0) { html += `<p style="opacity:0.5">Integrity: 100%.</p>`; }
    else { sortedFails.forEach(([f, c]) => { html += `<div class="fail-log-item"><div class="fail-formula">\\(${f}\\)</div><div class="fail-count-badge"><span class="fail-number">${c}</span></div></div>`; }); }
    container.innerHTML = html;
    if (window.MathJax) window.MathJax.typesetPromise();
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => { (acc[q.chapter] = acc[q.chapter] || []).push(q); return acc; }, {});
    let html = "<p style='font-size:0.6rem; color:var(--text); margin-bottom:20px'>TAP CARDS TO REVEAL IDENTITY</p>";
    for (const c in grouped) {
        html += `<h3 class="vault-header">${c.toUpperCase()}</h3>`;
        grouped[c].forEach(q => { html += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><span class="vault-q">\\(${q.q}\\)</span><div class="vault-a">\\(${q.correct}\\)</div></div>`; });
    }
    if (list) list.innerHTML = html;
    if (window.MathJax) window.MathJax.typesetPromise();
}

window.shareResult = () => {
    const t = `STEMANACE Report: Combo ${score} // Tier [${getRankInfo(score).name}]. ${window.location.href}`;
    if (navigator.share) navigator.share({ title: 'STEMANACE', text: t, url: window.location.href }); else alert("Copied!");
};

init();
