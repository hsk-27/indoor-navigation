import { MotionState } from '../providers/ILocalizationProvider';
import { HeadingEstimate } from './HeadingEstimator';

export class MotionStateDetector {
    private lastStepTime = 0;
    
    public processStep(timestamp: number): void {
        this.lastStepTime = timestamp;
    }

    public estimateState(now: number, headingEstimate: HeadingEstimate): MotionState {
        const timeSinceLastStep = now - this.lastStepTime;

        // If we haven't taken a step in 2 seconds, we are probably standing still
        if (timeSinceLastStep > 2000) {
            // Check if we are turning in place
            if (headingEstimate.angularVelocity > 0.5) {
                return 'TURNING';
            }
            return 'STANDING';
        }

        // If we took a step recently, evaluate cadence or velocity 
        // (In a more advanced implementation, we'd check actual cadence here. 
        // For now, if steps are happening fast enough and we aren't turning fast, we are walking)
        
        if (headingEstimate.angularVelocity > 1.0) {
            return 'TURNING';
        }

        return 'WALKING';
    }
}
