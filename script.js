let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3;
let scholarName = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

function genSymbols() {
    const symbols = ["∫", "∑", "π", "∂", "∞", "θ", "Δ", "√", "Ω", "μ"];
    const container = document.getElementById('symbol-layer');
    if(!container) return;
    container.innerHTML = "";
    for(let i=0; i<45; i++) {
        const span = document.createElement('span');
        span.className = 'float-symbol';
        span.innerText = symbols[Math.floor(Math.random()*symbols.length)];
        let x = Math.random() * 100;
        if (x > 20 && x < 80) x = (Math.random() > 0.5) ? x + 30 : x - 30; // Negative Space logic
        span.style.left = x + "%";
        span.style.fontSize = (Math.random() * 0.5 + 1) + "rem";
        span.style.animationDuration = (Math.random() * 15 + 20) + "s";
        span.style.animationDelay = (Math.random() * -20) + "s";
        container.appendChild(span);
    }
}

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
        
        const list = document.getElementById('chapter-list');
        if(list) {
            const chapters = [...new Set(allQ.map(q => q.chap))];
            list.innerHTML = chapters.map(c => `
                <div class="glass-card list-item" onclick="selectChapter('${c}')">
                    <h3 class="serif">${c.toUpperCase()}</h3>
                    <small>ARCHIVE MANUSCRIPT</small>
                </div>
            `).join('');
        }
    } catch (e) { console.error("Library database failure."); }
    
    if (!scholarName) showScreen('screen-login');
    else { 
        const dock = document.getElementById('main-dock');
        if(dock) dock.classList.remove('hidden'); 
        showScreen('screen-home'); 
    }
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => {});
    }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    // Safety check for Navigation Dock IDs
    const navHome = document.getElementById('nav-home');
    const navVault = document.getElementById('nav-vault');
    const navLogs = document.getElementById('nav-logs');

    if (id === 'screen-home') { updateDash(); if(navHome) navHome.classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); if(navVault) navVault.classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); if(navLogs) navLogs.classList.add('active'); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('scholar-input').value.trim();
    if (val) {
        scholarName = val.toUpperCase();
        localStorage.setItem('ax_id', scholarName);
        const dock = document.getElementById('main-dock');
        if(dock) dock.classList.remove('hidden');
        showScreen('screen-home');
    }
};

function updateDash() {
    const nameEl = document.getElementById('display-name');
    const totalEl = document.getElementById('total-val');
    const accEl = document.getElementById('accuracy-val');
    const repairBtn = document.getElementById('repair-btn');

    if(nameEl) nameEl.innerText = scholarName;
    if(totalEl) totalEl.innerText = history.total;
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    if(accEl) accEl.innerText = acc + "%";
    if(repairBtn) repairBtn.style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
}

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
    if (lives <= 0 || sessionQueue.length === 0) {
        showSummary();
        return;
    }
    currentQ = sessionQueue[0];
    
    const formulaDisp = document.getElementById('formula-display');
    const streakEl = document.getElementById('streak-val');
    const livesEl = document.getElementById('lives-val');

    if(formulaDisp) formulaDisp.innerHTML = "\\[" + currentQ.q + "\\]";
    if(streakEl) streakEl.innerText = score;
    if(livesEl) livesEl.innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    if(stack) {
        stack.innerHTML = "";
        [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
            const b = document.createElement('button');
            b.className = 'glass-card opt-btn';
            b.innerHTML = "\\(" + o + "\\)";
            b.onclick = () => {
                history.total++;
                if (o === currentQ.a) { 
                    score++; history.correct++; 
                    sessionQueue.shift();
                    nextRound(); 
                } else handleFail();
                localStorage.setItem('ax_hist', JSON.stringify(history));
            };
            stack.appendChild(b);
        });
    }
    safeTypeset();
    startTimer();
}

function startTimer() {
    let cur = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        cur -= 0.1;
        if(bar) bar.style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    clearInterval(timerId);
    lives--;
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    
    // Spaced Repetition Logic (Issue 2)
    const failedQ = sessionQueue.shift();
    sessionQueue.splice(Math.min(2, sessionQueue.length), 0, failedQ);
    
    const roastMsg = document.getElementById('roast-msg');
    const correctDisp = document.getElementById('correct-display');
    const overlay = document.getElementById('roast-overlay');

    if(roastMsg) roastMsg.innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Study closely.";
    if(correctDisp) correctDisp.innerHTML = "\\[" + currentQ.a + "\\]";
    if(overlay) overlay.classList.remove('hidden');
    safeTypeset();
}

function showSummary() {
    const sCorrect = document.getElementById('sum-score');
    const sLives = document.getElementById('sum-lives');
    if(sCorrect) sCorrect.innerText = score;
    if(sLives) sLives.innerText = lives;
    showScreen('screen-summary');
}

window.closeRoast = () => { 
    const overlay = document.getElementById('roast-overlay');
    if(overlay) overlay.classList.add('hidden'); 
    nextRound(); 
};

function populateVault() {
    const list = document.getElementById('vault-list');
    if(!list) return;
    list.innerHTML = allQ.map(q => `
        <div class="glass-card list-item" onclick="const a = this.querySelector('.v-ans'); a.style.display = (a.style.display === 'block') ? 'none' : 'block'">
            <div>\\(${q.q}\\)</div>
            <div class="v-ans" style="display:none; color:var(--accent); margin-top:15px;">\\(${q.a}\\)</div>
        </div>
    `).join('');
}

function populateLogs() {
    const list = document.getElementById('logs-list');
    if(!list) return;
    const items = Object.entries(failLogs).map(([q, c]) => `
        <div class="glass-card list-item">
            <div>\\(${q}\\)</div>
            <div style="color:var(--accent); margin-top:10px;">Identified Gaps: ${c}</div>
        </div>
    `);
    list.innerHTML = items.length ? items.join('') : "<p style='text-align:center; opacity:0.3; padding-top:100px;'>No Gaps Identified.</p>";
}

window.startRepair = () => {
    filteredQ = allQ.filter(q => Object.keys(failLogs).includes(q.q));
    showScreen('screen-difficulty');
};

init();
