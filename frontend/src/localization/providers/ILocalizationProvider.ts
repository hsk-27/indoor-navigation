import { EstimatedCartesianPosition } from '../LocalizationState';

export type ConfidenceLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
export type MotionState = 'STANDING' | 'WALKING' | 'RUNNING' | 'TURNING' | 'STOPPING' | 'UNKNOWN';

export interface GeographicEstimate {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
    timestamp: number;
}

export interface LocalizationEstimate {
    geographicPosition?: GeographicEstimate;
    position: EstimatedCartesianPosition;
    heading?: number; // in radians
    headingStability: number; // 0 to 1
    velocity: number; // meters per second
    motionState: MotionState;
    baseConfidence: ConfidenceLevel;
    timestamp: number;
}

export type ProviderRole = 'CONTINUOUS' | 'CORRECTION';

export interface ILocalizationProvider {
    readonly providerRole: ProviderRole;
    start(): void;
    stop(): void;
    initializeAt(x: number, y: number, floorId: number): void;
    setCalibration?(pixelsPerMeter: number): void;
    changeFloor?(floorId: number): void;
    suspend?(): void;
    resume?(): void;
    onEstimate(callback: (estimate: LocalizationEstimate, providerRole: ProviderRole) => void): void;
}
