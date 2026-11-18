import { LocalizationState, NavigationPosition, EstimatedCartesianPosition } from './LocalizationState';

export type SessionStatus = LocalizationState['status'];

export class NavigationSession {
    private state: LocalizationState;
    private onStateChange: (state: LocalizationState) => void;

    constructor(onStateChange: (state: LocalizationState) => void) {
        this.onStateChange = onStateChange;
        this.state = {
            status: 'IDLE',
            physicalPosition: null,
            navigationPosition: null
        };
    }

    public getState(): LocalizationState {
        return this.state;
    }

    public updateState(partialUpdate: Partial<LocalizationState>) {
        this.state = { ...this.state, ...partialUpdate };
        this.onStateChange(this.state);
    }

    public startApp(): void {
        this.updateState({ status: 'WAITING_FOR_PERMISSION' });
    }

    public permissionGranted(): void {
        this.updateState({ status: 'INITIALIZING_LOCATION' });
    }

    public locationInitialized(estimate: EstimatedCartesianPosition): void {
        this.updateState({
            status: 'WAITING_FOR_FLOOR',
            physicalPosition: estimate
        });
    }

    public requireFloorSelection(estimate: EstimatedCartesianPosition): void {
        this.updateState({
            status: 'WAITING_FOR_FLOOR',
            physicalPosition: estimate
        });
    }

    public requireManualInitialization(): void {
        this.updateState({ status: 'MANUAL_INITIALIZATION_REQUIRED' });
    }

    public cancelManualInitialization(): void {
        this.updateState({ status: 'IDLE' });
    }

    public floorSelected(navPosition: NavigationPosition): void {
        this.updateState({
            status: 'POSITION_ESTABLISHED',
            navigationPosition: navPosition
        });
    }

    public routeComputed(): void {
        if (this.state.status !== 'POSITION_ESTABLISHED') {
            this.updateState({ status: 'POSITION_ESTABLISHED' });
        }
    }

    public pauseForLowConfidence(): void {
        this.updateState({ status: 'LOW_CONFIDENCE_PAUSED' });
    }

    public resumeFromLowConfidence(): void {
        this.updateState({ status: 'POSITION_ESTABLISHED' });
    }

    public setError(message: string): void {
        this.updateState({
            status: 'ERROR',
            errorMessage: message
        });
    }
}
