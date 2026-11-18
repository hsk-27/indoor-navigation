import { OrientationData } from '../sensors/IMotionSensor';

export interface HeadingEstimate {
    heading: number; // in radians
    stability: number; // 0.0 to 1.0
    angularVelocity: number; // rad/s
}

export class HeadingEstimator {
    private currentHeading = 0; // radians
    private lastTimestamp = 0;
    
    // Stability tracking
    private angularVelocityFilter = 0;
    private alphaAV = 0.2; // EMA for angular velocity
    
    // Complementary Filter parameters
    // We favor the absolute compass heading heavily, but use gyro (if we had raw gyro) to smooth.
    // Given we only have absolute orientation, we apply a simple EMA as a low-pass filter to smooth jitter.
    private alphaHeading = 0.15; 

    public getCurrentEstimate(): HeadingEstimate {
        let stability = 1.0 - (this.angularVelocityFilter / 2.0);
        stability = Math.max(0, Math.min(1, stability));
        return {
            heading: this.currentHeading,
            stability: stability,
            angularVelocity: this.angularVelocityFilter
        };
    }

    public processOrientation(data: OrientationData): HeadingEstimate {
        if (data.compassHeading === null && data.alpha === null) {
            return this.getCurrentEstimate();
        }

        let rawHeadingDegrees = 0;

        if (data.compassHeading !== null) {
            rawHeadingDegrees = data.compassHeading;
        } else if (data.alpha !== null) {
            rawHeadingDegrees = 360 - data.alpha;
        }

        const rawHeadingRads = rawHeadingDegrees * (Math.PI / 180);

        if (this.lastTimestamp === 0) {
            this.currentHeading = rawHeadingRads;
            this.lastTimestamp = data.timestamp;
        } else {
            const dt = (data.timestamp - this.lastTimestamp) / 1000.0;
            if (dt > 0) {
                // Shortest path angular difference
                let diff = rawHeadingRads - this.currentHeading;
                
                // Normalize diff to [-PI, PI]
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;

                // Instantaneous angular velocity
                const instAV = Math.abs(diff / dt);
                this.angularVelocityFilter = this.angularVelocityFilter + this.alphaAV * (instAV - this.angularVelocityFilter);

                // Apply low-pass filter (EMA) to smooth the heading
                this.currentHeading += this.alphaHeading * diff;
                
                // Keep heading in [0, 2PI]
                if (this.currentHeading < 0) this.currentHeading += 2 * Math.PI;
                if (this.currentHeading >= 2 * Math.PI) this.currentHeading -= 2 * Math.PI;
            }
            this.lastTimestamp = data.timestamp;
        }

        // Calculate stability: Inverse relationship with angular velocity.
        // If turning fast (e.g. > 2 rad/s), stability is 0. If perfectly still, stability is 1.
        let stability = 1.0 - (this.angularVelocityFilter / 2.0);
        stability = Math.max(0, Math.min(1, stability));

        return {
            heading: this.currentHeading,
            stability: stability,
            angularVelocity: this.angularVelocityFilter
        };
    }
}
