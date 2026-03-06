let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

// Symbol Generator
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
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().then(() => {
            // Scale the main formula
            autoScaleMath('formula-display');
            // Scale the correct answer in the roast overlay
            autoScaleMath('correct-display');
            
            // Also scale options if they are too long
            document.querySelectorAll('.opt-node').forEach((node, index) => {
                const parentW = node.clientWidth - 20;
                let childW = node.scrollWidth;
                let fs = 1.0;
                while (childW > parentW && fs > 0.6) {
                    fs -= 0.05;
                    node.style.fontSize = fs + "rem";
                    childW = node.scrollWidth;
                }
            });
        }).catch(e => console.error(e));
    }
}function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().then(() => {
            // Scale the main formula
            autoScaleMath('formula-display');
            // Scale the correct answer in the roast overlay
            autoScaleMath('correct-display');
            
            // Also scale options if they are too long
            document.querySelectorAll('.opt-node').forEach((node, index) => {
                const parentW = node.clientWidth - 20;
                let childW = node.scrollWidth;
                let fs = 1.0;
                while (childW > parentW && fs > 0.6) {
                    fs -= 0.05;
                    node.style.fontSize = fs + "rem";
                    childW = node.scrollWidth;
                }
            });
        }).catch(e => console.error(e));
    }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
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

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        const dock = document.getElementById('main-dock');
        if(dock) dock.classList.remove('hidden');
        window.showScreen('screen-home');
    }
};

function updateDash() {
    const nameEl = document.getElementById('display-name');
    if(nameEl) nameEl.innerText = callsign;
    
    const bestEl = document.getElementById('best-val');
    if(bestEl) bestEl.innerText = best;
    
    const progress = (xp % 1000) / 10;
    const levelVal = document.getElementById('level-val');
    if(levelVal) levelVal.innerText = Math.floor(xp / 1000) + 1;
    
    const ring = document.getElementById('xp-ring');
    if(ring) ring.style.strokeDasharray = progress + ", 100";
    
    const accEl = document.getElementById('accuracy-val');
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    if(accEl) accEl.innerText = acc + "%";
    
    const repairBtn = document.getElementById('repair-btn');
    if(repairBtn) repairBtn.style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
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
    if (lives <= 0 || sessionQueue.length === 0) { window.showScreen('screen-home'); return; }
    

    currentQ = sessionQueue[0];
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
    const failedQ = sessionQueue.shift();
    sessionQueue.push(failedQ);
    
    const roastMsg = document.getElementById('roast-msg');
    if(roastMsg) roastMsg.innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Study harder.";
    
    const correctDisp = document.getElementById('correct-display');
    if(correctDisp) correctDisp.innerHTML = "\\(" + currentQ.a + "\\)";
    
    const overlay = document.getElementById('roast-overlay');
    if(overlay) overlay.classList.remove('hidden');
    safeTypeset();
}

window.closeRoast = () => { 
    const overlay = document.getElementById('roast-overlay');
    if(overlay) overlay.classList.add('hidden'); 
    nextRound(); 
};

function populateVault() {
    const list = document.getElementById('vault-list');
    if(!list) return;
    list.innerHTML = allQ.map(q => {
        return '<div class="vault-item" onclick="const a = this.querySelector(\'.vault-ans\'); a.style.display = (a.style.display === \'block\') ? \'none\' : \'block\'">' +
               '<div>\\(' + q.q + '\\)</div>' +
               '<div class="vault-ans">\\(' + q.a + '\\)</div>' +
               '</div>';
    }).join('');
}

function populateLogs() {
    const list = document.getElementById('logs-list');
    if(!list) return;
    const items = Object.entries(failLogs).map(([q, c]) => {
        return '<div class="vault-item"><div>\\(' + q + '\\)</div>' +
               '<div style="color:var(--accent);margin-top:10px">Gaps: ' + c + '</div></div>';
    });
    list.innerHTML = items.length ? items.join('') : "<p style='text-align:center; padding:40px;'>No gaps identified.</p>";
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    window.showScreen('screen-difficulty');
};

init();



