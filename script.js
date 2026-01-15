// --- STATE & DATA ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus:{correct:0,total:0}, trigonometry:{correct:0,total:0}, global:{correct:0,total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;

// Repair History Storage
const subjects = ['global', 'calculus', 'trigonometry'];
subjects.forEach(s => { if (!correctHistory[s]) correctHistory[s] = { correct: 0, total: 0 }; });

// --- AUDIO ENGINE ---
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

window.toggleMute = () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? "🔇 OFF" : "🔊 ON"; };

// --- LOGIC ---
window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value;
    if (val.trim().length > 1) {
        callsign = val.trim().toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard(); showScreen('screen-home');
    }
};

window.changeCallsign = () => {
    const n = prompt("ENTER CALLSIGN:");
    if(n) { callsign = n.toUpperCase(); localStorage.setItem('stemanaceCallsign', callsign); updateHomeDashboard(); }
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
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

window.selectPriorityDrill = () => {
    const failedIds = Object.keys(formulaAnalytics);
    filteredQuestions = allQuestions.filter(q => failedIds.includes(q.q));
    window.showScreen('screen-difficulty');
};

window.selectDifficulty = (sec) => {
    timeLimit = sec; lives = 3; score = 0; neuralDebt = [];
    updateHUD(); window.showScreen('screen-game'); nextRound();
};

function updateHUD() {
    const lEl = document.getElementById('lives'), sEl = document.getElementById('streak');
    if(lEl) lEl.innerText = "❤️".repeat(Math.max(0, lives));
    if(sEl) sEl.innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('.arena-screen')?.classList.remove('panic');
    if (filteredQuestions.length === 0) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    const opts = JSON.parse(JSON.stringify(currentQ.options)).sort(() => 0.5 - Math.random());
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
        const eff = document.getElementById('efficiency');
        if (eff) eff.innerText = Math.max(0, Math.round(ratio)) + "%";
        if (timeLeft < 3) { 
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            document.getElementById('red-alert').classList.remove('hidden'); 
            document.querySelector('.arena-screen')?.classList.add('panic'); 
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
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "FAILURE.";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        totalDrills++; localStorage.setItem('stemanaceDrills', totalDrills);
        if (score > highScore) { highScore = score; localStorage.setItem('stemanaceHS', highScore); }
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
    const r = [{n:"SINGULARITY",t:76},{n:"NEURAL ACE",t:51},{n:"ARCHITECT",t:31},{n:"OPERATOR",t:16},{n:"VARIABLE",t:6},{n:"CONSTANT",t:0}].find(x => score >= x.t);
    document.getElementById('final-streak').innerText = score;
    document.getElementById('final-rank-badge').innerText = r.n;
    document.getElementById('debt-list').innerHTML = neuralDebt.map(d => `<div style="margin-bottom:10px; border-bottom:1px solid var(--border)">\\(${d.q}\\) → <b>\\(${d.a}\\)</b></div>`).join('');
    window.MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

function updateHomeDashboard() {
    const rank = [{n:"SINGULARITY",t:76},{n:"NEURAL ACE",t:51},{n:"ARCHITECT",t:31},{n:"OPERATOR",t:16},{n:"VARIABLE",t:6},{n:"CONSTANT",t:0}].find(x => highScore >= x.t);
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    
    const ids = ['high-score', 'side-high-score', 'mobile-high-score', 'user-callsign', 'side-user-callsign', 'display-callsign', 'current-rank', 'global-proficiency', 'side-global-proficiency', 'mobile-proficiency'];
    ids.forEach(id => {
        const el = document.getElementById(id); if(!el) return;
        if(id.includes('high-score')) el.innerText = highScore;
        else if(id.includes('callsign')) el.innerText = callsign;
        else if(id.includes('rank')) el.innerText = rank.n;
        else if(id.includes('proficiency')) el.innerText = prof + "%";
    });
    
    const meds = [{id:'titan',icon:'💎'},{id:'survivor',icon:'🛡️'},{id:'singularity',icon:'🌌'}];
    const html = meds.map(m => `<div class="medal ${achievements[m.id] ? 'unlocked' : ''}">${m.icon}</div>`).join('');
    document.getElementById('side-achievement-rack').innerHTML = html;
    document.getElementById('mobile-achievement-rack').innerHTML = html;
    document.getElementById('priority-btn').style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';
}

async function init() {
    allQuestions = [{ chapter: "calculus", q: "\\int x^n dx", correct: "\\frac{x^{n+1}}{n+1} + C", options: ["\\frac{x^{n+1}}{n+1} + C", "nx^{n-1}", "x^{n+1}", "x^n"] }];
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
        if (rRes.ok) roasts = (await rRes.text()).split('\n').filter(l => l.trim() !== "");
    } catch (e) {}
    if (!callsign) showScreen('screen-login'); else { updateHomeDashboard(); showScreen('screen-home'); }
}
init();
