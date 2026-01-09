let questions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let timer = null;
let timeLimit = 30;
let timeLeft = 30;

// Load Everything
async function loadData() {
    const mathRes = await fetch('mathformula.txt');
    const mathText = await mathRes.text();
    questions = mathText.split('\n').filter(l => l.includes('|')).map(line => {
        const p = line.split('|').map(s => s.trim());
        return { q: p[0], correct: p[1], options: [p[1], p[2], p[3], p[4]] };
    });

    const roastRes = await fetch('roast.txt');
    const roastText = await roastRes.text();
    roasts = roastText.split('\n').filter(l => l.trim() !== "");

    populateLearnList();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if (timer) clearInterval(timer);
}

function populateLearnList() {
    const list = document.getElementById('learn-list');
    list.innerHTML = questions.map(q => 
        `<div class="learn-item">
            <b>${q.q}</b> <br> Answer: \\( ${q.correct} \\)
        </div>`).join('');
    MathJax.typesetPromise();
}

function startGame(difficulty) {
    lives = 3;
    score = 0;
    timeLimit = difficulty;
    document.getElementById('lives').innerText = "❤️❤️❤️";
    document.getElementById('streak').innerText = "0";
    showScreen('screen-game');
    nextRound();
}

function nextRound() {
    if (timer) clearInterval(timer);
    currentQ = questions[Math.floor(Math.random() * questions.length)];
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    
    // Shuffle Options
    [...currentQ.options].sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `\\( ${opt} \\)`;
        btn.onclick = () => checkAnswer(opt);
        grid.appendChild(btn);
    });

    MathJax.typesetPromise();
    startTimer();
}

function startTimer() {
    timeLeft = timeLimit;
    const bar = document.getElementById('timer-bar');
    
    timer = setInterval(() => {
        timeLeft -= 0.1;
        const percent = (timeLeft / timeLimit) * 100;
        bar.style.width = percent + "%";

        if (timeLeft <= 0) {
            clearInterval(timer);
            handleWrong("Time Expired!");
        }
    }, 100);
}

function checkAnswer(choice) {
    if (choice === currentQ.correct) {
        score++;
        document.getElementById('streak').innerText = score;
        nextRound();
    } else {
        handleWrong();
    }
}

function handleWrong(msg) {
    if (timer) clearInterval(timer);
    lives--;
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));

    if (lives <= 0) {
        endGame();
    } else {
        nextRound();
    }
}

function endGame() {
    document.getElementById('final-streak').innerText = score;
    document.getElementById('roast-display').innerText = roasts[Math.floor(Math.random() * roasts.length)];
    showScreen('screen-over');
}

loadData();
