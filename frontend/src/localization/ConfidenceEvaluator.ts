import { EstimatedCartesianPosition } from './LocalizationState';

export class ConfidenceEvaluator {
    
    /**
     * Evaluates the confidence of the PDR estimate.
     * 
     * Confidence Rules:
     * - HIGH: Accuracy < 10 pixels
     * - MEDIUM: Accuracy >= 10 pixels and < 30 pixels
     * - LOW: Accuracy >= 30 pixels
     */
    public static evaluate(estimate: EstimatedCartesianPosition): 'HIGH' | 'MEDIUM' | 'LOW' {
        if (estimate.accuracy < 10) {
            return 'HIGH';
        } else if (estimate.accuracy < 30) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }
}
