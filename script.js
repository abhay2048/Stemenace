let allQuestions = [], filteredQuestions = [], roasts = [], failLogs = {};
let currentQ = null, score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_callsign') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30, isMuted = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d) {
    if (isMuted) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}

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
    } catch (e) { console.error("Sync Failed"); }
    
    if (!callsign) showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'screen-home') { updateDashboard(); document.querySelectorAll('.dock-tab')[0].classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); document.querySelectorAll('.dock-tab')[1].classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.querySelectorAll('.dock-tab')[2].classList.add('active'); }
    if (window.MathJax) window.MathJax.typeset();
}

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_callsign', callsign);
        document.getElementById('main-dock').classList.remove('hidden');
        showScreen('screen-home');
    }
};

function updateDashboard() {
    document.getElementById('user-display').innerText = callsign;
    document.getElementById('best-streak').innerText = best;
    const level = Math.floor(xp / 1000) + 1;
    const progress = (xp % 1000) / 1000;
    document.getElementById('lvl-display').innerText = level;
    document.getElementById('xp-ring').style.strokeDashoffset = 283 - (progress * 283);
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
    document.getElementById('user-rank').innerText = "Rank: " + (best > 50 ? "Ace" : best > 20 ? "Operator" : "Constant");
}

window.selectSubject = (sub) => {
    filteredQuestions = allQuestions.filter(q => q.chap.toLowerCase() === sub.toLowerCase());
    showScreen('screen-difficulty');
};

window.setDifficulty = (sec) => {
    timeLimit = sec; score = 0; lives = 3;
    showScreen('screen-game');
    nextRound();
};

function nextRound() {
    if (lives <= 0) {
        if (score > best) { best = score; localStorage.setItem('ax_best', best); }
        showScreen('screen-home');
        return;
    }
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak-display').innerText = score;
    document.getElementById('lives-display').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { score++; xp += 20; history.correct++; playSound(800, 'sine', 0.1); nextRound(); }
            else handleFail();
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
        document.getElementById('timer-bar').style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    lives--; clearInterval(timerId); playSound(200, 'sawtooth', 0.2);
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Try Again.";
    document.getElementById('correct-formula-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    if (window.MathJax) window.MathJax.typeset();
}

window.resumeGame = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
};

function populateVault() {
    const cont = document.getElementById('vault-content');
    cont.innerHTML = allQuestions.map(q => `
        <div class="flashcard" onclick="const a = this.querySelector('.flash-a'); a.style.display = a.style.display === 'block' ? 'none' : 'block';">
            <div style="font-weight:600">\\( ${q.q} \\)</div>
            <div class="flash-a">\\( ${q.a} \\)</div>
        </div>
    `).join('');
    if (window.MathJax) window.MathJax.typeset();
}

function populateLogs() {
    const cont = document.getElementById('logs-content');
    cont.innerHTML = Object.entries(failLogs).map(([q, c]) => `
        <div class="stat-card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem">\\( ${q} \\)</div>
            <span style="color:var(--accent); font-weight:800">x${c}</span>
        </div>
    `).join('') || "<p class='label'>No Gaps Logged</p>";
    if (window.MathJax) window.MathJax.typeset();
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQuestions = allQuestions.filter(q => bad.includes(q.q));
    showScreen('screen-difficulty');
};

init();
