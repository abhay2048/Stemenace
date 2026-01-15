/**
 * STEMANACE NEURAL CALIBRATOR - CORE LOGIC
 * Optimized for Professional Dashboard UI
 */

// --- STATE & DATA ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0}, global:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

// Ensure history subjects exist
const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => { if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 }; });

// --- AUDIO ENGINE (Procedural Audio) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
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

window.uiClick = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); playProceduralSound(600, 'sine', 0.1); };
const failSound = () => { playProceduralSound(100, 'sine', 0.4, 0.4); playProceduralSound(50, 'sine', 0.4, 0.4); };
const successSound = () => playProceduralSound(1200, 'sine', 0.2, 0.05);
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

window.toggleMute = () => { 
    isMuted = !isMuted; 
    const btn = document.getElementById('mute-btn');
    if(btn) btn.innerText = isMuted ? "🔇 OFF" : "🔊 ON"; 
};

// --- NAVIGATION & LOGIN ---
window.submitLogin = () => {
    const input = document.getElementById('callsign-input');
    if (!input) return;
    const val = input.value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard(); 
        showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("ENTER CALLSIGN:");
    if(n) { 
        callsign = n.toUpperCase(); 
        localStorage.setItem('stemanaceCallsign', callsign); 
        updateHomeDashboard(); 
    }
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) {
        target.classList.remove('hidden');
        uiClick();
    }
    if (timerId) clearInterval(timerId);
};

// --- CHAPTER LOGIC ---
window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap.toLowerCase());
    window.showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedIds.includes(q.q));
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); 
    window.showScreen('screen-game'); 
    nextRound();
};

// --- GAMEPLAY CORE ---
function updateHUD() {
    const lEl = document.getElementById('lives'), sEl = document.getElementById('streak');
    if(lEl) lEl.innerText = "❤️".repeat(Math.max(0, lives));
    if(sEl) sEl.innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    
    // Reset visual alerts
    const alert = document.getElementById('red-alert');
    if(alert) alert.classList.add('hidden');
    document.querySelectorAll('.arena-screen').forEach(el => el.classList.remove('panic'));
    
    // Selection
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    // Render Formula
    const display = document.getElementById('formula-display');
    if(display) display.innerHTML = `\\[ ${currentQ.q} \\]`;
    
    // Render Options (2x2 Grid)
    const grid = document.getElementById('options-grid');
    if(!grid) return;
    grid.innerHTML = "";
    
    const opts = [...currentQ.options].sort(() => 0.5 - Math.random());
    opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn bold-text'; // Bold class for professional look
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    // RE-RENDER MATHJAX (Crucial for professional math view)
    if(window.MathJax) {
        window.MathJax.typesetPromise([display, grid]).catch(err => console.warn(err));
    }
    
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        if (bar) bar.style.width = ratio + "%";
        
        const eff = document.getElementById('efficiency');
        if (eff) eff.innerText = Math.max(0, Math.round(ratio)) + "%";
        
        if (timeLeft < 3) { 
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            const alert = document.getElementById('red-alert');
            if(alert) alert.classList.remove('hidden'); 
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        score++; successSound();
        if (score % 10 === 0 && lives < 3) lives++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        checkAchievements(); updateHUD(); nextRound();
    } else handleWrong();
}

function handleWrong() {
    failSound(); lives--; updateHUD(); clearInterval(timerId);
    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;
    
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
    
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });
    
    const roastEl = document.getElementById('roast-message');
    if(roastEl) roastEl.innerText = roasts[Math.floor(Math.random() * roasts.length)] || "NEURAL DISCONNECT.";
    
    const corrEl = document.getElementById('correction-display');
    if(corrEl) corrEl.innerHTML = `\\[ ${currentQ.correct} \\]`;
    
    const popup = document.getElementById('roast-popup');
    if(popup) {
        popup.classList.remove('hidden');
        if(window.MathJax) window.MathJax.typesetPromise([corrEl]);
    }
}

window.resumeAfterRoast = () => {
    const popup = document.getElementById('roast-popup');
    if(popup) popup.classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; 
        localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { 
            highScore = score; 
            localStorage.setItem('stemanaceHS', highScore); 
        }
        endGame();
    } else nextRound();
};

function checkAchievements() {
    if (score >= 76) achievements.singularity = true;
    if (currentQ && currentQ.chapter === 'calculus' && score >= 20) achievements.titan = true;
    if (lives === 1 && score >= 15) achievements.survivor = true;
    localStorage.setItem('stemanaceMedals', JSON.stringify(achievements));
}

function endGame() {
    const ranks = [{n:"SINGULARITY",t:76},{n:"NEURAL ACE",t:51},{n:"ARCHITECT",t:31},{n:"OPERATOR",t:16},{n:"VARIABLE",t:6},{n:"CONSTANT",t:0}];
    const r = ranks.find(x => score >= x.t);
    
    const fs = document.getElementById('final-streak');
    if(fs) fs.innerText = score;
    
    const frb = document.getElementById('final-rank-badge');
    if(frb) frb.innerText = r.n;
    
    const dl = document.getElementById('debt-list');
    if(dl) {
        dl.innerHTML = neuralDebt.map(d => `
            <div class="fail-log-item">
                <div class="fail-formula">\\(${d.q}\\) &rarr; <b>\\(${d.a}\\)</b></div>
            </div>
        `).join('');
        if(window.MathJax) window.MathJax.typesetPromise([dl]);
    }
    
    showScreen('screen-over');
    updateHomeDashboard();
}

// --- SAFE DASHBOARD UPDATE (Fixed Line 188 Error) ---
function updateHomeDashboard() {
    const ranks = [{n:"SINGULARITY",t:76},{n:"NEURAL ACE",t:51},{n:"ARCHITECT",t:31},{n:"OPERATOR",t:16},{n:"VARIABLE",t:6},{n:"CONSTANT",t:0}];
    const rank = ranks.find(x => highScore >= x.t);
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    
    // Map of every ID that could exist in Sidebar or Home
    const textMap = {
        'high-score': highScore,
        'side-high-score': highScore,
        'mobile-high-score': highScore,
        'user-callsign': callsign,
        'side-user-callsign': callsign,
        'display-callsign': callsign,
        'current-rank': rank.n,
        'global-proficiency': prof + "%",
        'side-global-proficiency': prof + "%",
        'mobile-proficiency': prof + "%",
        'total-drills': totalDrills
    };

    // Update text elements safely
    for (const [id, val] of Object.entries(textMap)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }
    
    // Achievement Medals (Safe injection)
    const meds = [{id:'titan',icon:'💎'},{id:'survivor',icon:'🛡️'},{id:'singularity',icon:'🌌'}];
    const html = meds.map(m => `<div class="medal ${achievements[m.id] ? 'unlocked' : 'locked'}" style="opacity: ${achievements[m.id] ? 1 : 0.2}">${m.icon}</div>`).join('');
    
    ['achievement-rack', 'side-achievement-rack', 'mobile-achievement-rack'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });

    const priorityBtn = document.getElementById('priority-btn');
    if (priorityBtn) {
        priorityBtn.style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';
    }
}

// --- DATA INITIALIZATION ---
async function init() {
    // Fallback data
    allQuestions = [{ chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] }];
    roasts = ["NEURAL DISCONNECT.", "TRY HARDER.", "ERROR IN CALIBRATION."];

    try {
        const res = await fetch('mathformula.txt');
        if (res.ok) {
            const text = await res.text();
            allQuestions = text.split('\n').filter(l => l.includes('::')).map(line => {
                const p = line.split('::').map(s => s.trim());
                return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
            });
        }
        const rRes = await fetch('roast.txt');
        if (rRes.ok) {
            const rText = await rRes.text();
            roasts = rText.split('\n').filter(l => l.trim() !== "");
        }
    } catch (e) {
        console.warn("External data could not be reached. Using local fallbacks.");
    }

    if (!callsign) {
        showScreen('screen-login');
    } else { 
        updateHomeDashboard(); 
        showScreen('screen-home'); 
    }
}

init();
