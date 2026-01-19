/**
 * STEMANACE - INDESTRUCTIBLE CORE v2.2
 * Specifically tuned for GitHub Pages & Mobile
 */

// --- INTERNAL DATA FALLBACK (If .txt files fail to load) ---
const FALLBACK_QUESTIONS = [
    {chapter:"Trigonometry", q:"\\sin^2 x + \\cos^2 x", correct:"1", options:["1","0","\\tan x","\\sec x"]},
    {chapter:"Calculus", q:"\\frac{d}{dx} e^x", correct:"e^x", options:["e^x","xe^{x-1}","\\log x","1"]},
    {chapter:"Trigonometry", q:"\\tan(45^\\circ)", correct:"1", options:["1","0","\\sqrt{3}","1/\\sqrt{3}"]},
    {chapter:"Calculus", q:"\\int \\frac{1}{x} dx", correct:"\\log|x|+C", options:["\\log|x|+C","x^2/2","e^x","1"]}
];

const FALLBACK_ROASTS = [
    "Brain.exe has encountered an error.",
    "Is your hardware outdated or just the operator?",
    "Calculus isn't for everyone. Maybe try Art?",
    "Error 404: Correct answer not found in your brain."
];

// --- APP STATE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [];
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let xp = parseInt(localStorage.getItem('stemanaceXP')) || 0;
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false, currentQ = null;

// --- CORE ENGINE ---

// Safe Math Rendering
function triggerMathUpdates() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => console.log("MathJax Wait"));
    }
}

// Audio logic
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
    playSound(1400, 'sine', 0.05, 0.08); 
};

// Navigation (The most critical part)
window.showScreen = function(id) {
    console.log("Switching to screen:", id);
    const screens = document.querySelectorAll('.screen');
    const target = document.getElementById(id);
    
    if (!target) {
        alert("CRITICAL ERROR: Screen '" + id + "' not found. Check your HTML IDs.");
        return;
    }

    screens.forEach(s => s.classList.add('hidden'));
    target.classList.remove('hidden');

    if (timerId) clearInterval(timerId);
    if (id === 'screen-home') updateHomeDashboard();
    if (id === 'screen-learn') populateVault();
    if (id === 'screen-diagnostics') populateDiagnostics();
};

window.submitLogin = function() {
    // Try to find the input in two different ways just in case
    const input = document.getElementById('callsign-input') || document.querySelector('input[type="text"]');
    
    console.log("Input found:", input);
    
    if (input && input.value.trim() !== "") {
        callsign = input.value.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        
        // Success! Move to home screen
        window.showScreen('screen-home');
    } else {
        alert("PLEASE ENTER A NAME IN THE BOX");
    }
};
function updateHomeDashboard() {
    document.getElementById('user-callsign').innerText = callsign || "GUEST";
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('level-display').innerText = `LVL ${Math.floor(xp / 1000) + 1}`;
    document.getElementById('xp-fill').style.width = (xp % 1000) / 10 + "%";
}

// --- GAMEPLAY ---
window.selectChapter = function(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap.toLowerCase());
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = function(sec) {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); 
    window.showScreen('screen-game'); 
    nextRound();
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
    window.uiClick();
    if (choice === currentQ.correct) {
        score++; xp += 25;
        document.getElementById('formula-chamber').style.borderColor = 'var(--accent)';
        setTimeout(() => { 
            document.getElementById('formula-chamber').style.borderColor = 'var(--glass-border)'; 
            nextRound(); 
        }, 200);
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

window.resumeAfterRoast = function() {
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

// --- VAULT & LOGS ---
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
                <div class="vault-a">\\(${q.correct}\\)</div>
            </div>`;
        });
    }
    list.innerHTML = html;
    triggerMathUpdates();
}

function populateDiagnostics() {
    document.getElementById('diagnostic-results').innerHTML = neuralDebt.map(d => `<div class="fail-log-item">\\(${d.q}\\) → \\(${d.a}\\)</div>`).join('') || "<p class='label'>CLEAN_LOGS</p>";
    triggerMathUpdates();
}

// --- INITIALIZATION ---
async function startApp() {
    console.log("Initializing STEMANACE...");
    
    try {
        const [fRes, rRes] = await Promise.all([
            fetch('./mathformula.txt'),
            fetch('./roast.txt')
        ]);
        
        if (fRes.ok) {
            const text = await fRes.text();
            allQuestions = text.split('\n').filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }

        if (rRes.ok) {
            const text = await rRes.text();
            roasts = text.split('\n').filter(l => l.trim() !== "");
        }
    } catch (e) {
        console.warn("External files not found, using internal database.");
    }

    // Load fallbacks if needed
    if (allQuestions.length === 0) allQuestions = FALLBACK_QUESTIONS;
    if (roasts.length === 0) roasts = FALLBACK_ROASTS;

    // Show initial screen
    if (!callsign) window.showScreen('screen-login');
    else window.showScreen('screen-home');
}

// Run as soon as page loads
window.onload = startApp;

