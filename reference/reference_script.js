class EVAMicrophoneStation {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isRecording = false;
        this.canvas = document.getElementById('visualizer');
        this.canvasContext = this.canvas.getContext('2d');
        
        // Target tones sequence
        this.targetTones = [
            { note: 'C', frequency: 261.63, color: '#ff6b6b' },
            { note: 'F#', frequency: 369.99, color: '#4ecdc4' }, 
            { note: 'A', frequency: 440.00, color: '#45b7d1' }
        ];
        this.currentToneIndex = 0;
        this.tolerance = 40; // Hz tolerance - generous for kids who can't sing precisely
        
        // Mission state
        this.isHittingTarget = false;
        this.hitStartTime = 0;
        this.hitDuration = 0;
        this.requiredHitDuration = 1500; // 1.5 seconds - easier for kids
        this.missionCompleted = false;
        this.completedTones = 0;
        this.endlessMode = false;
        
        // Frequency detection parameters
        this.frequencyBins = null;
        this.sampleRate = null;
        
        this.initializeEventListeners();
        this.initializeCanvas();
        this.updateTargetLine();
    }

    initializeEventListeners() {
        // Start/Stop recording button
        document.getElementById('startStopBtn').addEventListener('click', () => {
            this.toggleRecording();
        });
    }

    initializeCanvas() {
        // Set canvas size properly
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvasContext.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Initial empty visualization
        this.drawVisualization([]);
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });

            // Initialize Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Configure analyser
            this.analyser.fftSize = 4096;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect audio nodes
            this.microphone.connect(this.analyser);

            // Prepare data arrays
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.frequencyBins = new Float32Array(bufferLength);
            this.sampleRate = this.audioContext.sampleRate;

            // Update UI
            this.isRecording = true;
            this.updateRecordingUI();
            this.updateMicrophoneStatus('Aufnahme läuft...');
            
            // Start visualization and analysis loop
            this.visualizationLoop();

        } catch (error) {
            console.error('Microphone access error:', error);
            this.handleMicrophoneError(error);
        }
    }

    stopRecording() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isRecording = false;
        this.updateRecordingUI();
        this.updateMicrophoneStatus('Bereit');
        
        // Reset mission state when manually stopping
        if (!this.missionCompleted && !this.endlessMode) {
            this.resetMissionState();
        }
    }

    resetMissionState() {
        this.isHittingTarget = false;
        this.hitDuration = 0;
        this.hitStartTime = 0;
        this.updateTargetIndicator(false);
        this.updateHitProgress(0);
    }

    visualizationLoop() {
        if (!this.isRecording) return;

        try {
            // Get frequency and time domain data
            this.analyser.getByteFrequencyData(this.dataArray);
            this.analyser.getFloatFrequencyData(this.frequencyBins);

            // Analyze frequency for tone detection
            this.detectTone();
            
            // Processing happens behind the scenes

            // Draw visualization
            this.drawVisualization(this.dataArray);

            // Continue loop
            requestAnimationFrame(() => this.visualizationLoop());
        } catch (error) {
            console.error('Visualization loop error:', error);
            // Try to restart the loop after a short delay
            setTimeout(() => {
                if (this.isRecording) {
                    this.visualizationLoop();
                }
            }, 100);
        }
    }

    detectTone() {
        // Find the dominant frequency
        const dominantFrequency = this.findDominantFrequency();
        
        if (dominantFrequency > 0) {
            // In endless mode, skip target detection
            if (!this.endlessMode) {
                const isHitting = this.checkTargetHit(dominantFrequency);
                this.handleTargetHit(isHitting);
            }
            this.updateFrequencyDisplay(dominantFrequency);
        }
    }

    findDominantFrequency() {
        let maxIndex = 0;
        let maxValue = -Infinity;
        
        // Skip very low frequencies (below 100 Hz) to avoid noise
        const startIndex = Math.floor(100 * this.frequencyBins.length / (this.sampleRate / 2));
        const endIndex = Math.floor(1000 * this.frequencyBins.length / (this.sampleRate / 2));
        
        for (let i = startIndex; i < Math.min(endIndex, this.frequencyBins.length); i++) {
            if (this.frequencyBins[i] > maxValue) {
                maxValue = this.frequencyBins[i];
                maxIndex = i;
            }
        }
        
        // Convert bin index to frequency
        if (maxValue > -60) { // Only consider signals above -60 dB
            return (maxIndex * this.sampleRate) / (2 * this.frequencyBins.length);
        }
        
        return 0;
    }

    checkTargetHit(frequency) {
        if (this.endlessMode) return true; // In endless mode, all tones are accepted
        
        const currentTarget = this.targetTones[this.currentToneIndex];
        return Math.abs(frequency - currentTarget.frequency) <= this.tolerance;
    }

    getCurrentTarget() {
        return this.targetTones[this.currentToneIndex];
    }

    handleTargetHit(isHitting) {
        // Skip all target logic in endless mode
        if (this.endlessMode) {
            return;
        }
        
        const now = Date.now();
        
        if (isHitting && !this.missionCompleted) {
            if (!this.isHittingTarget) {
                // Start hitting target
                this.isHittingTarget = true;
                this.hitStartTime = now;
                this.updateTargetIndicator(true);
            }
            
            // Update hit duration
            this.hitDuration = now - this.hitStartTime;
            this.updateHitProgress(this.hitDuration / this.requiredHitDuration);
            
            // Check if mission completed
            if (this.hitDuration >= this.requiredHitDuration) {
                this.completeMission();
            }
        } else {
            if (this.isHittingTarget) {
                // Stop hitting target
                this.isHittingTarget = false;
                this.hitDuration = 0;
                this.updateTargetIndicator(false);
                this.updateHitProgress(0);
            }
        }
    }

    drawVisualization(dataArray) {
        const canvas = this.canvas;
        const ctx = this.canvasContext;
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(0, 0, width, height);
        
        if (dataArray.length === 0) return;
        
        // Get current pitch
        const currentPitch = this.findDominantFrequency();
        
        // Draw pitch trail (move existing points left)
        if (!this.pitchTrail) {
            this.pitchTrail = [];
        }
        
        // Add current pitch to trail
        if (currentPitch > 0) {
            this.pitchTrail.push({
                frequency: currentPitch,
                time: Date.now(),
                isTarget: this.endlessMode ? false : this.isHittingTarget  // No targets in endless mode
            });
        }
        
        // Remove old points (keep last 3 seconds)
        const now = Date.now();
        this.pitchTrail = this.pitchTrail.filter(point => now - point.time < 3000);
        
        // Draw frequency range - expand for endless mode
        const minFreq = this.endlessMode ? 50 : 100;
        const maxFreq = this.endlessMode ? 600 : 500;
        
        // Draw pitch trail
        if (this.pitchTrail.length > 1) {
            ctx.lineWidth = 3;
            
            for (let i = 0; i < this.pitchTrail.length - 1; i++) {
                const point = this.pitchTrail[i];
                const nextPoint = this.pitchTrail[i + 1];
                
                // X position based on time (trail moves left)
                const timeSpan = 3000; // 3 seconds
                const x1 = width - ((now - point.time) / timeSpan) * width;
                const x2 = width - ((now - nextPoint.time) / timeSpan) * width;
                
                // Y position based on frequency
                const y1 = height - ((point.frequency - minFreq) / (maxFreq - minFreq)) * height;
                const y2 = height - ((nextPoint.frequency - minFreq) / (maxFreq - minFreq)) * height;
                
                // Color based on mode and target hit
                let color;
                if (this.endlessMode) {
                    // Rainbow colors based on frequency in endless mode
                    const hue = ((point.frequency - minFreq) / (maxFreq - minFreq)) * 240; // 0-240 hue range
                    color = `hsl(${hue}, 70%, 60%)`;
                } else {
                    color = point.isTarget ? '#48c774' : '#4a90e2';
                }
                
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                
                // Draw point
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x1, y1, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        // Draw current pitch as larger dot
        if (currentPitch > 0) {
            const x = width - 20; // Right edge
            const y = height - ((currentPitch - minFreq) / (maxFreq - minFreq)) * height;
            
            let color;
            if (this.endlessMode) {
                // Rainbow color based on frequency
                const hue = ((currentPitch - minFreq) / (maxFreq - minFreq)) * 240;
                color = `hsl(${hue}, 80%, 60%)`;
            } else {
                color = this.isHittingTarget ? '#48c774' : '#ff6b6b';
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            // Glow effect 
            if (this.endlessMode) {
                // Always glow in endless mode with rainbow colors
                ctx.shadowColor = color;
                ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.arc(x, y, 16, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (this.isHittingTarget) {
                // Glow only when hitting target in mission mode
                ctx.shadowColor = color;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        
        // Draw frequency grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        // Dynamic grid based on frequency range
        let startFreq, endFreq, step;
        if (this.endlessMode) {
            startFreq = 100;  // Start from 100Hz for cleaner grid
            endFreq = 600;
            step = 100;       // 100Hz steps for wider range
        } else {
            startFreq = 150;
            endFreq = 450;
            step = 50;        // 50Hz steps for mission mode
        }
        
        for (let freq = startFreq; freq <= endFreq; freq += step) {
            const y = height - ((freq - minFreq) / (maxFreq - minFreq)) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            ctx.fillText(`${freq}Hz`, 15, y - 8);
        }
    }

    completeMission() {
        if (this.missionCompleted) return;
        
        this.missionCompleted = true;
        this.completedTones++;
        this.showSuccessAnimation();
        this.updateMissionDisplay();
        
        // Check if all tones completed
        if (this.completedTones >= this.targetTones.length) {
            // Enter endless mode
            setTimeout(() => {
                this.enterEndlessMode();
            }, 3000);
        } else {
            // Move to next tone
            setTimeout(() => {
                this.nextMission();
            }, 3000);
        }
    }

    nextMission() {
        // Move to next tone
        this.currentToneIndex++;
        this.resetMission();
        this.updateTargetLine();
    }

    enterEndlessMode() {
        this.endlessMode = true;
        this.missionCompleted = false;
        this.isHittingTarget = false;
        this.hitDuration = 0;
        this.hitStartTime = 0;
        
        // Clear pitch trail for fresh start
        this.pitchTrail = [];
        
        // Hide success message
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.classList.remove('show');
        }
        
        // Hide target line completely
        this.updateTargetLine();
        
        // Hide Byte in endless mode (no more missions)
        const byteCompanion = document.getElementById('byteCompanion');
        if (byteCompanion) {
            byteCompanion.style.display = 'none';
        }
        
        // Update UI for endless mode
        this.updateMissionDisplay();
        this.updateMicrophoneStatus('🎵 Freies Singen - Endless Mode aktiv!');
        
        // Continue visualization
        if (this.isRecording) {
            requestAnimationFrame(() => this.visualizationLoop());
        }
        
        console.log('Entered endless mode - pure visualization only');
    }

    resetMission() {
        // Reset mission state
        this.missionCompleted = false;
        this.isHittingTarget = false;
        this.hitDuration = 0;
        this.hitStartTime = 0;
        
        // Clear pitch trail
        this.pitchTrail = [];
        
        // Hide success message
        const successMessage = document.getElementById('successMessage');
        successMessage.classList.remove('show');
        
        // Reset visual indicators
        this.updateTargetIndicator(false);
        this.updateHitProgress(0);
        
        // Show and reset Byte to normal state (in case it was hidden in endless mode)
        const byteCompanion = document.getElementById('byteCompanion');
        if (byteCompanion) {
            byteCompanion.style.display = 'block';
        }
        this.setByteState('normal');
        
        // Update status and mission info
        this.updateMicrophoneStatus('Bereit für nächste Mission');
        this.updateMissionDisplay();
        
        // Continue recording if still active
        if (this.isRecording) {
            // Restart the visualization loop
            requestAnimationFrame(() => this.visualizationLoop());
        }
        
        console.log('Mission reset - ready for next attempt');
    }

    setByteState(state) {
        const byteCompanion = document.getElementById('byteCompanion');
        const byteCharacter = document.getElementById('byteCharacter');
        
        if (byteCompanion && byteCharacter) {
            // Remove all state classes
            byteCompanion.classList.remove('happy', 'normal');
            
            if (state === 'happy') {
                byteCompanion.classList.add('happy');
                byteCharacter.src = 'Byte_mascot/Byte_Happy.png'; // Happy Byte
                byteCharacter.alt = 'Byte Happy';
            } else {
                byteCompanion.classList.add('normal');
                byteCharacter.src = 'Byte_mascot/Byte_normal.png'; // Normal Byte
                byteCharacter.alt = 'Byte Normal';
            }
        }
    }

    updateTargetLine() {
        const targetLine = document.getElementById('targetLine');
        if (targetLine) {
            if (this.endlessMode) {
                targetLine.style.display = 'none'; // Hide target line in endless mode
            } else {
                const currentTarget = this.getCurrentTarget();
                targetLine.style.display = 'block';
                
                // Calculate position based on frequency (100-500Hz range)
                const minFreq = 100;
                const maxFreq = 500;
                const percentage = ((currentTarget.frequency - minFreq) / (maxFreq - minFreq)) * 100;
                const topPosition = 100 - percentage; // Invert because higher frequency = higher position
                
                targetLine.style.top = `${topPosition}%`;
                targetLine.style.setProperty('--target-note', `"${currentTarget.note}"`);
                targetLine.style.setProperty('--target-color', currentTarget.color);
                targetLine.style.boxShadow = `0 0 15px ${currentTarget.color}`;
            }
        }
    }

    updateMissionDisplay() {
        const titleElement = document.getElementById('missionTitle');
        const descElement = document.getElementById('missionDescription');
        
        if (titleElement && descElement) {
            if (this.endlessMode) {
                titleElement.textContent = '� Freies Singen!';
                descElement.textContent = 'Keine Ziele mehr - einfach singen und die bunten Wellen genießen!';
            } else if (this.missionCompleted) {
                titleElement.textContent = '✅ Mission erfüllt!';
                if (this.completedTones >= this.targetTones.length) {
                    descElement.textContent = 'Alle Töne geschafft! Endless Mode startet...';
                } else {
                    const nextTone = this.targetTones[this.currentToneIndex + 1];
                    descElement.textContent = `Nächster Ton: ${nextTone.note} in 3 Sekunden...`;
                }
            } else {
                const currentTarget = this.getCurrentTarget();
                titleElement.textContent = `Mission: Singe ein ${currentTarget.note}!`;
                descElement.textContent = `Triff die ${currentTarget.note}-Linie und halte den Ton für 1,5 Sekunden (${this.completedTones + 1}/3)`;
            }
        }
    }

    updateRecordingUI() {
        const btn = document.getElementById('startStopBtn');
        const micIcon = document.querySelector('.microphone-icon');
        
        if (this.isRecording) {
            btn.textContent = 'Stop Aufnahme';
            btn.classList.add('recording');
            document.body.classList.add('recording-active');
        } else {
            btn.textContent = 'Start Aufnahme';
            btn.classList.remove('recording');
            document.body.classList.remove('recording-active');
        }
    }

    updateMicrophoneStatus(status) {
        const statusElement = document.getElementById('micStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // Removed processing animation - happens behind the scenes

    updateTargetIndicator(isHitting) {
        const targetLine = document.getElementById('targetLine');
        if (isHitting) {
            targetLine.style.boxShadow = '0 0 25px rgba(72, 199, 116, 1)';
        } else {
            targetLine.style.boxShadow = '0 0 15px rgba(255, 107, 107, 0.8)';
        }
    }

    updateHitProgress(progress) {
        // Visual feedback through target line intensity
        const targetLine = document.getElementById('targetLine');
        const intensity = 0.8 + (progress * 0.4); // 0.8 to 1.2
        targetLine.style.opacity = intensity;
    }

    updateFrequencyDisplay(frequency) {
        // No longer needed - frequency shown in visualization
    }

    showSuccessAnimation() {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.classList.add('show');
        }
        
        // Make Byte happy
        this.setByteState('happy');
        
        // Add celebration effect to the whole interface
        document.body.classList.add('mission-completed');
        
        // Remove celebration effect after animation
        setTimeout(() => {
            document.body.classList.remove('mission-completed');
        }, 2000);
    }

    handleMicrophoneError(error) {
        let errorMessage = 'Mikrofon-Zugriff fehlgeschlagen.';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Mikrofon-Zugriff wurde verweigert. Bitte erlaube den Zugriff und versuche es erneut.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Kein Mikrofon gefunden. Bitte überprüfe deine Hardware.';
        }
        
        this.updateMicrophoneStatus(errorMessage);
        alert(errorMessage);
    }

    // Removed navigation methods
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EVAMicrophoneStation();
});

// Handle page visibility changes (pause recording when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.evaStation && window.evaStation.isRecording) {
        // Don't automatically stop recording when tab becomes hidden
        // Students might switch tabs while working
    }
});

// Store the instance globally for debugging
let evaStation;
document.addEventListener('DOMContentLoaded', () => {
    evaStation = new EVAMicrophoneStation();
    window.evaStation = evaStation; // For debugging
});