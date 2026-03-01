let allQuestions = [], filteredQuestions = [], roasts = [], failLogs = {};
let currentQ = null, score = 0, lives = 3;
let xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let timerId = null, timeLeft = 30;

// --- INIT DATA ---
async function init() {
    try {
        const [fRes, rRes] = await Promise.all([
            fetch('mathformula.txt').then(r => r.text()),
            fetch('roast.txt').then(r => r.text())
        ]);
        allQuestions = fRes.split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::').map(s => s.trim());
            return { chap: p[0], q: p[1], a: p[2], opts: [p[2], p[3], p[4], p[5]] };
        });
        roasts = rRes.split('\n').filter(l => l.trim() !== "");
    } catch (e) { console.error("Could not sync with local files."); }
    updateDashboard();
    populateLibrary();
}

function typeset() { if (window.MathJax) window.MathJax.typeset(); }

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    // Bottom Nav Sync
    if(id === 'screen-home') document.querySelectorAll('.nav-btn')[0].classList.add('active');
    if(id === 'screen-library') document.querySelectorAll('.nav-btn')[1].classList.add('active');
    if(id === 'screen-gaps') { document.querySelectorAll('.nav-btn')[2].classList.add('active'); populateGaps(); }
    typeset();
}

function updateDashboard() {
    document.getElementById('best-streak').innerText = best;
    const progress = (xp % 1000) / 1000;
    document.getElementById('lvl-display').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDashoffset = 283 - (progress * 283);
    document.getElementById('accuracy-pct').innerText = xp > 0 ? "92%" : "0%";
}

// --- LIBRARY & GAPS ---
function populateLibrary() {
    const container = document.getElementById('vault-list');
    container.innerHTML = allQuestions.map(q => `
        <div class="flashcard" onclick="this.classList.toggle('active')">
            <div class="flash-q">\\( ${q.q} \\)</div>
            <div class="flash-a">\\( ${q.a} \\)</div>
        </div>
    `).join('');
    typeset();
}

function populateGaps() {
    const container = document.getElementById('analytics-list');
    const sorted = Object.entries(failLogs).sort((a,b) => b[1] - a[1]);
    container.innerHTML = sorted.map(([math, count]) => `
        <div class="stat-tile" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem">\\( ${math} \\)</div>
            <span style="color:var(--accent); font-weight:700">x${count}</span>
        </div>
    `).join('') || "<p class='label'>No data logged.</p>";
    typeset();
}

// --- CORE GAME ---
function startSession(chap) {
    filteredQuestions = allQuestions.filter(q => q.chap.toLowerCase() === chap.toLowerCase());
    score = 0; lives = 3;
    showScreen('screen-game');
    nextQuestion();
}

function nextQuestion() {
    if (lives <= 0) {
        if (score > best) { best = score; localStorage.setItem('ax_best', best); }
        showScreen('screen-home');
        return;
    }
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('math-target').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('game-score').innerText = score;
    document.getElementById('game-lives').innerText = "❤️".repeat(lives);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            if (o === currentQ.a) { score++; xp += 20; localStorage.setItem('ax_xp', xp); nextQuestion(); }
            else handleFail();
        };
        grid.appendChild(b);
    });
    typeset();
    startTimer();
}

function startTimer() {
    clearInterval(timerId); timeLeft = 30;
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-bar').style.width = (timeLeft/30)*100 + "%";
        if (timeLeft <= 0) handleFail();
    }, 100);
}

function handleFail() {
    lives--; clearInterval(timerId);
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    document.getElementById('roast-message').innerText = roasts[Math.floor(Math.random()*roasts.length)] || "Failed.";
    document.getElementById('math-correction').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    typeset();
}

window.closeRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextQuestion();
};

init();
