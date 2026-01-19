// --- AUDIO ENGINE: NEW GLITCH SOUND ---
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
window.uiClick = () => {
    // Layer 1: The sharp plastic click (High freq)
    playTone(1200, 'sine', 0.05, 0.1); 
    // Layer 2: The "depth" / switch weight (Lower freq triangle)
    playTone(150, 'triangle', 0.1, 0.15); 
};
// Success "Chime"
const successSound = () => {
    playTone(600, 'sine', 0.2, 0.1);
    setTimeout(() => playTone(900, 'sine', 0.3, 0.08), 50);
};

// Failure "Error"
const failSound = () => {
    playTone(120, 'square', 0.3, 0.1);
    playTone(80, 'square', 0.4, 0.1);
};

// Global Haptics & Clicks
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        playSystemSound('click');
        if(navigator.vibrate) navigator.vibrate(12);
    }
});

// --- STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global:{correct:0,total:0}, calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

const triggerMath = () => { if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise().catch(() => {}); };

// --- LOGIC ---
window.submitLogin = () => {
    const v = document.getElementById('callsign-input').value.trim().toUpperCase();
    if (v.length > 1) { callsign = v; localStorage.setItem('stemanaceCallsign', v); showScreen('screen-home'); }
};

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON"; };

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-home') updateHome();
    if (id === 'screen-learn') populateVault();
    if (id === 'screen-diagnostics') populateLogs();
};

function updateHome() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    const p = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = p + "%";
    document.getElementById('level-display').innerText = `LVL ${Math.floor(xp / 1000) + 1}`;
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
    document.getElementById('current-rank').innerText = "RANK: " + (highScore > 50 ? "ACE" : "CONSTANT");
    
    document.getElementById('priority-btn').classList.toggle('hidden', Object.keys(formulaAnalytics).length === 0);
    const rack = document.getElementById('achievement-rack');
    const meds = [{id:'titan',icon:'💎'}, {id:'survivor',icon:'🛡️'}, {id:'singularity',icon:'🌌'}];
    rack.innerHTML = meds.map(m => `<span style="opacity:${achievements[m.id]?1:0.1}">${m.icon}</span>`).join('');
}

window.selectChapter = (c) => { filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === c); showScreen('screen-difficulty'); };

window.selectDifficulty = (s) => { timeLimit = s; lives = 3; score = 0; neuralDebt = []; updateHUD(); showScreen('screen-game'); nextRound(); };

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('panic-overlay').classList.add('hidden');
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid'); grid.innerHTML = "";
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(o => {
        const b = document.createElement('button'); b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`; b.onclick = () => handleChoice(o);
        grid.appendChild(b);
    });
    triggerMath(); resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1; bar.style.width = (timeLeft / timeLimit) * 100 + "%";
        if (timeLeft <= 3 && timeLeft > 0) { if (Math.round(timeLeft * 10) % 5 === 0) playSystemSound('tick'); document.getElementById('panic-overlay').classList.remove('hidden'); }
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
    lives--; clearInterval(timerId); playSystemSound('fail');
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++; correctHistory[currentQ.chapter].total++;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "FATAL_SYNC_ERROR";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMath();
}

window.resumeAfterRoast = () => { document.getElementById('roast-popup').classList.add('hidden'); if (lives <= 0) endGame(); else nextRound(); };

function endGame() {
    if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
    localStorage.setItem('stemanaceXP', xp);
    document.getElementById('final-streak').innerText = score;
    document.getElementById('debt-list').innerHTML = neuralDebt.map(d => `<div class="vault-card" style="font-size:0.75rem">\\(${d.q}\\) → <b style="color:var(--accent)">\\(${d.a}\\)</b></div>`).join('');
    triggerMath(); showScreen('screen-over');
}

function updateHUD() { document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives)); document.getElementById('streak').innerText = score; }

function populateVault() {
    const l = document.getElementById('vault-content'); l.innerHTML = "";
    const groups = {}; allQuestions.forEach(q => { if(!groups[q.chapter]) groups[q.chapter] = []; groups[q.chapter].push(q); });
    for (const c in groups) {
        l.innerHTML += `<h3 class="label" style="margin:20px 0 10px">${c.toUpperCase()}</h3>`;
        groups[c].forEach(q => { l.innerHTML += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><div class="vault-q">\\(${q.q}\\)</div><div class="vault-a">\\(${q.correct}\\)</div></div>`; });
    }
    triggerMath();
}

function populateLogs() {
    const c = document.getElementById('diagnostic-results');
    const s = Object.entries(formulaAnalytics).sort(([,a],[,b])=>b-a);
    c.innerHTML = s.map(([f,co]) => `<div class="vault-card" style="display:flex; justify-content:space-between"><div>\\(${f}\\)</div><b style="color:var(--primary)">${co}</b></div>`).join('') || "<p class='label'>CLEAN_LOGS</p>";
    triggerMath();
}

async function init() {
    try {
        const [fR, rR] = await Promise.all([fetch('mathformula.txt'), fetch('roast.txt')]);
        if (fR.ok) allQuestions = (await fR.text()).split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::'); return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
        });
        if (rR.ok) roasts = (await rR.text()).split('\n').filter(l => l.trim() !== "");
    } catch(e) {}
    if (allQuestions.length === 0) allQuestions = [{chapter:"SYS", q:"1+1", correct:"2", options:["2","3","4","5"]}];
    if (!callsign) showScreen('screen-login'); else showScreen('screen-home');
}
init();

