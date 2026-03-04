let allQ = [], filteredQ = [], roasts = [], failLogs = {};
let sessionQueue = [], currentQ = null;
let score = 0, lives = 3, xp = parseInt(localStorage.getItem('ax_xp')) || 0;
let best = parseInt(localStorage.getItem('ax_best')) || 0;
let callsign = localStorage.getItem('ax_id') || "";
let history = JSON.parse(localStorage.getItem('ax_hist')) || { total: 0, correct: 0 };
let timerId = null, timeLimit = 30;

async function init() {
    try {
        const [fRes, rRes] = await Promise.all([
            fetch('mathformula.txt').then(r => r.text()),
            fetch('roast.txt').then(r => r.text())
        ]);
        allQ = fRes.split('\n').filter(l => l.includes('::')).map(l => {
            const p = l.split('::').map(s => s.trim());
            return { chap: p[0], q: p[1], a: p[2], opts: [p[2], p[3], p[4], p[5]] };
        });
        roasts = rRes.split('\n').filter(l => l.trim() !== "");
        
        // Populate Chapters
        const chapters = [...new Set(allQ.map(q => q.chap))];
        document.getElementById('chapter-list').innerHTML = chapters.map(c => `
            <button class="action-card" onclick="selectChapter('${c}')">
                <span class="serif-title">${c.toUpperCase()}</span>
                <small>Archive Manuscripts</small>
            </button>
        `).join('');

    } catch (e) { console.error("Initialization failed."); }
    
    if (!callsign) showScreen('screen-login');
    else { document.getElementById('main-dock').classList.remove('hidden'); showScreen('screen-home'); }
}

function safeTypeset() {
    if (window.mjReady && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(e => {});
    }
}

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'screen-home') { updateDash(); document.querySelectorAll('.dock-tab')[0].classList.add('active'); }
    if (id === 'screen-vault') { startArchiveMode(); document.querySelectorAll('.dock-tab')[1].classList.add('active'); }
    if (id === 'screen-logs') { populateLogs(); document.querySelectorAll('.dock-tab')[2].classList.add('active'); }
    safeTypeset();
};

window.submitLogin = () => {
    const val = document.getElementById('callsign-input').value.trim();
    if (val) {
        callsign = val.toUpperCase();
        localStorage.setItem('ax_id', callsign);
        document.getElementById('main-dock').classList.remove('hidden');
        showScreen('screen-home');
    }
};

function updateDash() {
    document.getElementById('display-name').innerText = callsign;
    document.getElementById('best-val').innerText = best;
    const progress = (xp % 1000) / 10;
    document.getElementById('level-val').innerText = Math.floor(xp / 1000) + 1;
    document.getElementById('xp-ring').style.strokeDashoffset = 100 - progress;
    const acc = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;
    document.getElementById('accuracy-val').innerText = acc + "%";
    document.getElementById('repair-btn').style.display = Object.keys(failLogs).length > 0 ? 'block' : 'none';
}

// PRACTICE LOGIC
window.selectChapter = (c) => {
    filteredQ = allQ.filter(q => q.chap.toLowerCase() === c.toLowerCase());
    showScreen('screen-difficulty');
};

window.setDiff = (s) => {
    timeLimit = s; score = 0; lives = 3;
    sessionQueue = [...filteredQ].sort(() => Math.random() - 0.5);
    showScreen('screen-game');
    nextRound();
};

function nextRound() {
    clearInterval(timerId);
    if (lives <= 0) { showResults("Archive Depleted", "Retention failed."); return; }
    if (sessionQueue.length === 0) { showResults("Mastery Achieved", "All identities verified."); return; }

    currentQ = sessionQueue[0];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    document.getElementById('streak-box').innerText = score;
    document.getElementById('lives-box').innerText = "❤️".repeat(lives);

    const stack = document.getElementById('options-stack');
    stack.innerHTML = "";
    [...currentQ.opts].sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.className = 'option-btn';
        b.innerHTML = `\\( ${o} \\)`;
        b.onclick = () => checkAnswer(o, b);
        stack.appendChild(b);
    });
    safeTypeset();
    startTimer();
}

function checkAnswer(choice, btn) {
    clearInterval(timerId);
    history.total++;
    if (choice === currentQ.a) {
        btn.classList.add('correct');
        score++; xp += 20; history.correct++;
        sessionQueue.shift();
        setTimeout(nextRound, 600);
    } else {
        btn.classList.add('incorrect');
        handleFail();
    }
    localStorage.setItem('ax_xp', xp);
    localStorage.setItem('ax_hist', JSON.stringify(history));
}

function startTimer() {
    let cur = timeLimit;
    const bar = document.getElementById('timer-fill');
    timerId = setInterval(() => {
        cur -= 0.1;
        bar.style.width = (cur / timeLimit) * 100 + "%";
        if (cur <= 0) handleFail();
    }, 100);
}

function handleFail() {
    clearInterval(timerId);
    lives--;
    failLogs[currentQ.q] = (failLogs[currentQ.q] || 0) + 1;
    const failedQ = sessionQueue.shift();
    sessionQueue.push(failedQ);

    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)];
    document.getElementById('correct-display').innerHTML = `\\[ ${currentQ.a} \\]`;
    document.getElementById('roast-overlay').classList.remove('hidden');
    safeTypeset();
}

// ARCHIVE MODE (MANUAL RECALL)
let archiveIndex = 0;
function startArchiveMode() {
    archiveIndex = 0;
    nextArchiveItem();
}

function nextArchiveItem() {
    document.getElementById('archive-reveal').classList.add('hidden');
    document.getElementById('manual-input').value = "";
    currentQ = allQ[archiveIndex];
    document.getElementById('archive-prompt').innerHTML = `\\[ ${currentQ.q} \\]`;
    safeTypeset();
}

function revealArchiveAnswer() {
    document.getElementById('archive-reveal').classList.remove('hidden');
    document.getElementById('archive-answer').innerHTML = `\\[ ${currentQ.a} \\]`;
    archiveIndex = (archiveIndex + 1) % allQ.length;
    safeTypeset();
}

// UTILS
window.closeRoast = () => { document.getElementById('roast-overlay').classList.add('hidden'); nextRound(); };
function showResults(title, sub) {
    if (score > best) { best = score; localStorage.setItem('ax_best', best); }
    document.getElementById('res-score').innerText = score;
    document.getElementById('res-xp').innerText = `+${score * 20}`;
    document.getElementById('results-overlay').classList.remove('hidden');
}
window.closeResults = () => { document.getElementById('results-overlay').classList.add('hidden'); showScreen('screen-home'); };

init();
