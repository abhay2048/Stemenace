let allQuestions = [];
let filteredQuestions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('mathMasterHS') || 0;
let timerId = null;
let timeLimit = 30;
let timeLeft = 30;

async function init() {
    try {
        const mathRes = await fetch('mathformula.txt');
        const mathText = await mathRes.text();
        // CHANGED SEPARATOR TO :: TO FIX LATEX CRASH
        allQuestions = mathText.split('\n').filter(l => l.includes('::')).map(line => {
            const p = line.split('::').map(s => s.trim());
            return { chapter: p[0], q: p[1], correct: p[2], options: [p[2], p[3], p[4], p[5]] };
        });

        const roastRes = await fetch('roast.txt');
        const roastText = await roastRes.text();
        roasts = roastText.split('\n').filter(l => l.trim() !== "");

        document.getElementById('high-score').innerText = highScore;
        showScreen('screen-home');
    } catch (e) { console.error("Load error:", e); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (timerId) clearInterval(timerId);
    if (id === 'screen-learn') populateLearn();
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
    const bar = document.getElementById('timer-bar');
    timerId = setInterval(() => {
        timeLeft -= 0.1;
        bar.style.width = (timeLeft / timeLimit * 100) + "%";
        if (timeLeft <= 0) { clearInterval(timerId); handleWrong(); }
    }, 100);
}

function handleChoice(choice) {
    if (choice === currentQ.correct) {
        score++;
        if (score > highScore) { 
            highScore = score; 
            localStorage.setItem('mathMasterHS', highScore); 
            document.getElementById('high-score').innerText = highScore;
        }
        updateHUD();
        nextRound();
    } else { handleWrong(); }
}

function handleWrong() {
    clearInterval(timerId);
    lives--;
    updateHUD();
    if (lives <= 0) endGame(); else setTimeout(nextRound, 600);
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    document.getElementById('roast-msg').innerText = roasts[Math.floor(Math.random() * roasts.length)];
    showScreen('screen-over');
}

function populateLearn() {
    const list = document.getElementById('learn-list');
    let html = `<table class="learn-table"><thead><tr><th>QUESTION</th><th>ANSWER</th></tr></thead><tbody>`;
    allQuestions.forEach(q => {
        html += `<tr><td>\\(${q.q}\\)</td><td class="correct-ans">\\(${q.correct}\\)</td></tr>`;
    });
    html += `</tbody></table>`;
    list.innerHTML = html;
    MathJax.typesetPromise();
}

init();
