let questions = [];
let roasts = [];
let currentQuestion = {};
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('highScore') || 0;

// Elements
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answer-input');
const livesEl = document.getElementById('lives');
const streakEl = document.getElementById('streak');
const highscoreEl = document.getElementById('high-score');
const roastOverlay = document.getElementById('roast-overlay');
const roastText = document.getElementById('roast-text');
const gameOverEl = document.getElementById('game-over');

// 1. "Smart" Math Pre-processor
function fixNotation(str) {
    let res = str.toLowerCase().replace(/\s+/g, '');

    // Convert "cos2(x)" or "cos^2(x)" to "(cos(x))^2"
    // Regex: find trig word, optional ^, then a number, then (content)
    res = res.replace(/(sin|cos|tan|sec|cosec|cot|asin|acos|atan)\^?([0-9]+)\((.*?)\)/gi, "($1($3))^$2");

    // Convert "cos^2x" (without parens) to "(cos(x))^2"
    res = res.replace(/(sin|cos|tan|sec|cosec|cot)\^([0-9]+)([xθa-z])/gi, "($1($3))^$2");

    return res;
}

// 2. Load Files
async function init() {
    highscoreEl.innerText = highScore;
    try {
        const mathRes = await fetch('mathformula.txt');
        const mathData = await mathRes.text();
        questions = mathData.split('\n').filter(l => l.includes('|')).map(l => {
            const [q, a] = l.split('|');
            return { q: q.trim(), a: a.trim() };
        });

        const roastRes = await fetch('roast.txt');
        const roastData = await roastRes.text();
        roasts = roastData.split('\n').filter(l => l.trim() !== "");

        newQuestion();
    } catch (e) {
        questionEl.innerText = "Error: Use a Local Server!";
    }
}

function newQuestion() {
    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    questionEl.innerText = currentQuestion.q;
    answerInput.value = "";
    answerInput.focus();
}

function checkAnswer() {
    const userRaw = answerInput.value.trim();
    if (!userRaw) return;

    // We compare against the first possible correct answer in the txt file
    const correctRaw = currentQuestion.a.split(',')[0].trim();

    const userParsed = fixNotation(userRaw);
    const correctParsed = fixNotation(correctRaw);

    try {
        // Compare algebraic equivalence by testing a value for x
        // Math.js is smart enough to know 1-sin(x)^2 == cos(x)^2
        const scope = { x: 0.5, theta: 0.5, a: 0.5 }; 
        const isCorrect = math.evaluate(`(${userParsed}) == (${correctParsed})`, scope);

        if (isCorrect) {
            score++;
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
                highscoreEl.innerText = highScore;
            }
            streakEl.innerText = score;
            newQuestion();
        } else {
            handleWrongAnswer();
        }
    } catch (e) {
        // If math.js can't parse it, it's probably a wrong answer
        handleWrongAnswer();
    }
}

function handleWrongAnswer() {
    lives--;
    score = 0;
    streakEl.innerText = score;
    livesEl.innerText = "❤️".repeat(Math.max(0, lives));

    if (lives <= 0) {
        gameOverEl.classList.remove('hidden');
    } else {
        roastText.innerText = roasts[Math.floor(Math.random() * roasts.length)];
        roastOverlay.classList.remove('hidden');
    }
}

function closeRoast() {
    roastOverlay.classList.add('hidden');
    newQuestion();
}

document.getElementById('submit-btn').addEventListener('click', checkAnswer);
answerInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') checkAnswer(); });

init();
