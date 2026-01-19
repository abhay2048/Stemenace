// --- STATE MANAGEMENT ---
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
        window.MathJax.typesetPromise().catch(() => {});
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

// --- NAVIGATION CORE ---
window.showScreen = (id) => {
    const screens = document.querySelectorAll('.screen');
    const target = document.getElementById(id);
    
    if (!target) {
        console.error("Critical Error: Screen ID '" + id + "' not found in HTML.");
        return;
    }

    screens.forEach(s => s.classList.add('hidden'));
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
        window.showScreen('screen-home');
    }
};

function updateHomeDashboard() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('level-display').innerText = `LVL ${Math.floor(xp / 1000) + 1}`;
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
}

// --- GAMEPLAY ---
window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap.toLowerCase());
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); 
    window.showScreen('screen-game'); 
    nextRound();
};

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('panic-overlay').classList.add('hidden');
    
    if (filteredQuestions.length === 0) {
        alert("Domain database empty. Reloading core...");
        return window.showScreen('screen-home');
    }

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
    window.uiClick();
    if (choice === currentQ.correct) {
        score++; xp += 25;
        const chamber = document.getElementById('formula-chamber');
        chamber.style.borderColor = 'var(--accent)';
        setTimeout(() => { chamber.style.borderColor = 'var(--glass-border)'; nextRound(); }, 200);
    } else {
        handleWrong();
    }
    updateHUD();
}

function handleWrong() {
    lives--; clearInterval(timerId); 
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "SYNC_FAILED";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMathUpdates();
}

window.resumeAfterRoast = () => {
    window.uiClick();
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        window.showScreen('screen-over');
        document.getElementById('final-streak').innerText = score;
    } else {
        nextRound();
    }
};

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        bar.style.width = (timeLeft / timeLimit) * 100 + "%";
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

// --- VAULT POPULATION ---
function populateVault() {
    const list = document.getElementById('vault-content');
    let html = ""; const groups = {};
    allQuestions.forEach(q => { if(!groups[q.chapter]) groups[q.chapter] = []; groups[q.chapter].push(q); });
    for (const c in groups) {
        html += `<h3 class="label" style="margin:30px 0 10px">// ${c.toUpperCase()}</h3>`;
        groups[c].forEach(q => {
            html += `<div class="vault-card" onclick="this.classList.toggle('revealed'); window.uiClick();">
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

// --- APP INITIALIZATION ---
async function initApp() {
    try {
        // Use relative paths for GitHub Pages
        const [fRes, rRes] = await Promise.all([
            fetch('./mathformula.txt'), 
            fetch('./roast.txt')
        ]);
        
        if (fRes.ok) {
            const fText = await fRes.text();
            allQuestions = fText.split('\n').filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }
        if (rRes.ok) {
            const rText = await rRes.text();
            roasts = rText.split('\n').filter(l => l.trim() !== "");
        }
    } catch(e) {
        console.warn("Fetch failed, using local fail-safe.");
    }

    // FAIL-SAFE DATA (In case GitHub blocks files)
    if (allQuestions.length === 0) {
        allQuestions = [
            {chapter:"Trigonometry", q:"\\sin^2 x + \\cos^2 x", correct:"1", options:["1","0","\\tan x","\\sec x"]},
            {chapter:"Calculus", q:"\\frac{d}{dx} e^x", correct:"e^x", options:["e^x","xe^{x-1}","\\log x","1"]}
        ];
    }
    if (roasts.length === 0) roasts = ["Brain.exe stopped working.", "Error 404: Logic not found."];

    // Start screen
    if (!callsign) window.showScreen('screen-login'); 
    else window.showScreen('screen-home');
}

// Wait for DOM to be fully ready
window.addEventListener('DOMContentLoaded', initApp);
