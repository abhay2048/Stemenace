// --- STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global:{correct:0,total:0}, calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0} };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

// --- THE FIX: MATH RENDERING ---
function triggerMathUpdates() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(err => console.log("MathJax busy..."));
    }
}

// --- AUDIO ---
// --- IMPROVED AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, volume, decay = true) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Satisfying "Mechanical" Click
/ Satisfying mechanical click logic
window.uiClick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // LAYER 1: The mechanical "snap" (High Frequency)
    playSound(1400, 'sine', 0.05, 0.08); 
    
    // LAYER 2: The button "depth/thump" (Low Frequency Triangle)
    setTimeout(() => {
        playSound(160, 'triangle', 0.1, 0.12);
    }, 10);
};

// Success Sound Update (Polite Chime)
const successSound = () => {
    playSound(800, 'sine', 0.1, 0.1);
    setTimeout(() => playSound(1200, 'sine', 0.15, 0.07), 40);
};

// Failure "Error"
const failSound = () => {
    playTone(120, 'square', 0.3, 0.1);
    playTone(80, 'square', 0.4, 0.1);
};

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO: OFF" : "🔊 AUDIO: ON"; };

// --- NAVIGATION ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("ENTER CALLSIGN:");
    if(n) { callsign = n.toUpperCase(); localStorage.setItem('stemanaceCallsign', callsign); updateHomeDashboard(); }
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-home') updateHomeDashboard();
    if (id === 'screen-learn') populateVault();
    if (id === 'screen-diagnostics') populateDiagnostics();
};

function updateHomeDashboard() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
    document.getElementById('level-display').innerText = LVL ${Math.floor(xp / 1000) + 1};
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
    const rank = highScore > 50 ? "NEURAL ACE" : highScore > 20 ? "OPERATOR" : "CONSTANT";
    document.getElementById('current-rank').innerText = "RANK: " + rank;
    document.getElementById('priority-btn').style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';
}

// --- GAME CORE ---
window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedIds.indexOf(q.q) !== -1);
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
    document.getElementById('formula-display').innerHTML = \\[ ${currentQ.q} \\];
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = \\( ${opt} \\);
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });
    triggerMathUpdates();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        bar.style.width = (timeLeft / timeLimit) * 100 + "%";
        if (timeLeft < 3) document.getElementById('panic-overlay').classList.remove('hidden');
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        successSound();
        score++;
        xp += 25;
        
        const chamber = document.getElementById('formula-chamber');
        chamber.style.borderColor = 'var(--accent)';
        chamber.style.boxShadow = '0 0 30px rgba(8, 217, 214, 0.3)';
        
        setTimeout(() => {
            chamber.style.borderColor = 'var(--glass-border)';
            chamber.style.boxShadow = 'none';
            nextRound();
        }, 200);
    } else {
        handleWrong();
    }
    updateHUD();
}
function handleWrong() {
    lives--; clearInterval(timerId); failSound();
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "SYNC_FAILED";
    document.getElementById('correction-display').innerHTML = \\[ ${currentQ.correct} \\];
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMathUpdates();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
};

function endGame() {
    if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
    localStorage.setItem('stemanaceXP', xp);
    document.getElementById('final-streak').innerText = score;
    document.getElementById('final-rank-badge').innerText = score > 20 ? "OPERATOR" : "CONSTANT";
    document.getElementById('debt-list').innerHTML = neuralDebt.map(d => <div class="vault-card" style="font-size:0.7rem">\\(${d.q}\\) → <b>\\(${d.a}\\)</b></div>).join('');
    triggerMathUpdates();
    showScreen('screen-over');
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

// --- POPULATE ---
function populateVault() {
    const list = document.getElementById('vault-content');
    let html = ""; const groups = {};
    allQuestions.forEach(q => { if(!groups[q.chapter]) groups[q.chapter] = []; groups[q.chapter].push(q); });
    for (const c in groups) {
        html += <h3 class="label" style="margin-top:20px">${c.toUpperCase()}</h3>;
        groups[c].forEach(q => {
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed')">
                <div class="vault-q">\\(${q.q}\\)</div>
                <div class="vault-a">\\(${q.correct}\\)</div>
            </div>`;
        });
    }
    list.innerHTML = html;
    triggerMathUpdates();
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const sorted = Object.entries(formulaAnalytics).sort(([,a],[,b])=>b-a);
    container.innerHTML = sorted.map(([f,c]) => <div class="fail-log-item"><div class="fail-formula">\\(${f}\\)</div><div class="fail-count-badge">${c}</div></div>).join('') || "<p class='label'>CLEAN_LOGS</p>";
    triggerMathUpdates();
}

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
    } catch(e) {}
    if (allQuestions.length === 0) allQuestions = [{chapter:"SYSTEM", q:"1+1", correct:"2", options:["2","3","4","5"]}];
    if (!callsign) showScreen('screen-login'); else showScreen('screen-home');
}
init();
