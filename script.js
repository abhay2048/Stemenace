let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// PvP state
let p1Score = 0, p2Score = 0, pvpQueue = [], p1Stun = false, p2Stun = false;

async function init() {
    genSymbols();
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
            <button class="menu-action-card" onclick="selectChapter('${c}')">
                <span>${c.toUpperCase()}</span>
                <small>Archive Manuscripts</small>
            </button>
        `).join('');
    } catch (e) { console.error("Load failed."); }
    
    if (!callsign) showScreen('screen-login');
    else showScreen('screen-home');
}

// --- RENDERING & SCALING ---
function autoScaleMath(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.style.fontSize = '1.6rem';
    setTimeout(() => {
        const mjx = el.querySelector('mjx-container');
        if (mjx) {
            const parentWidth = el.parentElement.clientWidth - 30;
            const renderedWidth = mjx.getBoundingClientRect().width;
            if (renderedWidth > parentWidth) {
                el.style.fontSize = Math.max(1.6 * (parentWidth / renderedWidth), 0.7) + 'rem';
            }
        }
    }, 150);
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().then(() => {
            autoScaleMath('formula-display');
            autoScaleMath('p1-formula');
            autoScaleMath('p2-formula');
            autoScaleMath('correct-display');
            document.querySelectorAll('.opt-node, .opt-pvp').forEach(node => {
                const inner = node.querySelector('mjx-container');
                if (inner) {
                    const maxW = node.clientWidth - 15;
                    const curW = inner.getBoundingClientRect().width;
                    if (curW > maxW) node.style.fontSize = Math.max(maxW/curW, 0.7) + 'rem';
                }
            });
        });
    }
}

// --- SINGLE PLAYER LOGIC ---
window.setDiff = (s) => { 
    timeLimit = s; score = 0; lives = 3; 
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5); 
    showScreen('screen-game'); 
    nextRound(); 
};

function nextRound() {
    clearInterval(timerId);
    if (lives <= 0 || sessionQueue.length === 0) { 
        if(score > best) { best = score; localStorage.setItem('ax_best', best); }
        showScreen('screen-home'); 
        return; 
    }

    currentQ = sessionQueue[0];
    document.getElementById('formula-display').innerHTML = "\\(" + currentQ.q + "\\)";
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);
    document.getElementById('streak-box').innerText = score;

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-node';
        b.innerHTML = "\\(" + o + "\\)";
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { 
                score++; xp += 20; history.correct++; 
                sessionQueue.shift(); 
                nextRound(); 
            } else { 
                handleFail(); 
            }
            localStorage.setItem('ax_xp', xp); 
            localStorage.setItem('ax_hist', JSON.stringify(history));
        };
        stack.appendChild(b);
    });
    safeTypeset(); 
    startTimer();
}

function handleFail() {
    clearInterval(timerId);
    lives--;
    // Log the fail for the "Address Weaknesses" feature
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    
    // Put failed question at the end of the line
    sessionQueue.push(sessionQueue.shift());

    // Show Roast Overlay
    const roast = roasts[Math.floor(Math.random() * roasts.length)] || "Incorrect logic.";
    document.getElementById('roast-msg').innerText = roast;
    document.getElementById('correct-display').innerHTML = "\\(" + currentQ.a + "\\)";
    document.getElementById('roast-overlay').classList.remove('hidden');
    
    safeTypeset();
}

window.closeRoast = () => { 
    document.getElementById('roast-overlay').classList.add('hidden'); 
    nextRound(); 
};

// --- ADDRESS WEAKNESSES (REPAIR) ---
window.startRepair = () => {
    // Filter all questions to find only those that have failed previously
    const failedQuestions = Object.keys(failLogs);
    filteredQ = allQ.filter(q => failedQuestions.includes(q.q));
    
    if (filteredQ.length > 0) {
        showScreen('screen-difficulty');
    }
};

// --- PVP LOGIC ---
window.startPvP = () => {
    p1Score = 0; p2Score = 0; p1Stun = false; p2Stun = false;
    document.getElementById('p1-score').innerText = "0";
    document.getElementById('p2-score').innerText = "0";
    document.getElementById('p1-zone').classList.remove('stunned');
    document.getElementById('p2-zone').classList.remove('stunned');
    pvpQueue = [...allQ].sort(() => Math.random() - 0.5);
    showScreen('screen-pvp');
    nextPvPRound();
};

function nextPvPRound() {
    if (document.getElementById('screen-pvp').classList.contains('hidden')) return;
    if (pvpQueue.length === 0) { alert("Duel Finished!"); showScreen('screen-home'); return; }
    const q = pvpQueue.shift();
    document.getElementById('p1-formula').innerHTML = "\\(" + q.q + "\\)";
    document.getElementById('p2-formula').innerHTML = "\\(" + q.q + "\\)";
    renderPvP(q, 1); renderPvP(q, 2);
    safeTypeset();
}

function renderPvP(q, pNum) {
    const cont = document.getElementById(`p${pNum}-options`);
    cont.innerHTML = "";
    [...q.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-pvp'; b.innerHTML = "\\(" + o + "\\)";
        b.onclick = () => {
            if ((pNum === 1 && p1Stun) || (pNum === 2 && p2Stun)) return;
            if (o === q.a) {
                if (pNum === 1) p1Score++; else p2Score++;
                document.getElementById(`p${pNum}-score`).innerText = (pNum === 1 ? p1Score : p2Score);
                setTimeout(nextPvPRound, 300);
            } else { stun(pNum); }
        };
        cont.appendChild(b);
    });
}

function stun(pNum) {
    if (pNum === 1) p1Stun = true; else p2Stun = true;
    document.getElementById(`p${pNum}-zone`).classList.add('stunned');
    setTimeout(() => {
        if (pNum === 1) p1Stun = false; else p2Stun = false;
        document.getElementById(`p${pNum}-zone`).classList.remove('stunned');
    }, 1000);
}

// --- NAVIGATION & UI ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    const dock = document.getElementById('main-dock');
    if (['screen-game', 'screen-pvp', 'screen-login'].includes(id)) {
        dock.classList.add('hidden');
    } else {
        dock.classList.remove('hidden');
        updateDash();
    }

    if (id === 'screen-vault') populateVault();
    if (id === 'screen-logs') populateLogs();
    
    safeTypeset();
};

function startTimer() {
    let cur = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        cur -= 0.1;
        if(bar) bar.style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    document.getElementById('level-val').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDasharray = (xp % 1000) / 10 + ", 100";
    document.getElementById('accuracy-val').innerText = (history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0) + "%";
    
    // Show repair button only if there are mistakes
    const hasGaps = Object.keys(failLogs).length > 0;
    document.getElementById('repair-btn').style.display = hasGaps ? 'block' : 'none';
}

window.submitLogin = () => {
    const v = document.getElementById('callsign-input').value.trim();
    if (v) { callsign = v.toUpperCase(); localStorage.setItem('ax_id', callsign); showScreen('screen-home'); }
};

window.selectChapter = (c) => { 
    filteredQ = allQ.filter(q => q.chap === c); 
    showScreen('screen-difficulty'); 
};

function populateVault() {
    document.getElementById('vault-list').innerHTML = allQ.map(q => `
        <div class="vault-item" onclick="this.querySelector('.vault-ans').style.display='block'">
            <div>\\(${q.q}\\)</div><div class="vault-ans">\\(${q.a}\\)</div>
        </div>
    `).join('');
    safeTypeset();
}

function populateLogs() {
    const logs = Object.entries(failLogs).map(([q, c]) => `
        <div class="vault-item"><div>\\(${q}\\)</div><div style="color:var(--accent);margin-top:10px">Identified Gaps: ${c}</div></div>
    `);
    document.getElementById('logs-list').innerHTML = logs.length ? logs.join('') : "<p style='text-align:center; padding: 40px;'>No gaps identified.</p>";
    safeTypeset();
}

function genSymbols() {
    const syms = ["∫", "∑", "π", "∂", "∞", "√"];
    const cont = document.getElementById('symbol-layer');
    if(!cont) return;
    cont.innerHTML = "";
    for(let i=0; i<30; i++) {
        const s = document.createElement('span'); s.className = 'float-symbol'; s.innerText = syms[Math.floor(Math.random()*6)];
        s.style.left = Math.random()*95+"%"; s.style.top = Math.random()*95+"%"; cont.appendChild(s);
    }
}

init();
