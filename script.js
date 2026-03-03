let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, integrity = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => {});
    }
}

async function init() {
    try {
        const [fRes, rRes] = await Promise.all([
            fetch('mathformula.txt').then(r => r.text()),
            fetch('roast.txt').then(r => r.text())
        ]);
        allQ = fRes.split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::').map(s => s.trim());
            return { chap: p[0], q: p[1], a: p[2], opts: [p[2], p[3], p[4], p[5]] };
        });
        roasts = rRes.split('\n').filter(l => l.trim() !== "");
    } catch (e) { console.error("Database inaccessible."); }
    
    if (callsign) {
        document.getElementById('screen-login').classList.add('hidden');
        window.showScreen('screen-home');
    }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    const tabs = document.querySelectorAll('.nav-tab');
    if (id === 'screen-home') { tabs[0].classList.add('active'); updateDash(); document.getElementById('main-nav').classList.remove('hidden'); }
    if (id === 'screen-vault') { tabs[1].classList.add('active'); populateVault(); }
    if (id === 'screen-logs') { tabs[2].classList.add('active'); populateLogs(); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        document.getElementById('screen-login').classList.add('hidden');
        window.showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    const level = Math.floor(xp / 1000) + 1;
    const progress = (xp % 1000) / 1000;
    document.getElementById('level-val').innerText = level;
    document.getElementById('xp-ring').style.strokeDashoffset = 283 - (progress * 283);
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').classList.toggle('hidden', Object.keys(failLogs).length === 0);
}

window.selectChapter = (c) => {
    filteredQ = allQ.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    score = 0; integrity = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    window.showScreen('screen-game');
    document.getElementById('main-nav').classList.add('hidden'); // Immersive mode
    nextRound();
};

function nextRound() {
    clearInterval(timerId);
    if (integrity <= 0 || sessionQueue.length === 0) {
        if (score > best) { best = score; localStorage.setItem('ax_best', best); }
        window.showScreen('screen-home');
        return;
    }
    currentQ = sessionQueue[0];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "I".repeat(integrity);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { 
                score++; xp += 25; history.correct++; 
                sessionQueue.shift(); nextRound(); 
            } else handleFail();
            localStorage.setItem('ax_xp', xp); localStorage.setItem('ax_hist', JSON.stringify(history));
        };
        stack.appendChild(b);
    });
    safeTypeset();
    startTimer();
}

function startTimer() {
    let cur = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        cur -= 0.1;
        bar.style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    clearInterval(timerId);
    integrity--;
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    const failedQ = sessionQueue.shift(); sessionQueue.push(failedQ);
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Try harder.";
    document.getElementById('correct-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

window.closeRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
};

function populateVault() {
    const cont = document.getElementById('vault-list');
    cont.innerHTML = allQ.map(q => `
        <div class="stat-item" style="margin-bottom:12px">
            <small class="label">${q.chap}</small>
            <div style="font-size:1.1rem; margin-top:8px">\\( ${q.q} = ${q.a} \\)</div>
        </div>
    `).join('');
    safeTypeset();
}

function populateLogs() {
    const cont = document.getElementById('logs-list');
    cont.innerHTML = Object.entries(failLogs).map(([q, c]) => `
        <div class="stat-item" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.9rem">\\( ${q} \\)</div>
            <div class="label" style="color:var(--accent)">${c}x Gaps</div>
        </div>
    `).join('') || "<p class='label' style='padding:40px; text-align:center;'>No knowledge gaps.</p>";
    safeTypeset();
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    score = 0; integrity = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    window.showScreen('screen-game');
    nextRound();
};

init();
