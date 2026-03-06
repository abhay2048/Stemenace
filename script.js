let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// PvP Variables
let p1Score = 0, p2Score = 0, pvpQueue = [];

// --- CORE INITIALIZATION ---

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
    } catch (e) { console.error("Archive load failed."); }
    
    if (!callsign) showScreen('screen-login');
    else { 
        document.getElementById('main-dock').classList.remove('hidden'); 
        showScreen('screen-home'); 
    }
}

// --- MATH SCALING & RENDERING ---

function autoScaleMath(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Reset to base size to measure true natural width
    el.style.fontSize = '1.6rem';
    
    setTimeout(() => {
        const parent = el.parentElement;
        if (!parent) return;

        const maxWidth = parent.clientWidth - 40; // Card width minus padding
        const mjx = el.querySelector('mjx-container');
        
        if (mjx) {
            const renderedWidth = mjx.getBoundingClientRect().width;
            if (renderedWidth > maxWidth) {
                const ratio = maxWidth / renderedWidth;
                // Scale down based on ratio, but stay readable (min 0.75rem)
                const newSize = Math.max(1.6 * ratio, 0.75); 
                el.style.fontSize = newSize + 'rem';
            }
        }
    }, 150); // Delay allows MathJax font internal layout to settle
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().then(() => {
            // Scale Main Game Formula
            autoScaleMath('formula-display');
            // Scale PvP Formulas
            autoScaleMath('p1-formula');
            autoScaleMath('p2-formula');
            // Scale Reveal Formula
            autoScaleMath('correct-display');
            
            // Auto-scale option buttons if text is too wide
            document.querySelectorAll('.opt-node, .opt-pvp').forEach(node => {
                const inner = node.querySelector('mjx-container');
                if (inner) {
                    const maxWidth = node.clientWidth - 20;
                    const curWidth = inner.getBoundingClientRect().width;
                    if (curWidth > maxWidth) {
                        const ratio = maxWidth / curWidth;
                        node.style.fontSize = Math.max(ratio * 0.9, 0.7) + 'rem';
                    }
                }
            });
        }).catch(e => {});
    }
}

// --- NAVIGATION ---

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    // Manage Bottom Dock Visibility
    const dock = document.getElementById('main-dock');
    if (id === 'screen-game' || id === 'screen-pvp' || id === 'screen-login') {
        dock.classList.add('hidden');
    } else {
        dock.classList.remove('hidden');
    }

    if (id === 'screen-home') { 
        updateDash(); 
        const navs = document.querySelectorAll('.nav-item');
        if(navs[0]) navs[0].classList.add('active'); 
    }
    if (id === 'screen-vault') { 
        populateVault(); 
        const navs = document.querySelectorAll('.nav-item');
        if(navs[1]) navs[1].classList.add('active'); 
    }
    if (id === 'screen-logs') { 
        populateLogs(); 
        const navs = document.querySelectorAll('.nav-item');
        if(navs[2]) navs[2].classList.add('active'); 
    }
    safeTypeset();
};

// --- SINGLE PLAYER LOGIC ---

window.setDiff = (s) => {
    timeLimit = s; score = 0; lives = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    window.showScreen('screen-game');
    nextRound();
};

function nextRound() {
    clearInterval(timerId);
    if (lives <= 0 || sessionQueue.length === 0) { 
        if(score > best) { best = score; localStorage.setItem('ax_best', best); }
        window.showScreen('screen-home'); 
        return; 
    }

    currentQ = sessionQueue[0];
    // Use inline tags \( \) for better scaling control
    document.getElementById('formula-display').innerHTML = "\\(" + currentQ.q + "\\)";
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);

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
            } else handleFail();
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
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    const failedQ = sessionQueue.shift();
    sessionQueue.push(failedQ); // Repeat later
    
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Incorrect logic.";
    document.getElementById('correct-display').innerHTML = "\\(" + currentQ.a + "\\)";
    
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

// --- PVP LOGIC ---

window.startPvP = () => {
    p1Score = 0; p2Score = 0;
    document.getElementById('p1-score').innerText = "0";
    document.getElementById('p2-score').innerText = "0";
    pvpQueue = [...allQ].sort(() => Math.random() - 0.5);
    window.showScreen('screen-pvp');
    nextPvPRound();
};

function nextPvPRound() {
    if (pvpQueue.length === 0) { 
        alert(`Battle End! P1: ${p1Score} | P2: ${p2Score}`);
        window.showScreen('screen-home');
        return; 
    }

    const q = pvpQueue.shift();
    document.getElementById('p1-formula').innerHTML = "\\(" + q.q + "\\)";
    document.getElementById('p2-formula').innerHTML = "\\(" + q.q + "\\)";

    renderPvPOptions('p1-options', q, 1);
    renderPvPOptions('p2-options', q, 2);
    safeTypeset();
}

function renderPvPOptions(containerId, q, playerNum) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    [...q.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'opt-pvp';
        btn.innerHTML = "\\(" + o + "\\)";
        btn.onclick = () => {
            if (o === q.a) {
                if (playerNum === 1) p1Score++; else p2Score++;
                document.getElementById(`p${playerNum}-score`).innerText = playerNum === 1 ? p1Score : p2Score;
                btn.style.borderColor = "var(--accent)";
                setTimeout(nextPvPRound, 300);
            } else {
                btn.style.opacity = "0.3";
                btn.disabled = true;
            }
        };
        container.appendChild(btn);
    });
}

// --- UTILS & HELPERS ---

function startTimer() {
    let cur = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        cur -= 0.1;
        if(bar) bar.style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

window.closeRoast = () => { 
    document.getElementById('roast-overlay').classList.add('hidden'); 
    nextRound(); 
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        window.showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    const progress = (xp % 1000) / 10;
    document.getElementById('level-val').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDasharray = progress + ", 100";
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
}

window.selectChapter = (c) => {
    filteredQ = allQ.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    window.showScreen('screen-difficulty');
};

function populateVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = allQ.map(q => `
        <div class="vault-item" onclick="this.querySelector('.vault-ans').style.display = 'block'">
            <div>\\(${q.q}\\)</div>
            <div class="vault-ans">\\(${q.a}\\)</div>
        </div>
    `).join('');
}

function populateLogs() {
    const list = document.getElementById('logs-list');
    const items = Object.entries(failLogs).map(([q, c]) => `
        <div class="vault-item"><div>\\(${q}\\)</div>
        <div style="color:var(--accent);margin-top:10px">Identified Gaps: ${c}</div></div>
    `);
    list.innerHTML = items.length ? items.join('') : "<p style='text-align:center; padding:40px;'>No gaps identified.</p>";
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    window.showScreen('screen-difficulty');
};

function genSymbols() {
    const symbols = ["∫", "∑", "π", "∂", "∞", "θ", "Δ", "√", "Ω", "μ"];
    const container = document.getElementById('symbol-layer');
    if(!container) return;
    container.innerHTML = "";
    for(let i=0; i<30; i++) {
        const span = document.createElement('span');
        span.className = 'float-symbol';
        span.innerText = symbols[Math.floor(Math.random()*symbols.length)];
        span.style.left = Math.random() * 95 + "%";
        span.style.top = Math.random() * 95 + "%";
        span.style.animationDelay = Math.random() * 5 + "s";
        container.appendChild(span);
    }
}

init();
