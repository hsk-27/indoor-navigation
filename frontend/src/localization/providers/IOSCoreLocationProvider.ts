import { ILocalizationProvider, LocalizationEstimate, ProviderRole } from './ILocalizationProvider';
import { Geolocation, Position } from '@capacitor/geolocation';

export class IOSCoreLocationProvider implements ILocalizationProvider {
    public readonly providerRole: ProviderRole = 'CORRECTION';
    
    private onEstimateCallback: ((estimate: LocalizationEstimate, providerRole: ProviderRole) => void) | null = null;
    private watchId: string | null = null;
    
    private currentFloorId = 1;
    private suspended = false;

    // Filtering State
    private recentSpeeds: number[] = [];
    private lastLat: number | null = null;
    private lastLng: number | null = null;

    public async start(): Promise<void> {
        if (this.watchId !== null) return;

        try {
            const permissions = await Geolocation.checkPermissions();
            if (permissions.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    console.warn("iOS CoreLocation: Location permissions denied.");
                    return;
                }
            }

            this.watchId = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 3000
                },
                (position: Position | null, err: any) => {
                    if (err) {
                        console.warn("iOS CoreLocation Error:", err);
                        return;
                    }
                    if (position) {
                        this.handlePositionUpdate(position);
                    }
                }
            );
        } catch (error) {
            console.error("iOS CoreLocation Start Error:", error);
        }
    }

    public async stop(): Promise<void> {
        if (this.watchId !== null) {
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }
    }

    public initializeAt(x: number, y: number, floorId: number): void {
        this.currentFloorId = floorId;
    }

    public changeFloor(floorId: number): void {
        this.currentFloorId = floorId;
    }

    public suspend(): void {
        this.suspended = true;
        if (this.watchId !== null) {
            Geolocation.clearWatch({ id: this.watchId }).catch(() => {});
            this.watchId = null;
        }
    }

    public resume(): void {
        this.suspended = false;
        if (this.watchId === null) {
            this.start().catch(() => {});
        }
    }

    public onEstimate(callback: (estimate: LocalizationEstimate, providerRole: ProviderRole) => void): void {
        this.onEstimateCallback = callback;
    }

    private handlePositionUpdate(position: any): void {
        if (this.suspended) return;
        let { latitude, longitude, heading, speed, accuracy, altitude, altitudeAccuracy } = position.coords;

        // 1. Accuracy Outlier Rejection
        // Ignore wildly inaccurate indoor points (>50m) if we already have a location lock
        if (this.lastLat !== null && accuracy && accuracy > 50) {
            return;
        }

        // 2. Exponential Moving Average (EMA) for Coordinates
        // This smooths out GPS jumping / teleportation
        if (this.lastLat !== null && this.lastLng !== null) {
            // Calculate a dynamic alpha based on accuracy. 
            // Better accuracy (lower value) -> higher alpha (trust new reading more)
            // Worse accuracy (higher value) -> lower alpha (trust history more)
            const alpha = accuracy ? Math.max(0.1, Math.min(0.9, 5 / accuracy)) : 0.5;
            latitude = this.lastLat + alpha * (latitude - this.lastLat);
            longitude = this.lastLng + alpha * (longitude - this.lastLng);
        }
        this.lastLat = latitude;
        this.lastLng = longitude;

        // 3. Speed Smoothing & Drift Deadzone
        let rawSpeed = speed || 0;
        this.recentSpeeds.push(rawSpeed);
        if (this.recentSpeeds.length > 5) this.recentSpeeds.shift();
        let avgSpeed = this.recentSpeeds.reduce((a, b) => a + b, 0) / this.recentSpeeds.length;

        // Apply aggressive indoor drift deadzone
        if (accuracy && accuracy > 12 && avgSpeed < 2.0) {
            avgSpeed = 0; 
        } else if (avgSpeed < 0.8) {
            avgSpeed = 0;
        }

        // 4. Dynamic Confidence Calculation
        let baseConfidence: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' = 'MEDIUM';
        if (accuracy) {
            if (accuracy <= 5) baseConfidence = 'VERY_HIGH';
            else if (accuracy <= 10) baseConfidence = 'HIGH';
            else if (accuracy <= 20) baseConfidence = 'MEDIUM';
            else if (accuracy <= 35) baseConfidence = 'LOW';
            else baseConfidence = 'VERY_LOW';
        }

        if (this.onEstimateCallback) {
            this.onEstimateCallback({
                geographicPosition: {
                    latitude,
                    longitude,
                    accuracy: accuracy || 10,
                    altitude: altitude !== null ? altitude : undefined,
                    altitudeAccuracy: altitudeAccuracy !== null ? altitudeAccuracy : undefined,
                    heading: heading !== null ? heading : undefined,
                    speed: avgSpeed,
                    timestamp: position.timestamp
                },
                position: { x: 0, y: 0, floorId: this.currentFloorId, accuracy: accuracy || 10, timestamp: position.timestamp },
                heading: heading !== null && heading !== undefined ? (heading * Math.PI / 180) : undefined,
                headingStability: accuracy && accuracy <= 10 ? 0.8 : (accuracy && accuracy > 20 ? 0.3 : 0.5),
                velocity: avgSpeed,
                motionState: avgSpeed > 0 ? 'WALKING' : 'STANDING',
                baseConfidence: baseConfidence,
                timestamp: position.timestamp
            }, this.providerRole);
        }
    }
}
