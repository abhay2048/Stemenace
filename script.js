// --- STATE & STORAGE ---
let allQuestions = [], filteredQuestions = [], roasts = [], neuralDebt = [], currentQ = null;
let score = 0, lives = 3, callsign = localStorage.getItem('stemanaceCallsign') || "";
let highScore = parseInt(localStorage.getItem('stemanaceHS')) || 0;
let formulaAnalytics = JSON.parse(localStorage.getItem('stemanaceFormulaAnalytics')) || {};
let correctHistory = JSON.parse(localStorage.getItem('stemanaceHistory')) || { global: {correct:0, total:0} };
let achievements = JSON.parse(localStorage.getItem('stemanaceMedals')) || { titan: false, survivor: false, singularity: false };
let timerId = null, timeLeft = 30, isMuted = false, currentDifficulty = 30;

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d, v = 0.1) {
    if (isMuted || audioCtx.state === 'suspended') return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}

function uiClick() { 
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playSound(600, 'sine', 0.1, 0.05); 
}

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? "🔇 AUDIO_OFF" : "🔊 AUDIO_ON";
}

// --- INITIALIZATION ---
async function init() {
    showScreen('screen-login');
    try {
        const fRes = await fetch('mathformula.txt');
        if (fRes.ok) {
            const text = await fRes.text();
            allQuestions = text.split('\n').filter(l => l.includes('::')).map(l => {
                const p = l.split('::');
                return { chapter: p[0].trim(), q: p[1].trim(), correct: p[2].trim(), options: [p[2].trim(), p[3].trim(), p[4].trim(), p[5].trim()] };
            });
        }
        const rRes = await fetch('roast.txt');
        if (rRes.ok) roasts = (await rRes.text()).split('\n').filter(l => l.trim().length > 0);
    } catch (e) { console.error("Init failure:", e); }

    if (callsign) {
        updateHomeDashboard();
        showScreen('screen-home');
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function changeCallsign() {
    const n = prompt("ENTER NEW NEURAL ID:", callsign);
    if (n) {
        callsign = n.trim().substring(0, 15);
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard();
    }
}

function updateHomeDashboard() {
    const r = highScore > 50 ? "SINGULARITY" : highScore > 25 ? "NEURAL ACE" : "CONSTANT";
    const prof = correctHistory.global.total > 0 ? Math.round((correctHistory.global.correct / correctHistory.global.total) * 100) : 0;
    
    const elements = {
        'user-callsign': callsign || "---",
        'high-score': highScore,
        'current-rank': r,
        'global-proficiency': prof + "%",
        'side-high-score': highScore,
        'side-proficiency': prof + "%",
        'side-rank': r
    };
    
    for (const [id, val] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    const pBtn = document.getElementById('priority-btn');
    if(pBtn) pBtn.style.display = Object.keys(formulaAnalytics).length > 0 ? 'block' : 'none';

    updateAchievementRack();
}

function updateAchievementRack() {
    const medals = [{ id: 'titan', icon: '💎' }, { id: 'survivor', icon: '🛡️' }, { id: 'singularity', icon: '🌌' }];
    const html = medals.map(m => `<div class="medal ${achievements[m.id] ? 'unlocked' : ''}">${m.icon}</div>`).join('');
    document.getElementById('achievement-rack').innerHTML = html;
    document.getElementById('side-achievement-rack').innerHTML = html;
}

// --- GAMEPLAY ---
function selectChapter(chap) {
    filteredQuestions = allQuestions.filter(q => q.chapter === chap);
    showScreen('screen-difficulty');
}

function selectDifficulty(time) {
    currentDifficulty = time;
    score = 0; lives = 3; neuralDebt = [];
    showScreen('screen-game');
    nextRound();
}

function nextRound() {
    if (timerId) clearInterval(timerId);
    currentQ = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    
    const display = document.getElementById('formula-display');
    display.innerHTML = `\\[ ${currentQ.q} \\]`;
    display.style.fontSize = currentQ.q.length > 40 ? '0.9rem' : '1.3rem';

    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    [...currentQ.options].sort(() => 0.5 - Math.random()).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => handleChoice(opt);
        grid.appendChild(btn);
    });

    window.MathJax.typesetPromise();
    timeLeft = currentDifficulty;
    resetTimer();
}

function resetTimer() {
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-fill').style.width = (timeLeft / currentDifficulty * 100) + "%";
        if (timeLeft <= 0) handleChoice(null);
    }, 100);
}

function handleChoice(choice) {
    clearInterval(timerId);
    if (choice === currentQ.correct) {
        score++;
        playSound(800, 'sine', 0.1, 0.05);
        updateCorrectStats(true);
        nextRound();
    } else {
        lives--;
        playSound(200, 'sawtooth', 0.3, 0.1);
        neuralDebt.push(currentQ);
        updateCorrectStats(false);
        trackFailure(currentQ.q);
        showRoast();
    }
    document.getElementById('lives').innerText = "❤️".repeat(lives);
    document.getElementById('streak').innerText = score;
}

function trackFailure(f) {
    formulaAnalytics[f] = (formulaAnalytics[f] || 0) + 1;
    localStorage.setItem('stemanaceFormulaAnalytics', JSON.stringify(formulaAnalytics));
}

function showRoast() {
    const msg = roasts[Math.floor(Math.random() * roasts.length)] || "Pathetic.";
    document.getElementById('roast-message').innerText = msg;
    document.getElementById('correction-display').innerHTML = `\\[ ${currentQ.correct} \\]`;
    document.getElementById('roast-popup').classList.remove('hidden');
    window.MathJax.typesetPromise();
}

function resumeAfterRoast() {
    document.getElementById('roast-popup').classList.add('hidden');
    if (lives <= 0) endGame(); else nextRound();
}

function endGame() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('stemanaceHS', highScore);
    }
    renderDebtList();
    showScreen('screen-over');
    updateHomeDashboard();
}

function renderDebtList() {
    const list = document.getElementById('debt-list');
    list.innerHTML = neuralDebt.map(q => `<div class="vault-card"><div class="debt-q">\\[ ${q.q} \\]</div><div class="debt-a" style="filter:none">\\[ ${q.correct} \\]</div></div>`).join('');
    window.MathJax.typesetPromise();
}

function updateCorrectStats(isCorrect) {
    correctHistory.global.total++;
    if (isCorrect) correctHistory.global.correct++;
    localStorage.setItem('stemanaceHistory', JSON.stringify(correctHistory));
}

// --- VAULT & DIAGNOSTICS ---
function showVault() {
    const cont = document.getElementById('vault-content');
    cont.innerHTML = allQuestions.map(q => `
        <div class="vault-card" onclick="this.classList.toggle('revealed')">
            <div class="vault-q">\\[ ${q.q} \\]</div>
            <div class="vault-a">\\[ ${q.correct} \\]</div>
        </div>
    `).join('');
    showScreen('screen-learn');
    window.MathJax.typesetPromise();
}

function showDiagnostics() {
    const cont = document.getElementById('diagnostic-results');
    const sorted = Object.entries(formulaAnalytics).sort((a,b) => b[1] - a[1]);
    cont.innerHTML = sorted.length ? sorted.map(([f, count]) => `
        <div class="vault-card">
            <div class="vault-q">\\[ ${f} \\]</div>
            <div class="fail-count-badge">FAILED: ${count} TIMES</div>
        </div>
    `).join('') : "<p>NO DATA RECORDED</p>";
    showScreen('screen-diagnostics');
    window.MathJax.typesetPromise();
}

function submitLogin() {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val;
        localStorage.setItem('stemanaceCallsign', callsign);
        updateHomeDashboard();
        showScreen('screen-home');
    }
}

window.onload = init;
