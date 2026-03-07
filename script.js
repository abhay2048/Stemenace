let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3;
let scholarName = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// High-Density Symbols in Negative Space
function genSymbols() {
    const symbols = ["∫", "∑", "π", "∂", "∞", "θ", "Δ", "√", "Ω", "μ"];
    const container = document.getElementById('symbol-layer');
    if(!container) return;
    container.innerHTML = "";
    for(let i=0; i<40; i++) {
        const span = document.createElement('span');
        span.className = 'float-symbol';
        span.innerText = symbols[Math.floor(Math.random()*symbols.length)];
        
        let x = Math.random() * 100;
        // Pushing symbols to the side (Negative Space)
        if (x > 25 && x < 75) x = (Math.random() > 0.5) ? x + 30 : x - 30;
        
        span.style.left = x + "%";
        span.style.fontSize = (Math.random() * 1 + 1) + "rem";
        span.style.animationDelay = (Math.random() * -25) + "s";
        span.style.animationDuration = (Math.random() * 10 + 20) + "s";
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
        
        const chapters = [...new Set(allQ.map(q => q.chap))];
        document.getElementById('chapter-list').innerHTML = chapters.map(c => `
            <div class="glass-card" style="padding:20px; margin-bottom:15px;" onclick="selectChapter('${c}')">
                <h3 style="font-family:var(--serif)">${c.toUpperCase()}</h3>
                <small style="opacity:0.5">REVISE ARCHIVE</small>
            </div>
        `).join('');
    } catch (e) { console.error("Library Offline"); }
    
    if (!scholarName) showScreen('screen-login');
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
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    if (id === 'screen-home') { updateDash(); document.getElementById('nav-home').classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); document.getElementById('nav-vault').classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.getElementById('nav-gaps').classList.add('active'); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('scholar-input').value.trim();
    if (val) {
        scholarName = val.toUpperCase();
        localStorage.setItem('ax_id', scholarName);
        document.getElementById('main-dock').classList.remove('hidden');
        showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = scholarName;
    document.getElementById('total-val').innerText = history.total;
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
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
    document.getElementById('formula-display').innerHTML = "\\[" + currentQ.q + "\\]";
    document.getElementById('streak-val').innerText = score;
    document.getElementById('lives-val').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'glass-card';
        b.style.padding = "20px"; b.style.marginBottom = "10px";
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
    
    // Point 2: Spaced Repetition (Insert 3 spots away)
    const failedQ = sessionQueue.shift();
    sessionQueue.splice(Math.min(2, sessionQueue.length), 0, failedQ);
    
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Study the paper.";
    document.getElementById('correct-display').innerHTML = "\\[" + currentQ.a + "\\]";
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

function showSummary() {
    document.getElementById('sum-score').innerText = score;
    document.getElementById('sum-lives').innerText = lives;
    showScreen('screen-summary');
}

window.closeRoast = () => { 
    document.getElementById('roast-overlay').classList.add('hidden'); 
    nextRound(); 
};

function populateVault() {
    document.getElementById('vault-list').innerHTML = allQ.map(q => `<div class="glass-card" style="padding:20px; margin-bottom:15px;" onclick="const a = this.querySelector('.va'); a.style.display = (a.style.display === 'block') ? 'none' : 'block'"><div>\\(${q.q}\\)</div><div class="va" style="display:none; color:var(--accent); margin-top:10px; border-top:1px solid var(--glass-border); padding-top:10px;">\\(${q.a}\\)</div></div>`).join('');
}

function populateLogs() {
    const items = Object.entries(failLogs).map(([q, c]) => `<div class="glass-card" style="padding:20px; margin-bottom:15px;"><div>\\(${q}\\)</div><div style="color:var(--accent); margin-top:10px;">Misunderstood ${c} times</div></div>`);
    document.getElementById('logs-list').innerHTML = items.length ? items.join('') : "<p style='text-align:center; opacity:0.3; padding-top:100px;'>No Gaps Identified.</p>";
}

window.startRepair = () => {
    filteredQ = allQ.filter(q => Object.keys(failLogs).includes(q.q));
    showScreen('screen-difficulty');
};

init();
