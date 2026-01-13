let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let neuralDebt = []; // Revision tracking
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('stemanaceHS') || 0;
let totalFails = localStorage.getItem('stemanaceFails') || 0;
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { calculus: 0, trigonometry: 0, total: 0 };
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- REFINED AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playProceduralSound(f, t, d, v = 0.1) {
    if (isMuted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}
const uiClick = () => playProceduralSound(600, 'sine', 0.1);
const successSound = () => playProceduralSound(1200, 'sine', 0.2, 0.05);
// NEW FAIL SOUND: Low deep thump
const failSound = () => {
    playProceduralSound(150, 'triangle', 0.5, 0.2);
    playProceduralSound(60, 'sine', 0.5, 0.3);
};
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- RANKING & ANALYTICS ---
const RANKS = [
    { name: "CONSTANT", threshold: 0, color: "#64748b" },
    { name: "VARIABLE", threshold: 6, color: "#10b981" },
    { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
    { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
    { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
    { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
];

function getRank(s) { return [...RANKS].reverse().find(r => s >= r.threshold); }

// --- CORE LOGIC ---
async function init() {
    try {
        const res = await fetch('mathformula.txt');
        const text = await res.text();
        allQuestions = text.split('\n').filter(l => l.includes('::')).map(line => {
            const p = line.split('::').map(s => s.trim());
            return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

        updateHomeDashboard();
        showScreen('screen-home');
    } catch (e) { console.error("Initialization Failed."); }
}

function updateHomeDashboard() {
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('total-fails').innerText = totalFails;
    document.getElementById('current-rank').innerText = getRank(highScore).name;
    
    // Proficiency calc
    const totalPossible = parseInt(totalFails) + parseInt(correctHistory.total);
    const prof = totalPossible > 0 ? Math.round((correctHistory.total / totalPossible) * 100) : 0;
    document.getElementById('global-proficiency').innerText = prof + "%";
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('red-alert').classList.add('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-learn') populateVault();
}

function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter.toLowerCase() === chap);
    showScreen('screen-difficulty');
}

function selectDifficulty(sec) {
    timeLimit = sec;
    lives = 3; score = 0; neuralDebt = [];
    updateHUD();
    showScreen('screen-game');
    nextRound();
}

function updateHUD() {
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));
    document.getElementById('streak').innerText = score;
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    document.getElementById('red-alert').classList.add('hidden');
    document.querySelector('#screen-game').classList.remove('panic');
    document.getElementById('timer-fill').style.background = "";

    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    MathJax.typesetPromise();
    resetTimer();
}

function resetTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        const ratio = (timeLeft / timeLimit) * 100;
        bar.style.width = ratio + "%";
        document.getElementById('efficiency').innerText = Math.round(ratio) + "%";

        if (timeLeft < 3) {
            if (Math.floor(timeLeft * 10) % 2 === 0) tickSound();
            document.getElementById('red-alert').classList.remove('hidden');
            document.querySelector('#screen-game').classList.add('panic');
            bar.style.background = "var(--text)";
        }
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        successSound();
        score++;
        correctHistory.total++;
        correctHistory[currentQ.chapter]++;
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
    totalFails++;
    localStorage.setItem('stemanaceFails', totalFails);
    
    // Add to Neural Debt for revision
    neuralDebt.push({ q: currentQ.q, a: currentQ.correct });

    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random() * roasts.length)] || "CALIBRATION_ERROR";
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('stemanaceHS', highScore);
        }
        endGame();
    } else nextRound();
}

function endGame() {
    const rankObj = getRank(score);
    document.getElementById('final-streak').innerText = score;
    document.getElementById('final-rank').innerText = rankObj.name;
    document.getElementById('final-rank').style.backgroundColor = rankObj.color;
    document.getElementById('final-roast').innerText = "Simulation Terminated. Analyze your Neural Debt below.";
    
    // Populate Debt List for revision
    const debtEl = document.getElementById('debt-list');
    debtEl.innerHTML = neuralDebt.length > 0 ? 
        neuralDebt.map(d => `<div class="debt-item"><span>\\(${d.q}\\)</span><span style="color:var(--accent)">\\(${d.a}\\)</span></div>`).join('') :
        "<p style='font-size:0.8rem; opacity:0.6'>No debt incurred. Perfect accuracy.</p>";
    
    MathJax.typesetPromise();
    showScreen('screen-over');
    updateHomeDashboard();
}

function shareResult() {
    const rank = getRank(score).name;
    const text = `SYSTEM REPORT: I cleared the STEMANACE Arena with a streak of ${score}.\n\nNEURAL TIER: [${rank}]\n\nCan you beat me? Attempt here: ${window.location.href}`;
    navigator.share ? navigator.share({ title: 'STEMANACE Report', text: text, url: window.location.href }) : alert("Report Copied!");
}

function populateVault() {
    const list = document.getElementById('vault-content');
    const grouped = allQuestions.reduce((acc, q) => {
        if (!acc[q.chapter]) acc[q.chapter] = [];
        acc[q.chapter].push(q);
        return acc;
    }, {});

    let html = "";
    for (const chap in grouped) {
        html += `<h3 class="vault-header">${chap.toUpperCase()} UNIT</h3><table class="v-table"><tbody>`;
        grouped[chap].forEach(q => {
            html += `<tr><td>\\(${q.q}\\)</td><td class="v-ans">\\(${q.correct}\\)</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    list.innerHTML = html;
    MathJax.typesetPromise();
}

init();
