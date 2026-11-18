export interface CorrectionPolicy {
    maxDriftMetres: number;
    maxRouteDeviationMetres: number;
    minConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
    maxHeadingErrorDeg: number;
}

export const DEFAULT_CORRECTION_POLICY: CorrectionPolicy = {
    maxDriftMetres: 10,
    maxRouteDeviationMetres: 5,
    minConfidence: 'MEDIUM',
    maxHeadingErrorDeg: 45
};
