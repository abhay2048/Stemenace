// --- COMPLETE STATE & STORAGE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0}, global:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

// Ensure History Integrity
const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => { if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 }; });

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}
window.uiClick = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); playSound(600, 'sine', 0.1); };
const failSound = () => { playSound(100, 'sine', 0.4, 0.3); playSound(50, 'sine', 0.4, 0.3); };
const successSound = () => playSound(1200, 'sine', 0.2, 0.05);
const tickSound = () => playSound(1800, 'sine', 0.05, 0.02);

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 OFF" : "🔊 ON"; };

// --- IDENTITY ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard(); showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("ENTER CALLSIGN:");
    if(n) { callsign = n.toUpperCase(); localStorage.setItem('stemanaceCallsign', callsign); updateHomeDashboard(); }
};

// --- CORE LOGIC ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
};

window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    window.showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedIds.indexOf(q.q) !== -1);
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); window.showScreen('screen-game'); nextRound();
};

function updateHUD() {
    const lEl = document.getElementById('lives'), sEl = document.getElementById('streak');
    if(lEl) lEl.innerText = "❤️".repeat(Math.max(0, lives));
    if(sEl) sEl.innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('.arena-screen')?.classList.remove('panic');
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    let opts = JSON.parse(JSON.stringify(currentQ.options)).sort(() => 0.5 - Math.random());
    opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });
    window.MathJax.typesetPromise();
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
            document.querySelector('.arena-screen')?.classList.add('panic'); 
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) { 
        score++; successSound();
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        if (score % 10 === 0 && lives < 3) lives++;
        checkAchievements(); updateHUD(); nextRound(); 
    }
    else handleWrong();
}

function handleWrong() {
    lives--; updateHUD(); clearInterval(timerId); failSound();
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "FAILURE";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
        endGame();
    } else nextRound();
};

function checkAchievements() {
    if (score >= 76) achievements.singularity = true;
    if (currentQ.chapter === 'calculus' && score >= 20) achievements.titan = true;
    if (lives === 1 && score >= 15) achievements.survivor = true;
    localStorage.setItem('stemanaceMedals', JSON.stringify(achievements));
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    const badge = document.getElementById('final-rank-badge');
    const r = score > 75 ? "SINGULARITY" : score > 50 ? "NEURAL ACE" : score > 30 ? "ARCHITECT" : score > 15 ? "OPERATOR" : score > 5 ? "VARIABLE" : "CONSTANT";
    if(badge) badge.innerText = r;
    const dList = document.getElementById('debt-list');
    if(dList) dList.innerHTML = neuralDebt.map(d => `<div style="margin-bottom:10px; border-bottom:1px solid var(--primary)">\\(${d.q}\\) → <b>\\(${d.a}\\)</b></div>`).join('');
    window.MathJax.typesetPromise();
    window.showScreen('screen-over');
    updateHomeDashboard();
}

function updateHomeDashboard() {
    const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    const r = highScore > 50 ? "SINGULARITY" : highScore > 25 ? "NEURAL ACE" : highScore > 10 ? "OPERATOR" : "CONSTANT";
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;

    // Update Main Home Screen
    safeSet('high-score', highScore);
    safeSet('user-callsign', callsign || '---');
    safeSet('current-rank', r);

    // Update Nexus Sidebar
    safeSet('side-high-score', highScore);
    safeSet('side-proficiency', prof + "%");
    safeSet('side-rank', r);

    updateAchievementRack();
}
function updateAchievementRack() {
    const medals = [{ id: 'titan', icon: '💎' }, { id: 'survivor', icon: '🛡️' }, { id: 'singularity', icon: '🌌' }];
    const html = medals.map(m => `<div class="medal ${achievements[m.id] ? 'unlocked' : ''}">${m.icon}</div>`).join('');
    
    const rack = document.getElementById('achievement-rack');
    const sideRack = document.getElementById('side-achievement-rack');
    if (rack) rack.innerHTML = html;
    if (sideRack) sideRack.innerHTML = html;
}
function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const sortedFails = Object.entries(formulaAnalytics).filter(([f, c]) => c > 0).sort(([, a], [, b]) => b - a);
    let html = `<div class="diag-summary-header"><span style="font-size:0.6rem; font-weight:900; letter-spacing:1px;">TOTAL_ARENA_RUNS</span><div style="font-size:2rem; font-weight:900;">${totalDrills}</div></div><h3 class="vault-header">NEURAL_FAIL_LOG</h3>`;
    if (sortedFails.length === 0) html += `<p>Cognitive integrity: 100%.</p>`;
    else sortedFails.forEach(([f, c]) => { html += `<div class="fail-log-item"><div class="fail-formula">\\(${f}\\)</div><div class="fail-count-badge"><span class="fail-number">${c}</span><span style="font-size:0.4rem; font-weight:900;">FAILS</span></div></div>`; });
    container.innerHTML = html;
    window.MathJax.typesetPromise();
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = {};
    allQuestions.forEach(q => { if(!grouped[q.chapter]) grouped[q.chapter] = []; grouped[q.chapter].push(q); });
    let html = "<p style='font-size:0.6rem; color:var(--text); margin-bottom:20px'>TAP CARDS TO REVEAL IDENTITY</p>";
    for (const c in grouped) {
        html += `<h3 class="vault-header">${c.toUpperCase()}</h3>`;
        grouped[c].forEach(q => { html += `<div class="vault-card" onclick="this.classList.toggle('revealed'); window.uiClick();"><div class="vault-q">\\(${q.q}\\)</div><div class="vault-a">\\(${q.correct}\\)</div></div>`; });
    }
    if (list) list.innerHTML = html;
    window.MathJax.typesetPromise();
}

window.shareResult = () => {
    const text = `SYSTEM REPORT: I cleared STEMANACE Arena with a streak of ${score}.\nCan you beat me? ${window.location.href}`;
    if (navigator.share) navigator.share({ title: 'STEMANACE', text: text, url: window.location.href }); else alert("Copied!");
};

async function init() {
    // 1. Force screen to Login on load
    showScreen('screen-login');
    
    // 2. Load Formulas
    try {
        const res = await fetch('mathformula.txt');
        if (res.ok) {
            const text = await res.text();
            allQuestions = parseFormulas(text);
        }
    } catch (e) { console.error("Formula Load Error", e); }

    // 3. Load Roasts
    try {
        const res = await fetch('roast.txt');
        if (res.ok) {
            const text = await res.text();
            roasts = text.split('\n').filter(l => l.trim().length > 0);
        }
    } catch (e) { console.error("Roast Load Error", e); }

    updateHomeDashboard();
}
init();


