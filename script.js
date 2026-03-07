let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3;
let scholarName = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// Mesmerizing Background Animation
function genSymbols() {
    const symbols = ["∫", "∑", "π", "∂", "∞", "θ", "Δ", "√", "Ω", "μ"];
    const container = document.getElementById('symbol-layer');
    if(!container) return;
    for(let i=0; i<15; i++) {
        const span = document.createElement('span');
        span.className = 'float-symbol';
        span.innerText = symbols[Math.floor(Math.random()*symbols.length)];
        span.style.left = Math.random() * 95 + "%";
        span.style.animationDuration = (Math.random() * 10 + 10) + "s";
        span.style.animationDelay = (Math.random() * 5) + "s";
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
            <button class="action-card" onclick="selectChapter('${c}')">
                <span class="serif-title">${c.toUpperCase()}</span>
                <small>Review manuscript</small>
            </button>
        `).join('');

        // Difficulty selection
        document.querySelector('.difficulty-list').innerHTML = `
            <button class="action-card" onclick="setDiff(30)"><span>Contemplative</span><small>30 Seconds</small></button>
            <button class="action-card" onclick="setDiff(15)"><span>Focused</span><small>15 Seconds</small></button>
            <button class="action-card" onclick="setDiff(8)"><span>Rapid</span><small>8 Seconds</small></button>
        `;
    } catch (e) { console.error("Archive load failed."); }
    
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
    document.querySelectorAll('.bar-item').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    // UI Active Tab Highlighting
    if (id === 'screen-home') { updateDash(); document.querySelectorAll('.bar-item')[0].classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); document.querySelectorAll('.bar-item')[1].classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.querySelectorAll('.bar-item')[2].classList.add('active'); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('scholar-input').value.trim();
    if (val) {
        scholarName = val.toUpperCase();
        localStorage.setItem('ax_id', scholarName);
        document.getElementById('main-dock').classList.remove('hidden');
        window.showScreen('screen-home');
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
    window.showScreen('screen-difficulty');
};

window.setDiff = (s) => {
    timeLimit = s; score = 0; lives = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    window.showScreen('screen-game');
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
        b.className = 'opt-node';
        b.innerHTML = "\\(" + o + "\\)";
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { 
                b.style.borderColor = "var(--accent)";
                b.style.boxShadow = "0 0 15px var(--accent)";
                score++; history.correct++; 
                sessionQueue.shift();
                setTimeout(nextRound, 300); 
            } else handleFail();
            localStorage.setItem('ax_hist', JSON.stringify(history));
        };
        stack.appendChild(b);
    });
    safeTypeset();
    startTimer();
}

function showSummary() {
    document.getElementById('sum-correct').innerText = score;
    let grade = "Novice Scholar";
    if (score > 10) grade = "Proficient Scholar";
    if (score > 25) grade = "Grand Master Scholar";
    document.getElementById('sum-grade').innerText = grade;
    window.showScreen('screen-summary');
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
    
    // Spaced Repetition (Issue 2)
    const failedQ = sessionQueue.shift();
    sessionQueue.splice(Math.min(2, sessionQueue.length), 0, failedQ);
    
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Study closely.";
    document.getElementById('correct-display').innerHTML = "\\[" + currentQ.a + "\\]";
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

window.closeRoast = () => { 
    document.getElementById('roast-overlay').classList.add('hidden'); 
    nextRound(); 
};

function populateVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = allQ.map(q => `<div class="glass-card" style="margin-bottom:15px;" onclick="const a = this.querySelector('.vault-ans'); a.style.display = (a.style.display === 'block') ? 'none' : 'block'"><div>\\(${q.q}\\)</div><div class="vault-ans" style="display:none; color:var(--accent); margin-top:15px;">\\(${q.a}\\)</div></div>`).join('');
}

function populateLogs() {
    const list = document.getElementById('logs-list');
    const items = Object.entries(failLogs).map(([q, c]) => `<div class="glass-card" style="margin-bottom:15px;"><div>\\(${q}\\)</div><div style="color:var(--accent);margin-top:10px">Identified Gaps: ${c}</div></div>`);
    list.innerHTML = items.length ? items.join('') : "<p style='text-align:center; padding:40px; color:var(--text-dim)'>Clear Archives.</p>";
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    window.showScreen('screen-difficulty');
};

init();
