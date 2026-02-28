let allQuestions = [], filteredQuestions = [], roasts = [], analytics = {};
let currentQ = null, score = 0, lives = 3, xp = parseInt(localStorage.getItem('st_xp')) || 0;
let best = parseInt(localStorage.getItem('st_best')) || 0;
let timerId = null, timeLeft = 30;

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
    } catch (e) { console.error("Data Load Error"); }
    updateHome();
    populateVault();
}

function updateHome() {
    document.getElementById('best-score').innerText = best;
    const level = Math.floor(xp / 1000) + 1;
    const progress = (xp % 1000) / 1000;
    document.getElementById('lvl-num').innerText = level;
    document.getElementById('xp-ring').style.strokeDashoffset = 283 - (progress * 283);
    document.getElementById('accuracy-val').innerText = xp > 0 ? "94%" : "0%";
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    // Highlight Nav
    if(id === 'screen-home') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(id === 'screen-learn') document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(id === 'screen-diagnostics') {
        document.querySelectorAll('.nav-item')[2].classList.add('active');
        populateLogs();
    }
    if (window.MathJax) window.MathJax.typeset();
}

// --- VAULT & LOGS ---
function populateVault() {
    const container = document.getElementById('vault-grid');
    container.innerHTML = allQuestions.map(q => `
        <div class="flashcard" onclick="this.classList.toggle('active')">
            <div class="flash-q">\\( ${q.q} \\)</div>
            <div class="flash-a">\\( ${q.a} \\)</div>
        </div>
    `).join('');
}

function populateLogs() {
    const container = document.getElementById('logs-list');
    const sorted = Object.entries(analytics).sort((a,b) => b[1] - a[1]);
    container.innerHTML = sorted.map(([formula, count]) => `
        <div class="card-mini" style="margin-bottom:10px; display:flex; justify-content:space-between;">
            <div style="font-size:0.8rem">\\( ${formula} \\)</div>
            <div style="color:var(--accent); font-weight:bold">x${count}</div>
        </div>
    `).join('') || "<p class='label'>No errors logged yet.</p>";
    if (window.MathJax) window.MathJax.typeset();
}

// --- GAME LOGIC ---
function selectChapter(c) {
    filteredQuestions = allQuestions.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    score = 0; lives = 3;
    showScreen('screen-game');
    nextRound();
}

function nextRound() {
    if (lives <= 0) {
        if (score > best) { best = score; localStorage.setItem('st_best', best); }
        showScreen('screen-home');
        return;
    }
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('math-target').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('game-streak').innerText = score;
    document.getElementById('game-lives').innerText = "❤️".repeat(lives);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => {
            if (o === currentQ.a) { score++; xp += 20; localStorage.setItem('st_xp', xp); nextRound(); }
            else handleWrong();
        };
        grid.appendChild(b);
    });
    if (window.MathJax) window.MathJax.typeset();
    startTimer();
}

function startTimer() {
    clearInterval(timerId);
    timeLeft = 30;
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-bar').style.width = (timeLeft/30)*100 + "%";
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleWrong() {
    lives--; clearInterval(timerId);
    analytics[currentQ.q] = (analytics[currentQ.q] || 0) + 1;
    document.getElementById('roast-text').innerText = roasts[Math.floor(Math.random()*roasts.length)] || "Failed.";
    document.getElementById('math-correction').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    if (window.MathJax) window.MathJax.typeset();
}

window.closeRoast = () => {
    document.getElementById('roast-overlay').classList.add('hidden');
    nextRound();
}

init();
