import { NavigationContextSnapshot, TurnManeuver, ManeuverPhase, SpeechPriority } from './NavigationContext';
import { VoiceGuidanceService } from './VoiceGuidanceService';

export interface PredictiveVoiceConfig {
    previewTimeSeconds: number;       // e.g. 6.0 s
    preparationTimeSeconds: number;   // e.g. 2.5 s
    immediateTimeSeconds: number;     // e.g. 0.8 s
    defaultSpeedMetresPerSec: number; // e.g. 1.2 m/s
    minPreviewDistMetres: number;     // e.g. 5.0 m
    maxPreviewDistMetres: number;     // e.g. 14.0 m
    minPrepDistMetres: number;        // e.g. 2.0 m
    maxPrepDistMetres: number;        // e.g. 5.0 m
    minImmediateDistMetres: number;   // e.g. 0.6 m
    maxImmediateDistMetres: number;   // e.g. 1.5 m
    minSpeedThreshold: number;        // e.g. 0.2 m/s
}

export const DEFAULT_PREDICTIVE_VOICE_CONFIG: PredictiveVoiceConfig = {
    previewTimeSeconds: 6.0,
    preparationTimeSeconds: 2.5,
    immediateTimeSeconds: 0.8,
    defaultSpeedMetresPerSec: 1.2,
    minPreviewDistMetres: 5.0,
    maxPreviewDistMetres: 14.0,
    minPrepDistMetres: 2.0,
    maxPrepDistMetres: 5.0,
    minImmediateDistMetres: 0.6,
    maxImmediateDistMetres: 1.5,
    minSpeedThreshold: 0.2
};

export class PredictiveVoiceEngine {
    private config: PredictiveVoiceConfig;
    private voiceService: VoiceGuidanceService;
    private wasLowConfidence: boolean = false;
    private lastAnnouncedManeuverId: string | null = null;
    private lastInitialStartAnnounced: boolean = false;
    private floorNames: Map<number, string> = new Map();

    constructor(
        config: Partial<PredictiveVoiceConfig> = {},
        voiceService?: VoiceGuidanceService
    ) {
        this.config = { ...DEFAULT_PREDICTIVE_VOICE_CONFIG, ...config };
        this.voiceService = voiceService || VoiceGuidanceService.getInstance();
    }

    public setConfig(partial: Partial<PredictiveVoiceConfig>): void {
        this.config = { ...this.config, ...partial };
    }

    public setFloorNames(names: Map<number, string>): void {
        this.floorNames = names;
    }

    private getFloorName(id: number): string {
        return this.floorNames.get(id) || `Floor ${id}`;
    }

    public reset(): void {
        this.wasLowConfidence = false;
        this.lastAnnouncedManeuverId = null;
        this.lastInitialStartAnnounced = false;
        this.voiceService.cancel();
    }

    /**
     * Evaluates the current navigation snapshot and triggers predictive voice announcements.
     */
    public processSnapshot(snapshot: NavigationContextSnapshot): void {
        // 1. Check Recalculation state
        if (snapshot.isRecalculating) {
            return; // Recalculation speech handled directly via priority handler
        }

        // 2. Check Localization Confidence
        const isLowConf = snapshot.confidence === 'LOW' || snapshot.confidence === 'VERY_LOW';
        if (isLowConf) {
            this.wasLowConfidence = true;
            return; // Mute/suppress turn instructions during low confidence
        }

        // Recovery announcement after confidence restores
        if (this.wasLowConfidence && !isLowConf) {
            this.wasLowConfidence = false;
            this.voiceService.speak("Navigation resumed.", { priority: 'HIGH' });
        }

        // 3. User Stationary Check (Suppress turn countdowns if stationary)
        const effectiveSpeed = snapshot.speed > this.config.minSpeedThreshold 
            ? snapshot.speed 
            : this.config.defaultSpeedMetresPerSec;

        const isStationary = snapshot.motionState === 'STATIONARY' || snapshot.speed < this.config.minSpeedThreshold;

        // 4. Initial Segment Departure Announcement
        if (!this.lastInitialStartAnnounced && snapshot.activeSegment && snapshot.upcomingManeuvers.length > 0) {
            this.lastInitialStartAnnounced = true;
            const seg = snapshot.activeSegment;
            const firstManeuver = snapshot.upcomingManeuvers[0];
            const startText = seg.segmentIndex === 0
                ? "Starting navigation. Proceed along the path."
                : `You are on ${this.getFloorName(seg.floorId)}. Continue towards your route.`;
            this.voiceService.speak(startText, { priority: 'LOW' });
            return;
        }

        // 5. Evaluate Upcoming Maneuver
        const maneuver = snapshot.currentManeuver;
        if (!maneuver) return;

        const remainingDist = maneuver.pathDistanceToManeuver;

        // Calculate dynamic thresholds
        const previewThreshold = Math.max(
            this.config.minPreviewDistMetres,
            Math.min(this.config.maxPreviewDistMetres, effectiveSpeed * this.config.previewTimeSeconds)
        );
        const prepThreshold = Math.max(
            this.config.minPrepDistMetres,
            Math.min(this.config.maxPrepDistMetres, effectiveSpeed * this.config.preparationTimeSeconds)
        );
        const immediateThreshold = Math.max(
            this.config.minImmediateDistMetres,
            Math.min(this.config.maxImmediateDistMetres, effectiveSpeed * this.config.immediateTimeSeconds)
        );

        // PREVIEW GUIDANCE
        if (remainingDist <= previewThreshold && remainingDist > prepThreshold) {
            if (!maneuver.announcedPhases.has('PREVIEW')) {
                maneuver.announcedPhases.add('PREVIEW');
                const text = this.generatePreviewText(maneuver, remainingDist);
                this.voiceService.speak(text, { priority: 'LOW' });
            }
        }

        // PREPARATION GUIDANCE
        if (remainingDist <= prepThreshold && remainingDist > immediateThreshold) {
            if (!maneuver.announcedPhases.has('PREPARATION')) {
                maneuver.announcedPhases.add('PREPARATION');
                const text = this.generatePreparationText(maneuver);
                this.voiceService.speak(text, { priority: 'LOW' });
            }
        }

        // IMMEDIATE GUIDANCE
        if (remainingDist <= immediateThreshold) {
            if (!maneuver.announcedPhases.has('IMMEDIATE')) {
                maneuver.announcedPhases.add('IMMEDIATE');
                maneuver.announcedPhases.add('PREPARATION');
                maneuver.announcedPhases.add('PREVIEW');

                const text = this.generateImmediateText(maneuver);
                this.voiceService.speak(text, { priority: 'MEDIUM' });
                this.lastAnnouncedManeuverId = maneuver.id;
            }
        }
    }

    /**
     * Announces high-priority rerouting / recalculation messages.
     */
    public announceRecalculation(): void {
        this.voiceService.speak("Recalculating your route.", { priority: 'HIGH' });
    }

    public announceReturnToTransition(transitionType: 'STAIRCASE' | 'LIFT'): void {
        const typeName = transitionType === 'LIFT' ? "elevator" : "staircase";
        this.voiceService.speak(`Please return to the assigned ${typeName}.`, { priority: 'HIGH' });
    }

    public announceRerouteToNewTransition(transitionType: 'STAIRCASE' | 'LIFT', targetFloor: number): void {
        const typeName = transitionType === 'LIFT' ? "the elevator" : "the staircase";
        this.voiceService.speak(`Rerouting: Take ${typeName} to ${this.getFloorName(targetFloor)}.`, { priority: 'HIGH' });
    }

    public announceDeviationWarning(): void {
        this.voiceService.speak("You have moved away from the route.", { priority: 'HIGH' });
    }

    // generateImmediateText is the sole text generator used by the 1-metre trigger.
    
    private generatePreviewText(m: TurnManeuver, dist: number): string {
        const roundedDist = Math.round(dist);
        switch (m.type) {
            case 'TURN_LEFT': return `In ${roundedDist} metres, turn left.`;
            case 'TURN_RIGHT': return `In ${roundedDist} metres, turn right.`;
            case 'TURN_SLIGHT_LEFT': return `In ${roundedDist} metres, bear left.`;
            case 'TURN_SLIGHT_RIGHT': return `In ${roundedDist} metres, bear right.`;
            case 'TURN_SHARP_LEFT': return `In ${roundedDist} metres, turn sharp left.`;
            case 'TURN_SHARP_RIGHT': return `In ${roundedDist} metres, turn sharp right.`;
            case 'U_TURN': return `In ${roundedDist} metres, make a U-turn.`;
            case 'STAIRCASE_TRANSITION': return `In ${roundedDist} metres, take the stairs to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'LIFT_TRANSITION': return `In ${roundedDist} metres, take the lift to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'DESTINATION_ARRIVAL':
                if (m.destinationSide === 'LEFT') return `In ${roundedDist} metres, your destination is on the left.`;
                if (m.destinationSide === 'RIGHT') return `In ${roundedDist} metres, your destination is on the right.`;
                return `In ${roundedDist} metres, you will reach your destination.`;
            default:
                return `In ${roundedDist} metres, continue straight.`;
        }
    }

    private generatePreparationText(m: TurnManeuver): string {
        switch (m.type) {
            case 'TURN_LEFT': return "Prepare to turn left.";
            case 'TURN_RIGHT': return "Prepare to turn right.";
            case 'TURN_SLIGHT_LEFT': return "Prepare to bear left.";
            case 'TURN_SLIGHT_RIGHT': return "Prepare to bear right.";
            case 'TURN_SHARP_LEFT': return "Prepare to turn sharp left.";
            case 'TURN_SHARP_RIGHT': return "Prepare to turn sharp right.";
            case 'U_TURN': return "Prepare to make a U-turn.";
            case 'STAIRCASE_TRANSITION': return `Prepare to take the stairs to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'LIFT_TRANSITION': return `Prepare to take the lift to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'DESTINATION_ARRIVAL': return "Prepare to arrive at your destination.";
            default: return "Prepare to continue straight.";
        }
    }

    private generateImmediateText(m: TurnManeuver): string {
        switch (m.type) {
            case 'TURN_LEFT':
                return "Turn left now.";
            case 'TURN_RIGHT':
                return "Turn right now.";
            case 'TURN_SLIGHT_LEFT':
                return "Bear left now.";
            case 'TURN_SLIGHT_RIGHT':
                return "Bear right now.";
            case 'TURN_SHARP_LEFT':
                return "Turn sharp left now.";
            case 'TURN_SHARP_RIGHT':
                return "Turn sharp right now.";
            case 'U_TURN':
                return "Make a U-turn now.";
            case 'STAIRCASE_TRANSITION':
                return `Proceed to the staircase. Take the stairs to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'LIFT_TRANSITION':
                return `Proceed to the lift. Take the lift to ${this.getFloorName(m.targetFloorId!)}.`;
            case 'DESTINATION_ARRIVAL':
                if (m.destinationSide === 'LEFT') {
                    return "You have reached your destination on the left.";
                } else if (m.destinationSide === 'RIGHT') {
                    return "You have reached your destination on the right.";
                }
                return "You have reached your destination.";
            default:
                return "Continue straight.";
        }
    }
}
