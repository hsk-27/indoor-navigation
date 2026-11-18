import { NavigationPosition, LocalizationConfidence } from '../LocalizationState';
import { FloorSegment, MultiFloorNavigationStatus } from './MultiFloorNavigationManager';

export type SpeechPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type ManeuverType = 
    | 'CONTINUE_STRAIGHT'
    | 'TURN_SLIGHT_LEFT'
    | 'TURN_SLIGHT_RIGHT'
    | 'TURN_LEFT'
    | 'TURN_RIGHT'
    | 'TURN_SHARP_LEFT'
    | 'TURN_SHARP_RIGHT'
    | 'U_TURN'
    | 'STAIRCASE_TRANSITION'
    | 'LIFT_TRANSITION'
    | 'DESTINATION_ARRIVAL';

export type ManeuverPhase = 'PREVIEW' | 'PREPARATION' | 'IMMEDIATE' | 'PASSED';

export type LateralSide = 'LEFT' | 'RIGHT' | 'AHEAD' | 'UNKNOWN';

export interface TurnManeuver {
    id: string;
    nodeId: number;
    nodeIndex: number;
    type: ManeuverType;
    turnAngleDegrees: number;
    targetFloorId?: number;
    targetName?: string;
    destinationSide?: LateralSide;
    pathDistanceToManeuver: number; // Graph distance in meters along the path
    announcedPhases: Set<ManeuverPhase>; // For hysteresis / single-latching
}

export interface NavigationContextSnapshot {
    navigationPosition: NavigationPosition | null;
    activeSegment: FloorSegment | null;
    currentManeuver: TurnManeuver | null;
    upcomingManeuvers: TurnManeuver[];
    remainingGraphDistance: number; // in meters to segment end / destination
    confidence: LocalizationConfidence;
    speed: number; // in m/s
    heading: number; // in radians
    motionState: string;
    isRecalculating: boolean;
    status: MultiFloorNavigationStatus;
    accessProfile: string;
    timestamp: number;
}

export class NavigationContext {
    private snapshot: NavigationContextSnapshot;
    private listeners: ((snapshot: NavigationContextSnapshot) => void)[] = [];

    constructor() {
        this.snapshot = {
            navigationPosition: null,
            activeSegment: null,
            currentManeuver: null,
            upcomingManeuvers: [],
            remainingGraphDistance: 0,
            confidence: 'MEDIUM',
            speed: 1.2, // Default walking speed: 1.2 m/s
            heading: 0,
            motionState: 'WALKING',
            isRecalculating: false,
            status: 'IDLE',
            accessProfile: 'AUTHORIZED_LIFT_USER', // Default fallback
            timestamp: Date.now()
        };
    }

    public getSnapshot(): NavigationContextSnapshot {
        return this.snapshot;
    }

    public update(partial: Partial<NavigationContextSnapshot>): void {
        this.snapshot = {
            ...this.snapshot,
            ...partial,
            timestamp: Date.now()
        };
        this.notify();
    }

    public subscribe(listener: (snapshot: NavigationContextSnapshot) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.snapshot);
        }
    }

    public reset(): void {
        this.update({
            currentManeuver: null,
            upcomingManeuvers: [],
            remainingGraphDistance: 0,
            isRecalculating: false,
            status: 'IDLE'
        });
    }
}
