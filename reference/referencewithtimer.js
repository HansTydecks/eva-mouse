class EVASimulator {
    constructor() {
        this.audioContext = null;
        this.isProcessing = false;
        this.timerStarted = false;
        this.workingTime = 180; // 3 minutes in seconds
        this.modalTime = 180; // 3 minutes in seconds
        this.workingTimer = null;
        this.modalTimer = null;
        this.firstCodeScanned = false;
        
        // Barcode scanner valid codes with corresponding G major pentatonic notes
        this.validCodes = {
            '+12345': { note: 'G', frequency: 392.00 },
            '+67890': { note: 'A', frequency: 440.00 },
            '+ABCDE': { note: 'B', frequency: 493.88 },
            '+HELLO': { note: 'D', frequency: 587.33 },
            '+WORLD': { note: 'E', frequency: 659.25 }
        };
        
        this.initializeEventListeners();
        this.initializeAudioContext();
        this.setupBarcodeListener();
    }

    initializeEventListeners() {
        // Only barcode scanner functionality needed
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }



    // Barcode Scanner Station
    setupBarcodeListener() {
        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        document.addEventListener('keypress', (e) => {
            const currentTime = Date.now();
            
            // Reset buffer if too much time has passed (new scan)
            if (currentTime - lastKeyTime > 100) {
                barcodeBuffer = '';
            }
            
            lastKeyTime = currentTime;
            
            if (e.key === 'Enter') {
                // Process the scanned code
                this.processBarcodeInput(barcodeBuffer);
                barcodeBuffer = '';
            } else {
                barcodeBuffer += e.key;
            }
        });
    }

    async processBarcodeInput(code) {
        if (!this.validCodes[code]) {
            this.showScannerStatus(`Unbekannt: ${code}`, 'error');
            return;
        }

        document.getElementById('scannedCode').textContent = code;
        this.showScannerStatus('Erkannt!', 'success');

        // Start timer after first successful scan
        if (!this.firstCodeScanned) {
            this.firstCodeScanned = true;
            this.startWorkingTimer();
        }

        // Play corresponding tone
        await this.playPentatonicNote(this.validCodes[code]);
        
        this.showByteHappy();
    }

    async playPentatonicNote(noteData) {
        if (!this.audioContext) return;

        try {
            // Ensure audio context is running
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(noteData.frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';

            // Envelope
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.0);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 1.0);

        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }



    showScannerStatus(message, type = 'normal') {
        const statusElement = document.getElementById('scannerStatus');
        statusElement.textContent = message;
        statusElement.style.color = type === 'error' ? '#e74c3c' : 
                                   type === 'success' ? '#48c774' : '#4a90e2';
    }

    // Byte character states
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

    startWorkingTimer() {
        const timerDisplay = document.getElementById('timerDisplay');
        const timerValue = document.getElementById('timerValue');
        
        timerDisplay.style.display = 'block';
        this.timerStarted = true;
        
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
        const modalTimerText = document.getElementById('modalTimerText');
        
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

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EVASimulator();
});