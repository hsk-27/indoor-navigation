import { ConfidenceLevel, LocalizationEstimate } from '../providers/ILocalizationProvider';

export class ConfidenceEstimator {
    
    /**
     * Aggregates various metrics into a single confidence score.
     */
    public evaluate(
        baseEstimate: LocalizationEstimate,
        distanceToEdge: number,
        isOffRoute: boolean,
        isRecovering: boolean
    ): ConfidenceLevel {
        
        if (isRecovering) return 'VERY_LOW';
        if (isOffRoute) return 'LOW';

        // Distance to edge penalty
        // 0-20 units: HIGH/VERY_HIGH
        // 20-50 units: MEDIUM
        // >50 units: LOW
        if (distanceToEdge > 50) return 'LOW';

        // Sensor/Heading penalty
        if (baseEstimate.headingStability < 0.3) return 'MEDIUM';

        if (distanceToEdge < 20 && baseEstimate.headingStability > 0.8) {
            return 'VERY_HIGH';
        }

        return 'HIGH';
    }

    /**
     * Evaluates initialization confidence based on averaged absolute sensor samples (FLP/CoreLocation).
     */
    public evaluateInitialization(avgAccuracy: number, distanceToEdge: number): ConfidenceLevel {
        if (avgAccuracy < 15 && distanceToEdge < 30) {
            return 'HIGH';
        }
        
        if (avgAccuracy < 25 && distanceToEdge < 80) {
            return 'MEDIUM';
        }

        return 'LOW';
    }
}
