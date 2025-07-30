const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active quiz sessions
const quizSessions = new Map();

// Sample questions (replace with your JSON file)
const questions = [
  {
    "question": "What is the largest planet in our solar system?",
    "answers": ["Earth", "Jupiter", "Saturn", "Neptune"],
    "correct": 1
  },
  {
    "question": "Which planet is known as the Red Planet?",
    "answers": ["Venus", "Mars", "Jupiter", "Mercury"],
    "correct": 1
  },
  {
    "question": "What is the closest star to Earth?",
    "answers": ["Alpha Centauri", "Sirius", "The Sun", "Betelgeuse"],
    "correct": 2
  },
  {
    "question": "How many moons does Earth have?",
    "answers": ["0", "1", "2", "3"],
    "correct": 1
  },
  {
    "question": "What is the name of NASA's most famous space telescope?",
    "answers": ["Kepler", "Spitzer", "Hubble", "Chandra"],
    "correct": 2
  },
  {
    "question": "Which planet has the most moons?",
    "answers": ["Jupiter", "Saturn", "Uranus", "Neptune"],
    "correct": 1
  },
  {
    "question": "What is the hottest planet in our solar system?",
    "answers": ["Mercury", "Venus", "Mars", "Jupiter"],
    "correct": 1
  },
  {
    "question": "What does NASA stand for?",
    "answers": ["National Air and Space Administration", "National Aeronautics and Space Administration", "North American Space Agency", "National Astronomy and Space Association"],
    "correct": 1
  },
  {
    "question": "Which galaxy contains our solar system?",
    "answers": ["Andromeda", "Milky Way", "Whirlpool", "Sombrero"],
    "correct": 1
  },
  {
    "question": "What is the smallest planet in our solar system?",
    "answers": ["Mercury", "Venus", "Mars", "Pluto"],
    "correct": 0
  },
  {
    "question": "How long does it take for light from the Sun to reach Earth?",
    "answers": ["8 seconds", "8 minutes", "8 hours", "8 days"],
    "correct": 1
  },
  {
    "question": "What is the Great Red Spot on Jupiter?",
    "answers": ["A moon", "A storm", "A crater", "A mountain"],
    "correct": 1
  },
  {
    "question": "Which planet is tilted on its side?",
    "answers": ["Mars", "Saturn", "Uranus", "Neptune"],
    "correct": 2
  },
  {
    "question": "What is the name of the first artificial satellite?",
    "answers": ["Explorer 1", "Sputnik 1", "Vanguard 1", "Luna 1"],
    "correct": 1
  },
  {
    "question": "How many astronauts have walked on the Moon?",
    "answers": ["6", "8", "10", "12"],
    "correct": 3
  }
];

// Load questions from JSON file if it exists
function loadQuestions() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('Using default questions (questions.json not found)');
    return questions;
  }
}

const allQuestions = loadQuestions();

// Generate unique session ID
function generateSessionId() {
  return Math.random().toString(36).substr(2, 9);
}

// Shuffle array function
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// API Routes

// Start a new quiz
app.post('/api/start-quiz', (req, res) => {
  const { questionCount = 10 } = req.body;
  const sessionId = generateSessionId();
  
  // Select random questions
  const shuffledQuestions = shuffleArray(allQuestions);
  const selectedQuestions = shuffledQuestions.slice(0, Math.min(questionCount, allQuestions.length));
  
  // Store session data
  quizSessions.set(sessionId, {
    questions: selectedQuestions,
    currentQuestion: 0,
    score: 0,
    answers: [],
    startTime: Date.now()
  });
  
  res.json({
    sessionId,
    totalQuestions: selectedQuestions.length,
    message: 'Quiz started successfully'
  });
});

// Get current question
app.get('/api/question/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = quizSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.currentQuestion >= session.questions.length) {
    return res.status(400).json({ error: 'Quiz completed' });
  }
  
  const currentQ = session.questions[session.currentQuestion];
  
  res.json({
    questionNumber: session.currentQuestion + 1,
    totalQuestions: session.questions.length,
    question: currentQ.question,
    answers: currentQ.answers
  });
});

// Submit answer
app.post('/api/answer/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { answerIndex } = req.body;
  const session = quizSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.currentQuestion >= session.questions.length) {
    return res.status(400).json({ error: 'Quiz already completed' });
  }
  
  const currentQ = session.questions[session.currentQuestion];
  const isCorrect = answerIndex === currentQ.correct;
  
  if (isCorrect) {
    session.score++;
  }
  
  session.answers.push({
    question: currentQ.question,
    userAnswer: answerIndex,
    correctAnswer: currentQ.correct,
    isCorrect
  });
  
  session.currentQuestion++;
  
  res.json({
    correct: isCorrect,
    correctAnswer: currentQ.correct,
    explanation: currentQ.explanation || null
  });
});

// Get quiz results
app.get('/api/results/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = quizSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const endTime = Date.now();
  const timeTaken = Math.round((endTime - session.startTime) / 1000);
  
  res.json({
    score: session.score,
    totalQuestions: session.questions.length,
    percentage: Math.round((session.score / session.questions.length) * 100),
    timeTaken,
    answers: session.answers
  });
});

// Clean up old sessions (run every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, session] of quizSessions.entries()) {
    if (session.startTime < oneHourAgo) {
      quizSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT);
