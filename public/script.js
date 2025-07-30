class SpaceQuiz {
    constructor() {
        this.currentQuestion = 0;
        this.totalQuestions = 10;
        this.timeLeft = 30;
        this.timer = null;
        this.score = 0;
        this.selectedAnswer = null;
        this.userAnswers = [];
        this.startTime = null;
        this.sessionId = null;
        this.currentQuestionData = null;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        
        // Home page events
        document.getElementById('start-btn').addEventListener('click', () => this.startQuiz());
        
        // Results page events
        document.getElementById('restart-btn').addEventListener('click', () => this.goHome());
        document.getElementById('review-btn').addEventListener('click', () => this.toggleAnswersReview());
    }

    async startQuiz() {
        try {

            // Reset quiz state 
            this.currentQuestion = 0;
            this.score = 0;
            this.userAnswers = [];
            this.startTime = new Date();
            
            // Start quiz session with server 
            const response = await fetch('/api/start-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    questionCount: this.totalQuestions
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to start quiz');
            }
            
            const data = await response.json();
            this.sessionId = data.sessionId;
            this.totalQuestions = data.totalQuestions;
            
            this.showPage('quiz-page');
            this.loadQuestion();
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Failed to start quiz. Please try again.');
        }
    }

    async loadQuestion() {
        if (this.currentQuestion >= this.totalQuestions) {
            this.showResults();
            return;
        }

        try {

            // Get current question from server
            const response = await fetch(`/api/question/${this.sessionId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load question');
            }
            
            const questionData = await response.json();
            this.currentQuestionData = questionData;
            
            this.displayQuestion(questionData);
            this.startTimer();
        } catch (error) {
            console.error('Error loading question:', error);
            alert('Failed to load question. Please try again.');
        }
    }

    displayQuestion(questionData) {

        // Update progress
        const progress = (questionData.questionNumber / questionData.totalQuestions) * 100;
        document.getElementById('progress').style.width = progress + '%';
        document.getElementById('question-counter').textContent = 
            `Question ${questionData.questionNumber} of ${questionData.totalQuestions}`;
        
        // Display question
        document.getElementById('question-text').textContent = questionData.question;
        
        // Display answers
        const answersContainer = document.getElementById('answers-container');
        answersContainer.innerHTML = '';
        
        questionData.answers.forEach((answer, index) => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.textContent = `${String.fromCharCode(65 + index)}. ${answer}`;
            button.addEventListener('click', () => this.selectAnswer(index, button));
            answersContainer.appendChild(button);
        });
        
        // Reset state
        this.selectedAnswer = null;

    }

    async selectAnswer(answerIndex, buttonElement) {

        // Prevent multiple selections
        if (this.selectedAnswer !== null) return;
        
        this.selectedAnswer = answerIndex;
        this.stopTimer();
        
        // Disable all answer buttons
        const answerButtons = document.querySelectorAll('.answer-btn');
        answerButtons.forEach(btn => btn.disabled = true);
        
        // Highlight selected answer
        buttonElement.classList.add('selected');
        
        // Process the answer with server
        await this.processAnswer(answerIndex);

    }

    async processAnswer(answerIndex) {
        try {

            // Submit answer to server
            const response = await fetch(`/api/answer/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answerIndex: answerIndex
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to submit answer');
            }
            
            const result = await response.json();
            const isCorrect = result.correct;
            const correctAnswer = result.correctAnswer;
            
            if (isCorrect) {
                this.score++;
            }
            
            // Store the answer for local display
            this.userAnswers.push({
                question: this.currentQuestionData.question,
                userAnswer: answerIndex,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                answers: this.currentQuestionData.answers
            });
            
            // Show feedback
            this.showAnswerFeedback(correctAnswer, answerIndex);
        } catch (error) {
            console.error('Error processing answer:', error);
            alert('Failed to submit answer. Please try again.');
        }
    }

    showAnswerFeedback(correctAnswer, userAnswer) {
        const answerButtons = document.querySelectorAll('.answer-btn');
        
        // Show correct answer in green
        answerButtons[correctAnswer].classList.add('correct');
        
        // Show incorrect user answer in red (if different from correct)
        if (userAnswer !== correctAnswer) {
            answerButtons[userAnswer].classList.add('incorrect');
        }
        
        // Auto-advance after showing feedback
        setTimeout(() => {
            this.currentQuestion++;
            if (this.currentQuestion < this.totalQuestions) {
                this.loadQuestion();
            } else {
                this.showResults();
            }
        }, 2000); // 2 second delay to show the correct/incorrect answers
    }

    async showResults() {
        try {
            // Get results from server
            const response = await fetch(`/api/results/${this.sessionId}`);
            
            if (!response.ok) {
                throw new Error('Failed to get results');
            }
            
            const resultsData = await response.json();
            
            // Add local answers data for review
            resultsData.detailedAnswers = this.userAnswers;
            
            this.displayResults(resultsData);
            this.showPage('results-page');
        } catch (error) {
            console.error('Error getting results:', error);
            // Fallback to local calculation if server fails
            const endTime = new Date();
            const timeTaken = Math.floor((endTime - this.startTime) / 1000);
            const percentage = Math.round((this.score / this.totalQuestions) * 100);
            
            const resultsData = {
                score: this.score,
                totalQuestions: this.totalQuestions,
                percentage: percentage,
                timeTaken: timeTaken,
                detailedAnswers: this.userAnswers
            };
            
            this.displayResults(resultsData);
            this.showPage('results-page');
        }
    }

    displayResults(resultsData) {

        // Update score display to the results after the data is collected. 
        document.getElementById('score-percentage').textContent = resultsData.percentage + '%';
        document.getElementById('correct-answers').textContent = resultsData.score;
        document.getElementById('total-questions').textContent = resultsData.totalQuestions;
        
        // Format time taken 
        const minutes = Math.floor(resultsData.timeTaken / 60);
        const seconds = resultsData.timeTaken % 60;
        document.getElementById('time-taken').textContent = 
            `${minutes}m ${seconds}s`;
        
        // Set achievement badge and message when finished with the quiz
        const percentage = resultsData.percentage;
        let badge, title, message;
        
        if (percentage >= 90) {
            badge = '🌟';
            title = 'Cosmic Wizard!';
            message = 'Outstanding! The universe sings to you! 🌌';
        } else if (percentage >= 80) {
            badge = '🏆';
            title = 'Space Warrior!';
            message = 'Excellent work! Your brain is out of this world. 🚀';
        } else if (percentage >= 70) {
            badge = '🎖️';
            title = 'Young Pupil!';
            message = 'Good job! Keep at it youngin. ⭐';
        } else if (percentage >= 60) {
            badge = '🏅';
            title = 'Curious Novice!';
            message = 'Nice try! Time to brush up on your facts! 🌙';
        } else {
            badge = '🛸';
            title = 'Nice Try Buddy!';
            message = 'No worries! There is infinite learning to be done! 🌌';
        }
        
        document.getElementById('achievement-badge').textContent = badge;
        document.getElementById('results-title').textContent = title;
        document.getElementById('performance-message').textContent = message;
        
        // Store results for review so it can be checked on 
        this.quizResults = resultsData;
    }

    toggleAnswersReview() {
        const reviewContainer = document.getElementById('answers-review');
        const reviewBtn = document.getElementById('review-btn');
        
        if (reviewContainer.style.display === 'none') {
            this.displayAnswersReview();
            reviewContainer.style.display = 'block';
            reviewBtn.textContent = '🔼 Hide Review';
        } else {
            reviewContainer.style.display = 'none';
            reviewBtn.textContent = '📋 Review Answers';
        }
    }

    displayAnswersReview() {
        const reviewContainer = document.getElementById('answers-review');
        reviewContainer.innerHTML = '<h3 style="margin-bottom: 20px; color: #00f5ff;">📋 Answer Review</h3>';
        
        const answersToReview = this.quizResults.detailedAnswers || this.quizResults.answers || [];
        
        answersToReview.forEach((answer, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${answer.isCorrect ? 'correct' : 'incorrect'}`;
            
            const userAnswerText = answer.answers ? answer.answers[answer.userAnswer] : `Option ${String.fromCharCode(65 + answer.userAnswer)}`;
            const correctAnswerText = answer.answers ? answer.answers[answer.correctAnswer] : `Option ${String.fromCharCode(65 + answer.correctAnswer)}`;
            
            reviewItem.innerHTML = `
                <div class="review-question">
                    ${index + 1}. ${answer.question}
                </div>
                <div class="review-answers">
                    <p><strong>Your answer:</strong> ${answer.isCorrect ? '✅' : '❌'} ${userAnswerText}</p>
                    ${!answer.isCorrect ? `<p><strong>Correct answer:</strong> ✅ ${correctAnswerText}</p>` : ''}
                </div>
            `;
            
            reviewContainer.appendChild(reviewItem);
        });
    }

    startTimer() {
        this.timeLeft = 30;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('time-left');
        timerElement.textContent = this.timeLeft;
        
        // Change color when time is running out in the timer
        if (this.timeLeft <= 5) {
            timerElement.style.color = '#ff006e';
        } else if (this.timeLeft <= 10) {
            timerElement.style.color = '#ffa500';
        } else {
            timerElement.style.color = '#00f5ff';
        }
    }

    timeUp() {
        this.stopTimer();
  
        if (this.selectedAnswer === null) {
            const firstAnswer = document.querySelector('.answer-btn');
            if (firstAnswer) {
                this.selectAnswer(0, firstAnswer);
            }
        }
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected page
        document.getElementById(pageId).classList.add('active');
    }

    goHome() {
        this.currentQuestion = 0;
        this.sessionId = null;
        this.stopTimer();
        this.showPage('home-page');
    }
}


// Initialize the quiz app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpaceQuiz();
});


// Add some extra visual effects
document.addEventListener('DOMContentLoaded', () => {

    // Add click effect to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {

            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);

        });

    });
    
});

// Add CSS for ripple effect and answer feedback
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    /* Base selected style (blue) - lowest priority */
    .answer-btn.selected {
        background: linear-gradient(45deg, #00f5ff, #0099ff) !important;
        border-color: #00f5ff !important;
        color: white !important;
    }
    
    /* Correct answer style (green) - higher priority */
    .answer-btn.correct {
        background: linear-gradient(45deg, #4caf50, #8bc34a) !important;
        border-color: #4caf50 !important;
        color: white !important;
    }
    
    /* Incorrect answer style (red) - highest priority */
    .answer-btn.incorrect {
        background: linear-gradient(45deg, #f44336, #ff5722) !important;
        border-color: #f44336 !important;
        color: white !important;
    }
    
    .review-item {
        margin-bottom: 20px;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid;
    }
    
    .review-item.correct {
        background: rgba(40, 167, 69, 0.1);
        border-color: #28a745;
    }
    
    .review-item.incorrect {
        background: rgba(220, 53, 69, 0.1);
        border-color: #dc3545;
    }
    
    .review-question {
        font-weight: bold;
        margin-bottom: 10px;
    }
`;
document.head.appendChild(style);
