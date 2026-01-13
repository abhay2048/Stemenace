// --- 1. CONFIGURATION & STATE ---
let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = [];
let currentQ = null;
let score = 0;
let lives = 3;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- 2. THE "NUCLEAR" STORAGE RESET ---
// This block ensures the game structure is PERFECT before anything else runs
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};

let correctHistory;
try {
    const rawHistory = localStorage.getItem('stemanaceHistory');
    correctHistory = JSON.parse(rawHistory) || {};
    // If these specific keys don't exist, the game crashes. Let's force them.
    if (!correctHistory.global) correctHistory.global = { correct: 0, total: 0 };
    if (!correctHistory.calculus) correctHistory.calculus = { correct: 0, total: 0 };
    if (!correctHistory.trigonometry) correctHistory.trigonometry = { correct: 0, total: 0 };
} catch (e) {
    // If the data is so broken it won't even parse, wipe it clean
    correctHistory = {
        global: { correct: 0, total: 0 },
        calculus: { correct: 0, total: 0 },
        trigonometry: { correct: 0, total: 0 }
    };
}
localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));

// --- 3. AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}
const uiClick = () => playProceduralSound(600, 'sine', 0.1);
const failSound = () => { playProceduralSound(150, 'triangle', 0.5, 0.2); playProceduralSound(60, 'sine', 0.5, 0.3); };
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

function toggleMute() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- 4. INITIALIZATION ---
async function init() {
    // 1. Load backup data immediately so buttons work even if fetch fails
    allQuestions = [
        { chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] },
        { chapter: "trigonometry", q: "\\sin^2 x + \\cos^2 x", correct: "1", options: ["1", "0", "\\tan x", "-1"] }
    ];
    roasts = ["Neural drift identified.", "Pattern mismatch detected."];

    try {
        const res = await fetch('mathformula.txt');
        if (res.ok) {
            const text = await res.text();
            const parsed = text.split('\n').filter(l => l.includes('::')).map(line => {
                const p = line.split('::').map(s => s.trim());
                return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
            });
            if (parsed.length > 0) allQuestions = parsed;
        }

        const roastRes = await fetch('roast.txt');
        if (roastRes.ok) {
            const roastText = await roastRes.text();
            const parsedRoasts = roastText.split('\n').filter(l => l.trim() !== "");
            if (parsedRoasts.length > 0) roasts = parsedRoasts;
        }
    } catch (e) {
        console.warn("Server Database Offline. Using Neural Backup.");
    }

    updateHomeDashboard();
    showScreen('screen-home');
}

function updateHomeDashboard() {
    // Use Optional Chaining (?.) to prevent crashes if stats are somehow missing
    document.getElementById('high-score').innerText = highScore || 0;
    document.getElementById('total-drills').innerText = totalDrills || 0;
    
    const s = highScore || 0;
    let rankName = "CONSTANT";
    if (s >= 76) rankName = "SINGULARITY";
    else if (s >= 51) rankName = "NEURAL ACE";
    else if (s >= 31) rankName = "ARCHITECT";
    else if (s >= 16) rankName = "OPERATOR";
    else if (s >= 6) rankName = "VARIABLE";
    
    document.getElementById('current-rank').innerText = rankName;
    
    const total = correctHistory?.global?.total || 0;
    const correct = correctHistory?.global?.correct || 0;
    const prof = total > 0 ? Math.round((correct / total) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
}

// --- 5. NAVIGATION ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
    }
    
    if (id === 'screen-diagnostics') populateDiagnostics();
    if (id === 'screen-learn') populateVault();
    if (timerId) clearInterval(timerId);
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    // If someone clicks a chapter that isn't in the .txt yet, give them everything
    if(filteredQuestions.length === 0) filteredQuestions = allQuestions; 
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec;
    lives = 3;
    score = 0;
    neuralDebt = [];
    updateHUD();
    showScreen('screen-game');
    nextRound();
}

// --- 6. GAMEPLAY ---
function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');

    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => { uiClick(); handleChoice(opt); };
        grid.appendChild(btn);
    });

    if (window.MathJax) MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        bar.style.width = ratio + "%";
        document.getElementById('efficiency').innerText = Math.max(0, Math.round(ratio)) + "%";
        
        if (timeLeft < 3) {
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            document.getElementById('red-alert').classList.remove('hidden');
            document.querySelector('#screen-game').classList.add('panic');
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (!currentQ) return;
    const isCorrect = (choice === currentQ.correct);
    
    // Safety check for subject history
    if (!correctHistory[currentQ.chapter]) {
        correctHistory[currentQ.chapter] = { correct: 0, total: 0 };
    }

    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    
    if (isCorrect) {
        score++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
        updateHUD(); 
        nextRound();
    } else {
        handleWrong();
    }
}

function handleWrong() {
    failSound(); 
    clearInterval(timerId); 
    lives--;
    
    const fID = currentQ ? currentQ.q : "unknown";
    formulaAnalytics[fID] = (formulaAnalytics[fID] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    
    if (currentQ) neuralDebt.push({ q: currentQ.q, a: currentQ.correct });

    const msg = roasts[Math.floor(Math.random() * roasts.length)] || "CALIBRATION ERROR.";
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = currentQ ? `\\[ ${currentQ.correct} \\]` : "";
    document.getElementById('roast-popup').classList.remove('hidden');
    if (window.MathJax) MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; 
        localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { 
            highScore = score; 
            localStorage.setItem('stemanaceHS', highScore); 
        }
        endGame();
    } else {
        nextRound();
    }
}

function endGame() {
    const rankObj = getRankInfo(score);
    document.getElementById('final-streak').innerText = score;
    const badge = document.getElementById('final-rank');
    if (badge) {
        badge.innerText = rankObj.name;
        badge.style.backgroundColor = rankObj.color;
    }
    
    const debtEl = document.getElementById('debt-list');
    if (debtEl) {
        debtEl.innerHTML = neuralDebt.length > 0 ? 
            neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="color:var(--text)">\\(${d.a}\\)</span></div>`).join('') :
            "<p>System Optimized. No debt.</p>";
    }
    
    if (window.MathJax) MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

function getRankInfo(s) {
    const RANKS = [
        { name: "CONSTANT", threshold: 0, color: "#64748b" },
        { name: "VARIABLE", threshold: 6, color: "#10b981" },
        { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
        { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
        { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
        { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
    ];
    return [...RANKS].reverse().find(r => s >= r.threshold);
}

function populateDiagnostics() {
    const container = document.getElementById('diagnostic-results');
    const getP = (sub) => {
        const data = correctHistory[sub];
        return (data && data.total > 0) ? Math.round((data.correct / data.total) * 100) : 0;
    };
    
    container.innerHTML = `
        <div class="diag-card"><span class="diag-title">CALCULUS_STABILITY</span><div class="diag-subject">${getP('calculus')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('calculus')}%"></div></div></div>
        <div class="diag-card"><span class="diag-title">TRIG_STABILITY</span><div class="diag-subject">${getP('trigonometry')}%</div><div class="diag-bar-bg"><div class="diag-bar-fill" style="width:${getP('trigonometry')}%"></div></div></div>
    `;
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => { (acc[q.chapter] = acc[q.chapter] || []).push(q); return acc; }, {});
    let html = "";
    for (const chap in grouped) {
        html += `<h3 class="vault-header">${chap.toUpperCase()}</h3>`;
        grouped[chap].forEach(q => { 
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed')"><span class="vault-q">\\(${q.q}\\)</span><div class="vault-a">\\(${q.correct}\\)</div></div>`; 
        });
    }
    list.innerHTML = html;
    if (window.MathJax) MathJax.typesetPromise();
}

function shareResult() {
    const rankInfo = getRankInfo(score);
    const text = `SYSTEM REPORT: I cleared the STEMANACE Arena with a streak of ${score}.\nNEURAL TIER: [${rankInfo.name}]\n\nCan you beat me? ${window.location.href}`;
    if (navigator.share) navigator.share({ title: 'STEMANACE Performance', text: text, url: window.location.href });
    else alert("Copied to clipboard!");
}

// Run init
init();
