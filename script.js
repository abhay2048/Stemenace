// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSystemSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'click') {
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.4);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'tick') {
        osc.frequency.setValueAtTime(2500, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    }
}

// Global Click Sound
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        playSystemSound('click');
        if(navigator.vibrate) navigator.vibrate(8);
    }
});

// --- STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global:{correct:0,total:0}, calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0} };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

const triggerMath = () => { if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise().catch(() => {}); };

// --- LOGIC ---
window.submitLogin = () => {
    const v = document.getElementById('callsign-input').value.trim().toUpperCase();
    if (v.length > 1) { callsign = v; localStorage.setItem('stemanaceCallsign', v); showScreen('screen-home'); }
};

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "AUDIO: OFF" : "AUDIO: ON"; };

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-home') updateHome();
    if (id === 'screen-learn') populateVault();
    if (id === 'screen-diagnostics') populateLogs();
};

function updateHome() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    const p = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = p + "%";
    document.getElementById('level-display').innerText = `LVL ${Math.floor(xp / 1000) + 1}`;
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
    document.getElementById('priority-btn').classList.toggle('hidden', Object.keys(formulaAnalytics).length === 0);
}

window.selectChapter = (c) => { filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === c); showScreen('screen-difficulty'); };
window.selectPriorityDrill = () => {
    const ids = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => ids.includes(q.q));
    showScreen('screen-difficulty');
};

window.selectDifficulty = (s) => { timeLimit = s; lives = 3; score = 0; neuralDebt = []; updateHUD(); showScreen('screen-game'); nextRound(); };

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('panic-overlay').classList.add('hidden');
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid'); grid.innerHTML = "";
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(o => {
        const b = document.createElement('button'); b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`; b.onclick = () => handleChoice(o);
        grid.appendChild(b);
    });
    triggerMath(); resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1; bar.style.width = (timeLeft / timeLimit) * 100 + "%";
        if (timeLeft <= 3 && timeLeft > 0) { if (Math.round(timeLeft * 10) % 5 === 0) playSystemSound('tick'); document.getElementById('panic-overlay').classList.remove('hidden'); }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(c) {
    if (c === currentQ.correct) {
        playSystemSound('success'); score++; xp += 25;
        correctHistory.global.correct++; correctHistory[currentQ.chapter].correct++;
        updateHUD(); nextRound();
    } else handleWrong();
}

function handleWrong() {
    lives--; clearInterval(timerId); playSystemSound('fail');
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++; correctHistory[currentQ.chapter].total++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "SYNC_ERROR";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMath();
}

window.resumeAfterRoast = () => { document.getElementById('roast-popup').classList.add('hidden'); if (lives <= 0) endGame(); else nextRound(); };

function endGame() {
    if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
    localStorage.setItem('stemanaceXP', xp);
    document.getElementById('final-streak').innerText = score;
    document.getElementById('debt-list').innerHTML = neuralDebt.map(d => `<div class="vault-card" style="font-size:0.7rem">\\(${d.q}\\) → <b>\\(${d.a}\\)</b></div>`).join('');
    triggerMath(); showScreen('screen-over');
}

function updateHUD() { document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives)); document.getElementById('streak').innerText = score; }

function populateVault() {
    const l = document.getElementById('vault-content'); l.innerHTML = "";
    const groups = {}; allQuestions.forEach(q => { if(!groups[q.chapter]) groups[q.chapter] = []; groups[q.chapter].push(q); });
    for (const c in groups) {
        l.innerHTML += `<h3 class="label" style="margin:20px 0 10px">${c.toUpperCase()}</h3>`;
        groups[c].forEach(q => { l.innerHTML += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><div class="vault-q">\\(${q.q}\\)</div><div class="vault-a">\\(${q.correct}\\)</div></div>`; });
    }
    triggerMath();
}

function populateLogs() {
    const c = document.getElementById('diagnostic-results');
    const s = Object.entries(formulaAnalytics).sort(([,a],[,b])=>b-a);
    c.innerHTML = s.map(([f,co]) => `<div class="fail-log-item"><div class="fail-formula">\\(${f}\\)</div><div class="fail-count-badge">${co}</div></div>`).join('') || "<p class='label'>CLEAN_LOGS</p>";
    triggerMath();
}

async function init() {
    try {
        const [fR, rR] = await Promise.all([fetch('mathformula.txt'), fetch('roast.txt')]);
        if (fR.ok) allQuestions = (await fR.text()).split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::'); return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
        });
        if (rR.ok) roasts = (await rR.text()).split('\n').filter(l => l.trim() !== "");
    } catch(e) {}
    if (allQuestions.length === 0) allQuestions = [{chapter:"SYS", q:"1+1", correct:"2", options:["2","3","4","5"]}];
    if (!callsign) showScreen('screen-login'); else showScreen('screen-home');
}
init();
