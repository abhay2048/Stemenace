let questions = [];
let roasts = [];
let currentQ = null;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('trigHighScore') || 0;

async function init() {
    document.getElementById('high-score').innerText = highScore;

    try {
        // Load Formulas
        const mathRes = await fetch('mathformula.txt');
        const mathData = await mathRes.text();
        questions = mathData.split('\n').filter(l => l.includes('|')).map(line => {
            const [q, correct, w1, w2, w3] = line.split('|').map(s => s.trim());
            return { q, correct, options: [correct, w1, w2, w3] };
        });

        // Load Roasts
        const roastRes = await fetch('roast.txt');
        const roastData = await roastRes.text();
        roasts = roastData.split('\n').filter(l => l.trim() !== "");

        loadRound();
    } catch (e) {
        console.error(e);
        alert("Files not found! Make sure mathformula.txt and roast.txt exist.");
    }
}

function loadRound() {
    if (questions.length === 0) return;
    
    currentQ = questions[Math.floor(Math.random() * questions.length)];
    
    // Set Question (LaTeX)
    document.getElementById('formula-display').innerHTML = `\\[ ${currentQ.q} \\]`;
    
    // Shuffle Options
    const shuffled = [...currentQ.options].sort(() => Math.random() - 0.5);
    
    // Generate Buttons
    const grid = document.getElementById('options-grid');
    grid.innerHTML = "";
    shuffled.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `\\( ${opt} \\)`; // Inline LaTeX
        btn.onclick = () => checkChoice(opt);
        grid.appendChild(btn);
    });

    // Re-render MathJax
    MathJax.typesetPromise();
}

function checkChoice(choice) {
    if (choice === currentQ.correct) {
        score++;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('trigHighScore', highScore);
            document.getElementById('high-score').innerText = highScore;
        }
        document.getElementById('streak').innerText = score;
        loadRound();
    } else {
        handleFail();
    }
}

function handleFail() {
    lives--;
    score = 0;
    document.getElementById('streak').innerText = score;
    document.getElementById('lives').innerText = "❤️".repeat(Math.max(0, lives));

    if (lives <= 0) {
        document.getElementById('death-screen').classList.remove('hidden');
    } else {
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        document.getElementById('roast-text').innerText = randomRoast;
        document.getElementById('overlay').classList.remove('hidden');
    }
}

function nextRound() {
    document.getElementById('overlay').classList.add('hidden');
    loadRound();
}

init();
