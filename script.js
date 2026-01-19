// --- STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global:{correct:0,total:0}, calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0} };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

// --- MATH RENDERING ---
function triggerMathUpdates() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(err => console.log("MathJax busy..."));
    }
}

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}

window.uiClick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playSound(1400, 'sine', 0.05, 0.08); 
    setTimeout(() => playSound(160, 'triangle', 0.1, 0.12), 10);
};

const successSound = () => playSound(800, 'sine', 0.1, 0.1);
const failSound = () => { playSound(120, 'square', 0.3, 0.1); playSound(80, 'square', 0.4, 0.1); };

window.toggleMute = () => { 
    isMuted = !isMuted; 
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO: OFF" : "🔊 AUDIO: ON"; 
};

// --- NAVIGATION (FIXED) ---
window.showScreen = (id) => {
    console.log("Navigating to:", id); // Debug log
    const target = document.getElementById(id);
    if (!target) return console.error("Screen not found:", id);

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    target.classList.remove('hidden');

    if (timerId) clearInterval(timerId);
    if (id === 'screen-home') updateHomeDashboard();
    if (id === 'screen-learn') { populateVault(); setTimeout(triggerMathUpdates, 100); }
    if (id === 'screen-diagnostics') { populateDiagnostics(); setTimeout(triggerMathUpdates, 100); }
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        showScreen('screen-home');
    }
};

function updateHomeDashboard() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
    document.getElementById('level-display').innerText = `LVL ${Math.floor(xp / 1000) + 1}`;
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
}

// --- GAME LOGIC ---
window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); showScreen('screen-game'); nextRound();
};

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('panic-overlay').classList.add('hidden');
    
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });
    
    triggerMathUpdates();
    resetTimer();
}

function handleChoice(choice) {
    uiClick();
    if (choice === currentQ.correct) {
        successSound(); score++; xp += 25;
        const chamber = document.getElementById('formula-chamber');
        chamber.style.borderColor = 'var(--accent)';
        setTimeout(() => { chamber.style.borderColor = 'var(--glass-border)'; nextRound(); }, 200);
    } else handleWrong();
    updateHUD();
}

function handleWrong() {
    lives--; clearInterval(timerId); failSound();
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "SYNC_FAILED";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMathUpdates();
}

window.resumeAfterRoast = () => {
    uiClick();
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
};

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function endGame() {
    showScreen('screen-over');
    document.getElementById('final-streak').innerText = score;
    triggerMathUpdates();
}

// --- VAULT & LOGS (NEW FLASHCARD STYLE) ---
function populateVault() {
    const list = document.getElementById('vault-content');
    let html = ""; const groups = {};
    allQuestions.forEach(q => { if(!groups[q.chapter]) groups[q.chapter] = []; groups[q.chapter].push(q); });
    for (const c in groups) {
        html += `<h3 class="label" style="margin:30px 0 10px">// ${c.toUpperCase()}</h3>`;
        groups[c].forEach(q => {
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed'); uiClick();">
                <div class="label" style="opacity:0.5; margin-bottom:10px">PROMPT</div>
                <div class="vault-q">\\(${q.q}\\)</div>
                <div class="vault-a">
                    <div class="label" style="color:var(--accent); margin-bottom:10px">IDENTITY</div>
                    \\(${q.correct}\\)
                </div>
            </div>`;
        });
    }
    list.innerHTML = html;
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    container.innerHTML = neuralDebt.map(d => `<div class="fail-log-item">\\(${d.q}\\) → \\(${d.a}\\)</div>`).join('') || "<p class='label'>CLEAN_LOGS</p>";
}

// --- INITIALIZE ---
async function init() {
    try {
        const [fRes, rRes] = await Promise.all([fetch('mathformula.txt'), fetch('roast.txt')]);
        if (fRes.ok) {
            allQuestions = (await fRes.text()).split('\n').filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }
        if (rRes.ok) roasts = (await rRes.text()).split('\n').filter(l => l.trim() !== "");
    } catch(e) { console.warn("Local fetch blocked. Using dummy data."); }
    
    if (allQuestions.length === 0) allQuestions = [{chapter:"SYSTEM", q:"1+1", correct:"2", options:["2","3","4","5"]}];
    if (!callsign) showScreen('screen-login'); else showScreen('screen-home');
}
init();
