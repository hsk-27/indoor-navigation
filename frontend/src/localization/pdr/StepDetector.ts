import { MotionData } from '../sensors/IMotionSensor';

export class StepDetector {
    private onStep: (cadence: number) => void;
    
    // Configurable thresholds
    private minStepThreshold = 0.8;
    private maxStepThreshold = 4.0;
    private currentThreshold = 1.2;
    private minTimeBetweenSteps = 300; // ms (max ~3.3 steps/sec)
    private maxTimeBetweenSteps = 2000; // ms (min ~0.5 steps/sec before resetting cadence)
    
    // State
    private filteredAcc = 0;
    private lastFilteredAcc = 0;
    private wasAboveThreshold = false;
    private alphaFilter = 0.1; // EMA factor
    private lastPeakTime = 0;
    private recentPeaks: number[] = [];
    
    // Cadence tracking
    private stepHistory: number[] = [];

    constructor(onStep: (cadence: number) => void) {
        this.onStep = onStep;
    }

    public processMotion(data: MotionData): void {
        const { x, y, z } = data.accelerationIncludingGravity;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        
        // Remove gravity (~9.81) to isolate linear acceleration
        const linearAcc = Math.abs(magnitude - 9.81);

        // Apply EMA (Exponential Moving Average) filter to smooth out noise
        this.filteredAcc = this.filteredAcc + this.alphaFilter * (linearAcc - this.filteredAcc);

        const now = data.timestamp;
        const timeSinceLastStep = now - this.lastPeakTime;

        if (this.filteredAcc > this.currentThreshold) {
            this.wasAboveThreshold = true;
        }

        // Peak Detection & False Positive Rejection
        if (this.wasAboveThreshold && this.filteredAcc < this.currentThreshold && timeSinceLastStep > this.minTimeBetweenSteps) {
            this.wasAboveThreshold = false;
            
            // If it's been too long, reset history and thresholds
            if (timeSinceLastStep > this.maxTimeBetweenSteps) {
                this.stepHistory = [];
                this.recentPeaks = [];
                this.currentThreshold = 1.2; // Reset to default
            } else {
                this.stepHistory.push(timeSinceLastStep);
                if (this.stepHistory.length > 4) {
                    this.stepHistory.shift();
                }
            }

            // Adaptive Threshold: track the peak and update threshold to ~60% of average peak
            this.recentPeaks.push(this.filteredAcc);
            if (this.recentPeaks.length > 5) this.recentPeaks.shift();
            
            const avgPeak = this.recentPeaks.reduce((a, b) => a + b, 0) / this.recentPeaks.length;
            this.currentThreshold = Math.max(this.minStepThreshold, Math.min(this.maxStepThreshold, avgPeak * 0.6));

            this.lastPeakTime = now;
            
            // Calculate Cadence (steps per minute)
            let currentCadence = 100; // Default average
            if (this.stepHistory.length > 0) {
                const avgStepTimeMs = this.stepHistory.reduce((a, b) => a + b, 0) / this.stepHistory.length;
                currentCadence = (1000 / avgStepTimeMs) * 60;
            }

            this.onStep(currentCadence);
        }

        this.lastFilteredAcc = this.filteredAcc;
    }
}
