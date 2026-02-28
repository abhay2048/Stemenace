let allQuestions = [], filteredQuestions = [], roasts = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('stm_xp')) || 0;
let highScore = parseInt(localStorage.getItem('stm_hs')) || 0;
let timerId = null, timeLeft = 30;

// --- DATA INITIALIZATION ---
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
    } catch (e) {
        console.error("Celestial Data Stream Interrupted. Check local files.");
    }
    updateHomeDashboard();
}

function triggerMath() {
    if (window.MathJax && window.MathJax.typeset) window.MathJax.typeset();
}

// --- NAVIGATION ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'screen-home') updateHomeDashboard();
    triggerMath();
};

function updateHomeDashboard() {
    document.getElementById('high-score').innerText = highScore;
    const progress = (xp % 1000) / 1000;
    const ring = document.getElementById('xp-ring');
    if (ring) {
        // Circumference is ~301 for r=48
        ring.style.strokeDashoffset = 301 - (progress * 301);
    }
    document.getElementById('level-display').innerText = Math.floor(xp / 1000) + 1;
    
    // Calculate Accuracy (Simple Placeholder)
    document.getElementById('global-proficiency').innerText = xp > 0 ? "92%" : "0%";
}

// --- GAME LOGIC ---
window.selectChapter = (chap) => {
    filteredQuestions = allQuestions.filter(q => q.chap.toLowerCase() === chap.toLowerCase());
    if (filteredQuestions.length === 0) return;
    score = 0; lives = 3;
    showScreen('screen-game');
    nextRound();
};

function nextRound() {
    if (lives <= 0) {
        if (score > highScore) { highScore = score; localStorage.setItem('stm_hs', highScore); }
        showScreen('screen-home');
        return;
    }
    
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak').innerText = score;
    document.getElementById('lives').innerText = "❤️".repeat(lives);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => {
            if (opt === currentQ.a) { score++; xp += 25; localStorage.setItem('stm_xp', xp); nextRound(); }
            else handleWrong();
        };
        grid.appendChild(btn);
    });
    triggerMath();
    startTimer();
}

function startTimer() {
    if (timerId) clearInterval(timerId);
    timeLeft = 30;
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-fill').style.width = (timeLeft / 30) * 100 + "%";
        if (timeLeft <= 0) handleWrong();
    }, 100);
}

function handleWrong() {
    lives--; clearInterval(timerId);
    const msg = roasts[Math.floor(Math.random() * roasts.length)] || "Navigation Error";
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    triggerMath();
}

window.resumeAfterRoast = () => {
    document.getElementById('roast-popup').classList.add('hidden');
    nextRound();
};

init();
