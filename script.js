// --- 1. GLOBAL STATE & STORAGE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0}, global:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };

let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => { if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 }; });

// --- 2. AUDIO ENGINE ---
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

window.uiClick = function() { 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    playSound(600, 'sine', 0.1); 
};
const failSound = () => { playSound(100, 'sine', 0.4, 0.3); playSound(50, 'sine', 0.4, 0.3); };
const successSound = () => playSound(1200, 'sine', 0.2, 0.05);
const tickSound = () => playSound(1800, 'sine', 0.05, 0.02);

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 OFF" : "🔊 ON"; };

// --- 3. IDENTITY LOGIC ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard(); showScreen('screen-home');
    }
};

// --- 4. NAVIGATION ---
window.showScreen = (id) => {
    const allScreens = document.querySelectorAll('.screen');
    for (let i = 0; i < allScreens.length; i++) { allScreens[i].classList.add('hidden'); }
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
};

window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); window.showScreen('screen-game'); nextRound();
};

// --- 5. GAMEPLAY LOGIC ---
function updateHUD() {
    const lEl = document.getElementById('lives');
    const sEl = document.getElementById('streak');
    if(lEl) lEl.innerText = "❤️".repeat(Math.max(0, lives));
    if(sEl) sEl.innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    let opts = JSON.parse(JSON.stringify(currentQ.options)).sort(() => 0.5 - Math.random());
    opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });
    window.MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        if (bar) bar.style.width = ratio + "%";
        if (timeLeft < 3) { 
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            document.getElementById('red-alert').classList.remove('hidden'); 
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) { 
        score++; successSound();
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        updateHUD(); nextRound(); 
    }
    else handleWrong();
}

function handleWrong() {
    failSound(); lives--; updateHUD(); clearInterval(timerId);
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "FAILURE";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
};

function endGame() {
    document.getElementById('final-streak').innerText = score;
    window.showScreen('screen-over');
    updateHomeDashboard();
}

function updateHomeDashboard() {
    const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    safeSet('high-score', highScore); safeSet('user-callsign', callsign);
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    safeSet('global-proficiency', prof + "%");
}

async function init() {
    // Default safety questions
    allQuestions = [{ chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] }];
    roasts = ["Neural mismatch detected.", "Cognitive pattern error."];
    
    // In a real environment, this would fetch from mathformula.txt and roast.txt
    if (!callsign) window.showScreen('screen-login'); else { updateHomeDashboard(); window.showScreen('screen-home'); }
}
init();
