import { MotionState } from './providers/ILocalizationProvider';

export interface EstimatedCartesianPosition {
    x: number;
    y: number;
    floorId: number;
    accuracy: number; // in abstract graph units (pixels/meters)
    timestamp: number; // epoch ms
}

export type LocalizationConfidence = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export interface NavigationPosition {
    floorId: number;
    currentEdgeId: number | null; // ID of the GraphEdge the user is on
    distanceAlongEdge: number; // distance in abstract graph units from the edge's source node
    confidence: LocalizationConfidence;
    routeProgress: number; // 0.0 to 1.0 (percentage of overall route completed)
    heading?: number; // radians
    velocity?: number; // meters per second
    motionState?: MotionState;
}

export interface LocalizationState {
    status: 'IDLE' | 'WAITING_FOR_PERMISSION' | 'INITIALIZING_LOCATION' | 'WAITING_FOR_FLOOR' | 'MANUAL_INITIALIZATION_REQUIRED' | 'POSITION_ESTABLISHED' | 'LOW_CONFIDENCE_PAUSED' | 'FLOOR_TRANSITIONING' | 'OUTSIDE_BUILDING' | 'ERROR';
    errorMessage?: string;
    physicalPosition: EstimatedCartesianPosition | null;
    navigationPosition: NavigationPosition | null;
}
