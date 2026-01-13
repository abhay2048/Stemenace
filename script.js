let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('stemanaceHS') || 0;
let totalFails = localStorage.getItem('stemanaceFails') || 0;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;
let isMuted = false;

// --- AUDIO ENGINE ---
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
const successSound = () => { playProceduralSound(1000, 'sine', 0.2, 0.05); setTimeout(() => playProceduralSound(1300, 'sine', 0.2, 0.05), 50); };
const failSound = () => playProceduralSound(150, 'sawtooth', 0.4, 0.15);
const tickSound = () => playProceduralSound(1800, 'sine', 0.05, 0.02);

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- RANKING LOGIC ---
const RANKS = [
    { name: "CONSTANT", threshold: 0, color: "#64748b" },
    { name: "VARIABLE", threshold: 6, color: "#10b981" },
    { name: "OPERATOR", threshold: 16, color: "#38bdf8" },
    { name: "ARCHITECT", threshold: 31, color: "#f59e0b" },
    { name: "NEURAL ACE", threshold: 51, color: "#ae133f" },
    { name: "SINGULARITY", threshold: 76, color: "#6a162c" }
];

function getRank(s) {
    return [...RANKS].reverse().find(r => s >= r.threshold);
}

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

        document.getElementById('high-score').innerText = highScore;
        document.getElementById('total-fails').innerText = totalFails;
        document.getElementById('current-rank').innerText = getRank(highScore).name;
        showScreen('screen-home');
    } catch (e) { console.error("STEMANACE Initialization Error."); }
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
    startGame();
}

function startGame() {
    lives = 3; score = 0;
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
        btn.onclick = () => { uiClick(); handleChoice(opt); };
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

        if (timeLeft < 2.5) {
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
    document.getElementById('total-fails').innerText = totalFails;
    updateHUD();

    const container = document.querySelector('.app-container');
    container.style.transform = "scale(0.97)";
    setTimeout(() => container.style.transform = "scale(1)", 150);

    const msg = roasts[Math.floor(Math.random() * roasts.length)] || "NEURAL_LINK_BROKEN";
    document.getElementById('roast-message').innerText = msg;
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
    document.getElementById('final-roast').innerText = "Simulation Terminated. Efficiency below threshold.";
    showScreen('screen-over');
}

function shareResult() {
    const rank = getRank(score).name;
    const text = `SYSTEM REPORT: I cleared the STEMANACE Arena with a streak of ${score}.\n\nNEURAL TIER: [${rank}]\n\nCan you beat me? Attempt here: ${window.location.href}`;
    if (navigator.share) {
        navigator.share({ title: 'STEMANACE Performance Report', text: text, url: window.location.href });
    } else {
        alert("Report Copied:\n\n" + text);
    }
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
        html += `<h3 class="vault-header">${chap.toUpperCase()} UNIT</h3>`;
        html += `<table class="v-table"><tbody>`;
        grouped[chap].forEach(q => {
            html += `<tr><td>\\(${q.q}\\)</td><td class="v-ans">\\(${q.correct}\\)</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    list.innerHTML = html;
    MathJax.typesetPromise();
}

init();
