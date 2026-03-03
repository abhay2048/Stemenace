let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30, isMuted = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(f, t, d) {
    if (isMuted) return;
    try {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e){}
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => console.log("Rendering..."));
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
    } catch (e) { console.error("Database error."); }
    
    if (!callsign) window.showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); window.showScreen('screen-home'); }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.dock-item').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    
    if (id === 'screen-home') { updateDash(); document.querySelectorAll('.dock-item')[0].classList.add('active'); }
    if (id === 'screen-vault') { populateVault(); document.querySelectorAll('.dock-item')[1].classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.querySelectorAll('.dock-item')[2].classList.add('active'); }
    
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        document.getElementById('main-dock').classList.remove('hidden');
        window.showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    const progress = (xp % 1000) / 1000;
    document.getElementById('level-val').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDashoffset = 301.59 - (progress * 301.59);
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
    if (lives <= 0) { showResults("Archive Depleted", "Your retention failed."); return; }
    if (sessionQueue.length === 0) { showResults("Mastery Achieved", "All identities verified."); return; }

    currentQ = sessionQueue[0]; 
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `<div class="math-rail">\\( ${o} \\)</div>`;
        b.onclick = () => {
            history.total++;
            if (o === currentQ.a) { 
                score++; xp += 20; history.correct++; 
                playSfx(800, 'sine', 0.1); sessionQueue.shift(); 
                nextRound(); 
            } else handleFail();
            localStorage.setItem('ax_xp', xp); localStorage.setItem('ax_hist', JSON.stringify(history));
        };
        stack.appendChild(b);
    });
    safeTypeset();
    startTimer();
}

function startTimer() {
    clearInterval(timerId); let cur = timeLimit;
    timerId = setInterval(() => {
        cur -= 0.1;
        document.getElementById('timer-fill').style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    lives--; clearInterval(timerId); playSfx(200, 'sawtooth', 0.2);
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    const failedQ = sessionQueue.shift(); sessionQueue.push(failedQ);
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "Focus.";
    document.getElementById('correct-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

window.closeRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
};

function showResults(title, subtitle) {
    clearInterval(timerId);
    if (score > best) { best = score; localStorage.setItem('ax_best', best); }
    document.getElementById('results-title').innerText = title;
    document.getElementById('results-subtitle').innerText = subtitle;
    document.getElementById('res-score').innerText = score;
    document.getElementById('res-xp').innerText = `+${score * 20}`;
    document.getElementById('results-overlay').classList.remove('hidden');
}

window.closeResults = () => {
    document.getElementById('results-overlay').classList.add('hidden');
    window.showScreen('screen-home');
};

function populateVault() {
    const cont = document.getElementById('vault-list');
    cont.innerHTML = allQ.map(q => `
        <div class="list-card" onclick="const a = this.querySelector('.ans'); a.style.display = a.style.display === 'block' ? 'none' : 'block';">
            <div class="math-rail">\\( ${q.q} \\)</div>
            <div class="ans" style="display:none; margin-top:15px; border-top:1px dashed var(--border); padding-top:15px; color:var(--accent)">
                <div class="math-rail">\\( ${q.a} \\)</div>
            </div>
        </div>
    `).join('');
    cont.scrollTop = 0;
    safeTypeset();
}

function populateLogs() {
    const cont = document.getElementById('logs-list');
    cont.innerHTML = Object.entries(failLogs).map(([q, c]) => `
        <div class="stat-box" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; text-align:left;">
            <div class="math-rail" style="font-size:0.85rem">\\( ${q} \\)</div>
            <span style="color:var(--accent); font-weight:800; margin-left:15px;">x${c}</span>
        </div>
    `).join('') || "<p class='label' style='padding:40px; text-align:center;'>No records found.</p>";
    cont.scrollTop = 0;
    safeTypeset();
}

window.startRepair = () => {
    const bad = Object.keys(failLogs);
    filteredQ = allQ.filter(q => bad.includes(q.q));
    window.showScreen('screen-difficulty');
};

window.toggleMute = () => {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "Sound Off" : "Quiet Mode";
};

init();
