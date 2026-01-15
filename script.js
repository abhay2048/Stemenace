/**
 * STEMANACE NEURAL CALIBRATOR - CORE LOGIC (FIXED)
 */

// --- STATE & DATA ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let totalDrills = parseInt(localStorage.getItem('stemanaceDrills')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || {
    calculus:{correct:0,total:0},
    trigonometry:{correct:0,total:0},
    global:{correct:0,total:0}
};
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || {
    titan:false, survivor:false, singularity:false
};

let timerId = null, timeLimit = 30, timeLeft = 30, isMuted = false;
let roundActive = false;

// --- SUBJECT SAFETY ---
['global','calculus','trigonometry'].forEach(s => {
    if (!correctHistory[s]) correctHistory[s] = {correct:0,total:0};
});

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch {}
}

window.uiClick = () => playProceduralSound(600, 'sine', 0.1);
const failSound = () => { playProceduralSound(100,'sine',0.4,0.4); playProceduralSound(50,'sine',0.4,0.4); };
const successSound = () => playProceduralSound(1200,'sine',0.2,0.05);
const tickSound = () => playProceduralSound(1800,'sine',0.05,0.02);

window.toggleMute = () => {
    isMuted = !isMuted;
    document.getElementById('mute-btn')?.innerText = isMuted ? "🔇 OFF" : "🔊 ON";
};

// --- NAVIGATION ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    uiClick();
};

// --- LOGIN ---
window.submitLogin = () => {
    const v = document.getElementById('callsign-input')?.value.trim();
    if (v?.length > 1) {
        callsign = v.toUpperCase();
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard();
        showScreen('screen-home');
    }
};

// --- CHAPTER ---
window.selectChapter = chap => {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap.toLowerCase());
    showScreen('screen-difficulty');
};

window.selectPriorityDrill = () => {
    const norm = s => s.replace(/\s+/g,'');
    const failed = Object.keys(formulaAnalytics).map(norm);
    filteredQuestions = allQuestions.filter(q => failed.includes(norm(q.q)));
    showScreen('screen-difficulty');
};

window.selectDifficulty = sec => {
    timeLimit = sec;
    lives = 3;
    score = 0;
    neuralDebt = [];
    updateHUD();
    showScreen('screen-game');
    nextRound();
};

// --- HUD ---
function updateHUD() {
    document.getElementById('lives')?.innerText = "❤️".repeat(Math.max(0,lives));
    document.getElementById('streak')?.innerText = score;
}

// --- GAMEPLAY ---
function nextRound() {
    clearInterval(timerId);
    roundActive = true;

    document.getElementById('red-alert')?.classList.add('hidden');

    if (!filteredQuestions.length) filteredQuestions = allQuestions;
    currentQ = filteredQuestions[Math.floor(Math.random()*filteredQuestions.length)];

    const display = document.getElementById('formula-display');
    if (display) display.innerHTML = `\\[ ${currentQ.q} \\]`;

    const grid = document.getElementById('options-grid');
    if (!grid) return;
    grid.innerHTML = "";

    [...currentQ.options].sort(()=>Math.random()-0.5).forEach(opt => {
        const b = document.createElement('button');
        b.className = 'opt-btn bold-text';
        b.innerHTML = `\\(${opt}\\)`;
        b.onclick = () => handleChoice(opt);
        grid.appendChild(b);
    });

    window.MathJax?.typesetPromise([display, grid]);
    resetTimer();
}

function resetTimer() {
    const start = performance.now();
    clearInterval(timerId);

    timerId = setInterval(() => {
        if (!roundActive) return;

        const elapsed = (performance.now() - start) / 1000;
        timeLeft = Math.max(0, timeLimit - elapsed);
        const ratio = (timeLeft / timeLimit) * 100;

        document.getElementById('timer-fill')?.style.setProperty('width', ratio+"%");
        document.getElementById('efficiency')?.innerText = Math.round(ratio)+"%";

        if (timeLeft < 3) {
            if (Math.floor(elapsed*10)%2===0) tickSound();
            document.getElementById('red-alert')?.classList.remove('hidden');
        }

        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (!roundActive) return;
    roundActive = false;

    correctHistory.global.total++;
    correctHistory[currentQ.chapter].total++;

    if (choice === currentQ.correct) {
        score++;
        successSound();
        if (score % 10 === 0 && lives < 3) lives++;
        correctHistory.global.correct++;
        correctHistory[currentQ.chapter].correct++;
        checkAchievements();
        updateHUD();
        nextRound();
    } else {
        handleWrong();
    }

    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
}

function handleWrong() {
    if (!roundActive) return;
    roundActive = false;

    failSound();
    lives--;
    updateHUD();

    formulaAnalytics[currentQ.q] = (formulaAnalytics[currentQ.q] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));

    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });

    document.getElementById('roast-message')!.innerText =
        roasts[Math.floor(Math.random()*roasts.length)] || "NEURAL DISCONNECT.";

    const corr = document.getElementById('correction-display');
    if (corr) corr.innerHTML = `\\[ ${currentQ.correct} \\]`;

    document.getElementById('roast-popup')?.classList.remove('hidden');
    window.MathJax?.typesetPromise([corr]);
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup')?.classList.add('hidden');

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
    if (currentQ.chapter === 'calculus' && score >= 20) achievements.titan = true;
    if (lives === 1 && score >= 15) achievements.survivor = true;
    localStorage.setItem('stemanaceMedals', JSON.stringify(achievements));
}

// --- END GAME ---
function endGame() {
    updateHomeDashboard();
    showScreen('screen-over');
}

// --- DASHBOARD ---
function updateHomeDashboard() {
    const ranks = [
        {n:"SINGULARITY",t:76},{n:"NEURAL ACE",t:51},{n:"ARCHITECT",t:31},
        {n:"OPERATOR",t:16},{n:"VARIABLE",t:6},{n:"CONSTANT",t:0}
    ];
    const rank = ranks.find(r => highScore >= r.t);
    const prof = correctHistory.global.total
        ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100)
        : 0;

    const map = {
        'high-score':highScore,
        'user-callsign':callsign,
        'current-rank':rank.n,
        'global-proficiency':prof+"%",
        'total-drills':totalDrills
    };

    Object.entries(map).forEach(([id,val]) => {
        document.getElementById(id)?.innerText = val;
    });
}

// --- INIT ---
async function init() {
    allQuestions = [{
        chapter:"calculus",
        q:"\\int x^n dx",
        correct:"\\frac{x^{n+1}}{n+1} + C",
        options:["\\frac{x^{n+1}}{n+1} + C","nx^{n-1}","x^{n+1}","x^n"]
    }];

    roasts = ["NEURAL DISCONNECT.","TRY HARDER.","CALIBRATION FAILED."];

    try {
        const t = await (await fetch('mathformula.txt')).text();
        allQuestions = t.split('\n').filter(l=>l.includes('::')).map(l=>{
            const p=l.split('::').map(s=>s.trim());
            return {chapter:p[0],q:p[1],correct:p[2],options:[p[2],p[3],p[4],p[5]]};
        });

        roasts = (await (await fetch('roast.txt')).text()).split('\n').filter(Boolean);
    } catch {}

    callsign ? (updateHomeDashboard(), showScreen('screen-home')) : showScreen('screen-login');
}

init();
