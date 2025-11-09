class MemoryGame {
    constructor() {
        this.audioContext = null;
        this.currentPosition = { row: 0, col: 0 };
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 12;
        this.isProcessing = false;
        this.gameStarted = false;
        
        // Timer properties
        this.timerStarted = false;
        this.workingTime = 180; // 3 minutes in seconds
        this.modalTime = 180; // 3 minutes in seconds
        this.workingTimer = null;
        this.modalTimer = null;
        
        // Card symbols (12 pairs = 24 cards + 1 joker = 25 cards for 5x5)
        this.cardSymbols = ['🎵', '🎨', '🎮', '⚽', '🌟', '🎭', '🎪', '🎸', '🎯', '🎲', '🎰', '🎳'];
        this.jokerSymbol = '⭐'; // Special joker card (auto-matches)
        this.cards = [];
        
        this.initializeGame();
        this.initializeEventListeners();
        this.initializeAudioContext();
    }

    initializeGame() {
        // Create pairs and shuffle (12 pairs + 1 joker = 25 cards)
        const symbols = [...this.cardSymbols, ...this.cardSymbols, this.jokerSymbol];
        this.cards = this.shuffleArray(symbols);
        
        // Generate card grid
        this.createCardGrid();
        
        // Select first card
        this.updateSelectedCard();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    createCardGrid() {
        const grid = document.getElementById('memoryGrid');
        grid.innerHTML = '';
        
        this.cards.forEach((symbol, index) => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.index = index;
            card.dataset.symbol = symbol;
            
            const icon = document.createElement('div');
            icon.className = 'card-icon';
            icon.textContent = symbol;
            card.appendChild(icon);
            
            grid.appendChild(card);
        });
    }

    initializeEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
        
        // Confirm button
        document.getElementById('confirmBtn').addEventListener('click', () => {
            this.confirmSelection();
        });
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    handleKeyPress(e) {
        if (this.isProcessing) return;
        
        const key = e.key;
        
        switch(key) {
            case 'ArrowUp':
                e.preventDefault();
                this.moveSelection(-1, 0);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.moveSelection(1, 0);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.moveSelection(0, -1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.moveSelection(0, 1);
                break;
        }
    }

    moveSelection(rowDelta, colDelta) {
        const newRow = this.currentPosition.row + rowDelta;
        const newCol = this.currentPosition.col + colDelta;
        
        // Check boundaries (5 rows x 5 columns)
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
            this.currentPosition.row = newRow;
            this.currentPosition.col = newCol;
            this.updateSelectedCard();
            this.playNavigationSound();
        }
    }

    updateSelectedCard() {
        // Remove all selections
        document.querySelectorAll('.memory-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection to current card
        const currentIndex = this.currentPosition.row * 5 + this.currentPosition.col;
        const currentCard = document.querySelector(`[data-index="${currentIndex}"]`);
        
        if (currentCard && !currentCard.classList.contains('matched')) {
            currentCard.classList.add('selected');
        }
    }

    async confirmSelection() {
        if (this.isProcessing) return;
        
        // Start timer on first interaction
        if (!this.timerStarted) {
            this.startWorkingTimer();
            this.timerStarted = true;
        }
        
        const currentIndex = this.currentPosition.row * 5 + this.currentPosition.col;
        const currentCard = document.querySelector(`[data-index="${currentIndex}"]`);
        
        // Can't select already matched or flipped cards
        if (!currentCard || currentCard.classList.contains('matched') || 
            currentCard.classList.contains('flipped')) {
            return;
        }
        
        // Flip the card
        currentCard.classList.add('flipped');
        this.flippedCards.push(currentCard);
        this.playFlipSound();
        
        // Check if two cards are flipped
        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            await this.checkMatch();
        }
    }

    async checkMatch() {
        const [card1, card2] = this.flippedCards;
        const symbol1 = card1.dataset.symbol;
        const symbol2 = card2.dataset.symbol;
        
        // Check if either card is the joker (always matches)
        if (symbol1 === this.jokerSymbol || symbol2 === this.jokerSymbol || symbol1 === symbol2) {
            // Match found!
            await this.handleMatch(card1, card2);
        } else {
            // No match
            await this.handleMismatch(card1, card2);
        }
        
        this.flippedCards = [];
        this.isProcessing = false;
        this.updateSelectedCard();
    }

    async handleMatch(card1, card2) {
        await this.sleep(500);
        
        card1.classList.add('matched');
        card2.classList.add('matched');
        card1.classList.remove('flipped');
        card2.classList.remove('flipped');
        
        this.matchedPairs++;
        this.playMatchSound();
        this.showByteHappy();
        this.updateGameStatus(`Paar gefunden! (${this.matchedPairs}/${this.totalPairs})`);
        
        // Check if game won
        if (this.matchedPairs === this.totalPairs) {
            await this.handleGameWon();
        }
    }

    async handleMismatch(card1, card2) {
        card1.classList.add('wrong');
        card2.classList.add('wrong');
        
        this.playErrorSound();
        this.updateGameStatus('Kein Paar - versuche es erneut!');
        
        await this.sleep(1000);
        
        card1.classList.remove('flipped', 'wrong');
        card2.classList.remove('flipped', 'wrong');
    }

    async handleGameWon() {
        clearInterval(this.workingTimer);
        this.updateGameStatus('🎉 Gewonnen! Alle Paare gefunden!');
        this.showByteHappy();
        
        // Automatically show modal after short delay
        await this.sleep(2000);
        this.showModal();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Sound effects
    async playNavigationSound() {
        if (!this.audioContext) return;
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    async playFlipSound() {
        if (!this.audioContext) return;
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    async playMatchSound() {
        if (!this.audioContext) return;
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    async playErrorSound() {
        if (!this.audioContext) return;
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    // UI Updates
    updateGameStatus(message) {
        const statusElement = document.getElementById('gameStatus');
        statusElement.textContent = message;
    }

    showByteHappy() {
        const companion = document.getElementById('byteCompanion');
        const character = document.getElementById('byteCharacter');
        
        companion.classList.add('happy');
        character.src = 'Byte_mascot/Byte_Happy.png';
        
        setTimeout(() => {
            this.resetByteCharacter();
        }, 2000);
    }

    resetByteCharacter() {
        const companion = document.getElementById('byteCompanion');
        const character = document.getElementById('byteCharacter');
        
        companion.classList.remove('happy');
        character.src = 'Byte_mascot/Byte_normal.png';
    }

    // Timer System (from referencewithtimer.js)
    startWorkingTimer() {
        const timerDisplay = document.getElementById('timerDisplay');
        const timerValue = document.getElementById('timerValue');
        
        timerDisplay.style.display = 'block';
        
        this.workingTimer = setInterval(() => {
            this.workingTime--;
            const minutes = Math.floor(this.workingTime / 60);
            const seconds = this.workingTime % 60;
            timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.workingTime <= 0) {
                clearInterval(this.workingTimer);
                this.showModal();
            }
        }, 1000);
    }

    showModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.style.display = 'flex';
        this.startModalTimer();
    }

    startModalTimer() {
        const modalTimerValue = document.getElementById('modalTimerValue');
        
        this.modalTimer = setInterval(() => {
            this.modalTime--;
            const minutes = Math.floor(this.modalTime / 60);
            const seconds = this.modalTime % 60;
            modalTimerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.modalTime <= 0) {
                clearInterval(this.modalTimer);
                this.showStationChangeMessage();
            }
        }, 1000);
    }

    showStationChangeMessage() {
        const modalTitle = document.getElementById('modalTitle');
        const modalTimerValue = document.getElementById('modalTimerValue');
        const modalTimerText = document.getElementById('modalTimerText');
        
        modalTitle.textContent = 'Wechsle die Station!';
        modalTimerValue.textContent = 'F5';
        modalTimerText.textContent = 'drücken um diese Station zu starten';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MemoryGame();
});
