export class StepLengthEstimator {
    private baseLength = 0.70; // Base step length in meters

    /**
     * Estimates step length dynamically based on walking cadence.
     * Higher cadence generally corresponds to a longer step length.
     * 
     * @param cadence Steps per minute
     * @returns Estimated step length in meters
     */
    public estimate(cadence: number): number {
        // A simple linear regression model for step length based on cadence
        // Assuming average walking cadence is ~100 steps/min with a 0.75m length
        
        let length = this.baseLength;
        
        if (cadence > 0) {
            // Add a small multiplier based on how far above/below a slow walking pace (80 spm) they are.
            // (cadence - 80) * 0.002 means an extra 2cm per 10 steps/min increase.
            // e.g., 100 spm -> 0.70 + (20 * 0.002) = 0.74m
            // e.g., 120 spm -> 0.70 + (40 * 0.002) = 0.78m
            const cadenceMultiplier = Math.max(0, (cadence - 80) * 0.002);
            length += cadenceMultiplier;
        }

        // Clamp to realistic human biomechanical limits
        return Math.max(0.4, Math.min(length, 1.2));
    }
}
