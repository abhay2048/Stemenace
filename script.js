// --- CONFIG & STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global:{correct:0,total:0}, calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

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
window.uiClick = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); playSound(600, 'sine', 0.1); if(navigator.vibrate) navigator.vibrate(5); };
const failSound = () => { playSound(100, 'sine', 0.4, 0.3); playSound(50, 'sine', 0.4, 0.3); };
const successSound = () => playSound(1200, 'sine', 0.15, 0.1);

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO: OFF" : "🔊 AUDIO: ON"; };

// --- IDENTITY & XP ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard(); showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("ENTER NEW CALLSIGN:");
    if(n) { callsign = n.toUpperCase(); localStorage.setItem('stemanaceCallsign', callsign); updateHomeDashboard(); }
};

function addXP(amt) {
    xp += amt;
    localStorage.setItem('stemanaceXP', xp);
    updateXPBar();
}

function updateXPBar() {
    const level = Math.floor(xp / 1000) + 1;
    const prog = (xp % 1000) / 10;
    document.getElementById('level-display').innerText = `LVL ${level}`;
    document.getElementById('xp-fill').style.width = prog + "%";
}

// --- CORE ENGINE ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (id === 'screen-home') updateHomeDashboard();
};

window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedIds.indexOf(q.q) !== -1);
    showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); showScreen('screen-game'); nextRound();
};

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('panic-overlay').classList.add('hidden');
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    let opts = [...currentQ.options].sort(() => 0.5 - Math.random());
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
        bar.style.width = ratio + "%";
        document.getElementById('efficiency').innerText = Math.max(0, Math.round(ratio)) + "%";
        
        if (timeLeft < 3) {
            document.getElementById('panic-overlay').classList.remove('hidden');
            if (Math.floor(timeLeft * 10) % 2 === 0) playSound(1800, 'sine', 0.05, 0.02);
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        const xpEarned = Math.round(10 + (timeLeft * 2));
        score++; addXP(xpEarned); successSound();
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        if (score % 10 === 0 && lives < 3) lives++;
        updateHUD(); nextRound();
    } else handleWrong();
}

function handleWrong() {
    lives--; clearInterval(timerId); failSound();
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "FATAL_ERROR";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
};

function endGame() {
    totalDrills++; localStorage.setItem('stemanaceDrills', totalDrills);
    if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
    
    document.getElementById('final-streak').innerText = score;
    document.getElementById('xp-gained').innerText = `+${score * 5}`;
    const rank = score > 50 ? "NEURAL ACE" : score > 20 ? "OPERATOR" : "CONSTANT";
    document.getElementById('final-rank-badge').innerText = rank;
    
    const dList = document.getElementById('debt-list');
    dList.innerHTML = neuralDebt.length > 0 ? "<h3>REVISION_REQUIRED</h3>" : "";
    dList.innerHTML += neuralDebt.map(d => `<div class="vault-card"><small>\\(${d.q}\\)</small><br><b>\\(${d.a}\\)</b></div>`).join('');
    
    window.MathJax.typesetPromise();
    showScreen('screen-over');
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function updateHomeDashboard() {
    document.getElementById('user-callsign').innerText = callsign;
    document.getElementById('high-score').innerText = highScore;
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
    
    const rank = highScore > 50 ? "NEURAL ACE" : highScore > 20 ? "OPERATOR" : "CONSTANT";
    document.getElementById('current-rank').innerText = "RANK: " + rank;
    
    document.getElementById('priority-btn').style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';
    updateXPBar();
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const sorted = Object.entries(formulaAnalytics).sort(([, a], [, b]) => b - a);
    container.innerHTML = sorted.map(([f, c]) => `
        <div class="fail-log-item">
            <div class="fail-formula">\\(${f}\\)</div>
            <div class="fail-count-badge">${c} FAILS</div>
        </div>
    `).join('') || "<p>All systems nominal.</p>";
    window.MathJax.typesetPromise();
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = {};
    allQuestions.forEach(q => { if(!grouped[q.chapter]) grouped[q.chapter] = []; grouped[q.chapter].push(q); });
    let html = "";
    for (const c in grouped) {
        html += `<h3 class="vault-header">${c.toUpperCase()}</h3>`;
        grouped[c].forEach(q => { 
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed')">
                <div class="vault-q">\\(${q.q}\\)</div>
                <div class="vault-a">\\(${q.correct}\\)</div>
            </div>`; 
        });
    }
    list.innerHTML = html;
    window.MathJax.typesetPromise();
}

async function init() {
    try {
        const [fRes, rRes] = await Promise.all([fetch('mathformula.txt'), fetch('roast.txt')]);
        if (fRes.ok) {
            const lines = (await fRes.text()).split('\n');
            allQuestions = lines.filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }
        if (rRes.ok) roasts = (await rRes.text()).split('\n').filter(l => l.trim() !== "");
    } catch (e) { console.error("Boot error", e); }
    
    if (!callsign) showScreen('screen-login'); else showScreen('screen-home');
}
init();
