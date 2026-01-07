let questions = [];
let roasts = [];
let currentQuestion = {};
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('highScore') || 0;

const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const livesEl = document.getElementById('lives');
const streakEl = document.getElementById('streak');
const highscoreEl = document.getElementById('high-score');
const roastOverlay = document.getElementById('roast-overlay');
const roastText = document.getElementById('roast-text');
const gameOverEl = document.getElementById('game-over');

// Initialize Game
async function init() {
    highscoreEl.innerText = highScore;
    
    try {
        // Fetch Math Formulas
        const mathRes = await fetch('mathformula.txt');
        const mathData = await mathRes.text();
        questions = mathData.split('\n').filter(line => line.includes('|')).map(line => {
            const [q, a] = line.split('|');
            return { q: q.trim(), a: a.trim() };
        });

        // Fetch Roasts
        const roastRes = await fetch('roast.txt');
        const roastData = await roastRes.text();
        roasts = roastData.split('\n').filter(line => line.trim() !== "");

        newQuestion();
    } catch (err) {
        questionEl.innerText = "Error loading files!";
        console.error(err);
    }
}

function newQuestion() {
    if (questions.length === 0) return;
    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    questionEl.innerText = currentQuestion.q;
    answerInput.value = "";
    answerInput.focus();
}

function checkAnswer() {
    const userAnswer = answerInput.value.trim();

    if (userAnswer === currentQuestion.a) {
        // Correct
        score++;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore);
            highscoreEl.innerText = highScore;
        }
        streakEl.innerText = score;
        newQuestion();
    } else {
        // Wrong
        handleWrongAnswer();
    }
}

function handleWrongAnswer() {
    lives--;
    score = 0; // Reset streak on wrong answer
    streakEl.innerText = score;
    updateLivesDisplay();

    if (lives <= 0) {
        gameOverEl.classList.remove('hidden');
    } else {
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        roastText.innerText = randomRoast || "Wow, you're really bad at this.";
        roastOverlay.classList.remove('hidden');
    }
}

function updateLivesDisplay() {
    livesEl.innerText = "❤️".repeat(lives);
}

function closeRoast() {
    roastOverlay.classList.add('hidden');
    newQuestion();
}

// Event Listeners
submitBtn.addEventListener('click', checkAnswer);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkAnswer();
});

init();