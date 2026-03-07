let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3;
let scholarName = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// High-Density Negative Space Symbols
function genSymbols() {
    const symbols = ["∫", "∑", "π", "∂", "∞", "θ", "Δ", "√", "Ω", "μ", "φ", "λ"];
    const container = document.getElementById('symbol-layer');
    if(!container) return;
    container.innerHTML = "";
    
    // Generate 50 symbols mostly in "negative space" (edges)
    for(let i=0; i<50; i++) {
        const span = document.createElement('span');
        span.className = 'float-symbol';
        span.innerText = symbols[Math.floor(Math.random()*symbols.length)];
        
        // Logic to keep symbols mostly away from the center for mobile
        let x = Math.random() * 100;
        let y = Math.random() * 100;
        
        // If too central, push to edges
        if (x > 30 && x < 70) x = (Math.random() > 0.5) ? x + 35 : x - 35;
        
        span.style.left = x + "%";
        span.style.top = y + "%";
        span.style.fontSize = (Math.random() * 1 + 1) + "rem";
        span.style.animation = `float ${Math.random() * 20 + 20}s infinite ease-in-out`;
        span.style.animationDelay = `${Math.random() * -20}s`;
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
        
        // Populate Chapter List
        const chapters = [...new Set(allQ.map(q => q.chap))];
        document.getElementById('chapter-list').innerHTML = chapters.map(c => `
            <div class="glass-panel" style="margin-bottom:12px; padding:20px;" onclick="selectChapter('${c}')">
                <div style="font-family:var(--serif); font-size:1.2rem;">${c.toUpperCase()}</div>
                <div style="font-size:0.7rem; color:var(--text-dim); margin-top:4px;">REVISE MANUSCRIPTS</div>
            </div>
        `).join('');
    } catch (e) { console.error("Library failed to load."); }
    
    if (!scholarName) showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => {});
    }
}

window.showScreen = (id) => {
    // Smooth transition: Slide out current
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    if (id === 'screen-home') { 
        updateDash(); 
        document.getElementById('nav-home').classList.add('active'); 
    }
    if (id === 'screen-vault') { 
        populateVault(); 
        document.getElementById('nav-vault').classList.add('active'); 
    }
    if (id === 'screen-logs') { 
        populateLogs(); 
        document.getElementById('nav-logs').classList.add('active'); 
    }
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
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
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
    
    // ISSUE 2: Spaced Repetition (Insert 2 items back)
    const failedQ = sessionQueue.shift();
    sessionQueue.splice(Math.min(2, sessionQueue.length), 0, failedQ);
    
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Study closely.";
    document.getElementById('correct-display').innerHTML = "\\[" + currentQ.a + "\\]";
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

function showSummary() {
    document.getElementById('sum-correct').innerText = score;
    document.getElementById('sum-lives').innerText = lives;
    window.showScreen('screen-summary');
}

window.closeRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
};

function populateVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = allQ.map(q => `<div class="glass-panel" style="margin-bottom:12px; padding:20px;" onclick="const a = this.querySelector('.v-ans'); a.style.display = (a.style.display === 'block') ? 'none' : 'block'"><div>\\(${q.q}\\)</div><div class="v-ans" style="display:none; color:var(--accent); margin-top:15px; border-top:1px solid var(--border); padding-top:15px;">\\(${q.a}\\)</div></div>`).join('');
}

function populateLogs() {
    const list = document.getElementById('logs-list');
    const items = Object.entries(failLogs).map(([q, c]) => `<div class="glass-panel" style="margin-bottom:12px; padding:20px;"><div>\\(${q}\\)</div><div style="color:var(--accent); margin-top:10px; font-size:0.8rem">Gaps Identified: ${c}</div></div>`);
    list.innerHTML = items.length ? items.join('') : "<p style='text-align:center; opacity:0.5; margin-top:50px;'>No gaps in your knowledge.</p>";
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    showScreen('screen-difficulty');
};

init();
