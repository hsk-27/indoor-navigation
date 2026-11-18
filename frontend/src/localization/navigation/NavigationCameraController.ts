export interface CameraTransform {
    x: number;
    y: number;
    scale: number;
}

export interface CameraViewport {
    width: number;
    height: number;
}

export interface CameraTargetParams {
    markerX: number;
    markerY: number;
    heading?: number; // radians
    speed?: number;   // m/s
    confidence?: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
    distanceToNextManeuver?: number; // meters
    remainingGraphDistance?: number; // meters
    isApproachingDestination?: boolean;
    isApproachingTurn?: boolean;
    viewport: CameraViewport;
    hasActiveRoute: boolean;
}

export interface NavigationCameraConfig {
    defaultZoom: number;
    turnApproachZoom: number;
    destinationArrivalZoom: number;
    straightCorridorZoom: number;
    lowConfidenceZoom: number;
    minScale: number;
    maxScale: number;
    panSmoothingFactor: number;   // alpha for lerp (0.05 to 0.25)
    zoomSmoothingFactor: number;  // alpha for zoom lerp
    verticalAnchorRatio: number;  // 0.65 = user is 65% down the screen (gives 65% forward view)
    lookaheadDistanceMeters: number; // offset camera forward in heading direction
    pixelsPerMeter: number;
}

export const DEFAULT_CAMERA_CONFIG: NavigationCameraConfig = {
    defaultZoom: 1.8,
    turnApproachZoom: 2.2,
    destinationArrivalZoom: 2.4,
    straightCorridorZoom: 1.6,
    lowConfidenceZoom: 1.2,
    minScale: 0.2,
    maxScale: 4.0,
    panSmoothingFactor: 0.12,
    zoomSmoothingFactor: 0.08,
    verticalAnchorRatio: 0.70,
    lookaheadDistanceMeters: 3.0,
    pixelsPerMeter: 12.5
};

export class NavigationCameraController {
    private config: NavigationCameraConfig;
    private currentTransform: CameraTransform;
    private targetTransform: CameraTransform;
    private isAutoFollowing: boolean = true;
    private isUserInteracting: boolean = false;
    private listeners: Set<(transform: CameraTransform, isAutoFollowing: boolean) => void> = new Set();
    
    // Smoothed marker coordinates
    private smoothedMarkerX: number = 0;
    private smoothedMarkerY: number = 0;
    private smoothedHeading: number = 0;
    private markerInitialized: boolean = false;

    constructor(
        initialTransform: CameraTransform = { x: 0, y: 0, scale: 1.0 },
        config: Partial<NavigationCameraConfig> = {}
    ) {
        this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
        this.currentTransform = { ...initialTransform };
        this.targetTransform = { ...initialTransform };
    }

    public setConfig(newConfig: Partial<NavigationCameraConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    public isFollowing(): boolean {
        return this.isAutoFollowing;
    }

    public setAutoFollowing(follow: boolean): void {
        this.isAutoFollowing = follow;
        this.notify();
    }

    public setUserInteracting(interacting: boolean): void {
        this.isUserInteracting = interacting;
        if (interacting) {
            this.isAutoFollowing = false;
        }
        this.notify();
    }

    public getTransform(): CameraTransform {
        return { ...this.currentTransform };
    }

    public getSmoothedMarker(): { x: number; y: number; heading: number } {
        return {
            x: this.smoothedMarkerX,
            y: this.smoothedMarkerY,
            heading: this.smoothedHeading
        };
    }

    public setManualTransform(transform: CameraTransform): void {
        this.isAutoFollowing = false;
        this.currentTransform = { ...transform };
        this.targetTransform = { ...transform };
        this.notify();
    }

    /**
     * Compute state-aware target zoom and target camera pan based on navigation context
     */
    public updateTarget(params: CameraTargetParams): void {
        // 1. Smooth marker position and heading
        if (!this.markerInitialized) {
            this.smoothedMarkerX = params.markerX;
            this.smoothedMarkerY = params.markerY;
            this.smoothedHeading = params.heading || 0;
            this.markerInitialized = true;
        } else {
            const markerAlpha = 0.25;
            this.smoothedMarkerX += (params.markerX - this.smoothedMarkerX) * markerAlpha;
            this.smoothedMarkerY += (params.markerY - this.smoothedMarkerY) * markerAlpha;

            if (params.heading !== undefined) {
                // Shortest angular difference interpolation
                let delta = params.heading - this.smoothedHeading;
                while (delta > Math.PI) delta -= 2 * Math.PI;
                while (delta < -Math.PI) delta += 2 * Math.PI;
                this.smoothedHeading += delta * 0.2;
            }
        }

        if (!this.isAutoFollowing || this.isUserInteracting) {
            return;
        }

        // 2. State-aware dynamic zoom calculation
        let calculatedZoom = this.config.defaultZoom;

        if (!params.hasActiveRoute) {
            calculatedZoom = this.config.defaultZoom * 0.85;
        } else if (params.confidence === 'LOW' || params.confidence === 'VERY_LOW') {
            calculatedZoom = this.config.lowConfidenceZoom;
        } else if (params.isApproachingDestination || (params.remainingGraphDistance !== undefined && params.remainingGraphDistance <= 4.0)) {
            calculatedZoom = this.config.destinationArrivalZoom;
        } else if (params.isApproachingTurn || (params.distanceToNextManeuver !== undefined && params.distanceToNextManeuver <= 7.0)) {
            calculatedZoom = this.config.turnApproachZoom;
        } else if (params.speed !== undefined && params.speed > 1.35) {
            calculatedZoom = this.config.straightCorridorZoom;
        } else {
            calculatedZoom = this.config.defaultZoom;
        }

        // Clamp scale
        const targetScale = Math.min(Math.max(calculatedZoom, this.config.minScale), this.config.maxScale);

        // 3. Lower-middle screen centering with forward lookahead
        const ppm = this.config.pixelsPerMeter > 0 ? this.config.pixelsPerMeter : 12.5;
        const lookaheadPx = this.config.lookaheadDistanceMeters * ppm;
        
        let focusX = this.smoothedMarkerX;
        let focusY = this.smoothedMarkerY;

        if (params.heading !== undefined && !isNaN(params.heading)) {
            focusX += Math.sin(params.heading) * lookaheadPx;
            focusY -= Math.cos(params.heading) * lookaheadPx;
        }

        const anchorYRatio = params.hasActiveRoute ? this.config.verticalAnchorRatio : 0.5;
        const targetX = (params.viewport.width * 0.5) - (focusX * targetScale);
        const targetY = (params.viewport.height * anchorYRatio) - (focusY * targetScale);

        this.targetTransform = {
            x: targetX,
            y: targetY,
            scale: targetScale
        };
    }

    /**
     * Animation frame step: smooth lerp of position and zoom towards target
     */
    public tick(): boolean {
        if (!this.isAutoFollowing || this.isUserInteracting) {
            return false;
        }

        const panAlpha = this.config.panSmoothingFactor;
        const zoomAlpha = this.config.zoomSmoothingFactor;

        const dx = (this.targetTransform.x - this.currentTransform.x) * panAlpha;
        const dy = (this.targetTransform.y - this.currentTransform.y) * panAlpha;
        const ds = (this.targetTransform.scale - this.currentTransform.scale) * zoomAlpha;

        this.currentTransform.x += dx;
        this.currentTransform.y += dy;
        this.currentTransform.scale += ds;

        const hasChanged = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(ds) > 0.0005;
        if (hasChanged) {
            this.notify();
        }
        return hasChanged;
    }

    public recenter(params: CameraTargetParams): void {
        this.isAutoFollowing = true;
        this.isUserInteracting = false;
        this.smoothedMarkerX = params.markerX;
        this.smoothedMarkerY = params.markerY;
        this.smoothedHeading = params.heading || 0;
        this.markerInitialized = true;
        this.updateTarget(params);
        this.notify();
    }

    public subscribe(listener: (transform: CameraTransform, isAutoFollowing: boolean) => void): () => void {
        this.listeners.add(listener);
        listener(this.currentTransform, this.isAutoFollowing);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener({ ...this.currentTransform }, this.isAutoFollowing);
        }
    }
}
