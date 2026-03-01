let allQuestions = [], filteredQuestions = [], roasts = [], failLogs = {};
let currentQ = null, score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_callsign') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total:0, correct:0 };
let timerId = null, timeLeft = 30, isMuted = false;

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d) {
    if (isMuted) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}
window.uiClick = () => { if(audioCtx.state==='suspended') audioCtx.resume(); playSound(600, 'sine', 0.1); };
window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇" : "🔊"; };

// --- INIT ---
async function init() {
    try {
        const [fRes, rRes] = await Promise.all([
            fetch('mathformula.txt').then(r => r.text()),
            fetch('roast.txt').then(r => r.text())
        ]);
        allQuestions = fRes.split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::').map(s => s.trim());
            return { chap: p[0], q: p[1], a: p[2], opts: [p[2], p[3], p[4], p[5]] };
        });
        roasts = rRes.split('\n').filter(l => l.trim() !== "");
    } catch (e) { console.error("Data Sync Failure"); }
    
    if (!callsign) showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.dock-item').forEach(d => d.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'screen-home') updateDashboard();
    if (id === 'screen-library') populateLibrary();
    if (id === 'screen-gaps') populateGaps();
    
    const idx = { 'screen-home': 0, 'screen-library': 1, 'screen-gaps': 2 }[id];
    if (idx !== undefined) document.querySelectorAll('.dock-item')[idx].classList.add('active');
    if (window.MathJax) window.MathJax.typeset();
}

// --- IDENTITY ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_callsign', callsign);
        document.getElementById('main-dock').classList.remove('hidden');
        showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("Change Operator Identity:");
    if(n) { callsign = n.toUpperCase(); localStorage.setItem('ax_callsign', callsign); updateDashboard(); }
};

function updateDashboard() {
    document.getElementById('user-display').innerText = callsign;
    document.getElementById('best-streak').innerText = best;
    const progress = (xp % 1000) / 1000;
    document.getElementById('lvl-num').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDashoffset = 289 - (progress * 289);
    
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-pct').innerText = acc + "%";
    
    const rank = best > 50 ? "Neural Ace" : best > 20 ? "Operator" : "Constant";
    document.getElementById('current-rank').innerText = "Rank: " + rank;
    document.getElementById('priority-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
}

// --- FEATURES ---
function populateLibrary() {
    const container = document.getElementById('vault-list');
    const grouped = {};
    allQuestions.forEach(q => { if(!grouped[q.chap]) grouped[q.chap]=[]; grouped[q.chap].push(q); });
    
    container.innerHTML = Object.entries(grouped).map(([chap, qs]) => `
        <div class="vault-header">${chap}</div>
        ${qs.map(q => `
            <div class="flashcard" onclick="this.classList.toggle('active')">
                <div class="flash-q">\\( ${q.q} \\)</div>
                <div class="flash-a">\\( ${q.a} \\)</div>
            </div>
        `).join('')}
    `).join('');
    if (window.MathJax) window.MathJax.typeset();
}

function populateGaps() {
    const container = document.getElementById('logs-list');
    const sorted = Object.entries(failLogs).sort((a,b)=>b[1]-a[1]);
    container.innerHTML = sorted.map(([m, c]) => `
        <div class="stat-glass" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem">\\( ${m} \\)</div>
            <span style="color:var(--accent); font-weight:800; background:rgba(143,185,150,0.1); padding:4px 8px; border-radius:8px;">x${c}</span>
        </div>
    `).join('') || "<p class='label'>Clean Record.</p>";
    if (window.MathJax) window.MathJax.typeset();
}

// --- GAME ---
window.selectChapter = (c) => {
    filteredQuestions = allQuestions.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(failLogs);
    filteredQuestions = allQuestions.filter(q => failedIds.includes(q.q));
    showScreen('screen-difficulty');
};

window.selectDifficulty = (s) => {
    timeLeft = s; score = 0; lives = 3; timeLimit = s;
    showScreen('screen-game');
    nextRound();
};

function nextRound() {
    if (lives <= 0) {
        if (score > best) { best = score; localStorage.setItem('ax_best', best); }
        showScreen('screen-home');
        return;
    }
    currentQ = filteredQuestions[Math.floor(Math.random()*filteredQuestions.length)];
    document.getElementById('math-target').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('game-streak').innerText = score;
    document.getElementById('game-lives').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(()=>Math.random()-0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            history.total++;
            if(o === currentQ.a) { score++; xp += 25; history.correct++; playSound(1000, 'sine', 0.1); nextRound(); }
            else { handleFail(); }
            localStorage.setItem('ax_xp', xp);
            localStorage.setItem('ax_hist', JSON.stringify(history));
        };
        stack.appendChild(b);
    });
    if (window.MathJax) window.MathJax.typeset();
    startTimer();
}

function startTimer() {
    clearInterval(timerId); let cur = timeLimit;
    timerId = setInterval(() => {
        cur -= 0.1;
        document.getElementById('timer-bar').style.width = (cur/timeLimit)*100 + "%";
        if(cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    lives--; clearInterval(timerId); playSound(200, 'sawtooth', 0.3);
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    document.getElementById('roast-text').innerText = roasts[Math.floor(Math.random()*roasts.length)] || "Failed.";
    document.getElementById('math-correction').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    if (window.MathJax) window.MathJax.typeset();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
};

init();
