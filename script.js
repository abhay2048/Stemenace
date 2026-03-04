let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

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
        
        const chapters = [...new Set(allQ.map(q => q.chap))];
        document.getElementById('chapter-list').innerHTML = chapters.map(c => `
            <button class="btn-primary-satisfying" onclick="selectChapter('${c}')">${c.toUpperCase()}</button>
        `).join('');

    } catch (e) { console.error("Initialization failed."); }
    
    if (!callsign) showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => {});
    }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'screen-home') { updateDash(); document.querySelectorAll('.nav-item')[0].classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); document.querySelectorAll('.nav-item')[1].classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.querySelectorAll('.nav-item')[2].classList.add('active'); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        document.getElementById('main-dock').classList.remove('hidden');
        showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    const progress = (xp % 1000) / 10;
    document.getElementById('level-val').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDasharray = `${progress}, 100`;
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
}

// ARENA ENGINE
window.selectChapter = (c) => {
    filteredQ = allQ.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    showScreen('screen-difficulty');
};

window.setDiff = (s) => {
    timeLimit = s; score = 0; lives = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    showScreen('screen-game');
    nextRound();
};

function nextRound() {
    clearInterval(timerId);
    if (lives <= 0 || sessionQueue.length === 0) { showScreen('screen-home'); return; }

    currentQ = sessionQueue[0];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { 
                score++; xp += 20; history.correct++; 
                sessionQueue.shift();
                nextRound(); 
            } else handleFail();
            localStorage.setItem('ax_xp', xp);
            localStorage.setItem('ax_hist', JSON.stringify(history));
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
    lives--;
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    const failedQ = sessionQueue.shift();
    sessionQueue.push(failedQ);
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)];
    document.getElementById('correct-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

window.closeRoast = () => { document.getElementById('roast-overlay').classList.add('hidden'); nextRound(); };

// VAULT (ARCHIVE) TOGGLE REVEAL
function populateVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = allQ.map(q => `
        <div class="vault-card" onclick="const a = this.querySelector('.vault-ans'); a.style.display = (a.style.display === 'block') ? 'none' : 'block'">
            <div>\\( ${q.q} \\)</div>
            <div class="vault-ans">\\( ${q.a} \\)</div>
        </div>
    `).join('');
    safeTypeset();
}

function populateLogs() {
    document.getElementById('logs-list').innerHTML = Object.entries(failLogs).map(([q, c]) => `
        <div class="vault-card"><div>\\( ${q} \\)</div><div style="color:var(--accent);margin-top:10px">Identified Gaps: ${c}</div></div>
    `).join('') || "<p style='text-align:center; padding:40px;'>No weaknesses identified.</p>";
    safeTypeset();
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    showScreen('screen-difficulty');
};

init();
