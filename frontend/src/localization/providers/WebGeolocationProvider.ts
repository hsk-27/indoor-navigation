import { ILocalizationProvider, LocalizationEstimate, ProviderRole } from './ILocalizationProvider';

export class WebGeolocationProvider implements ILocalizationProvider {
    public readonly providerRole: ProviderRole = 'CORRECTION';
    
    private onEstimateCallback: ((estimate: LocalizationEstimate, providerRole: ProviderRole) => void) | null = null;
    private watchId: number | null = null;
    
    private currentFloorId = 1;
    private recentSpeeds: number[] = [];
    private suspended = false;

    public start(): void {
        if (this.watchId !== null) return;
        
        if (!navigator.geolocation) {
            console.warn("Geolocation API not supported on this browser.");
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.handlePositionUpdate(position);
            },
            (error) => {
                console.warn("Web Geolocation Error:", error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }

    public stop(): void {
        if (this.watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
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
        if (this.watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    public resume(): void {
        this.suspended = false;
        if (this.watchId === null) {
            this.start();
        }
    }

    public onEstimate(callback: (estimate: LocalizationEstimate, providerRole: ProviderRole) => void): void {
        this.onEstimateCallback = callback;
    }

    private handlePositionUpdate(position: any): void {
        if (this.suspended) return;
        const { latitude, longitude, heading, speed, accuracy, altitude, altitudeAccuracy } = position.coords;
        let rawSpeed = speed || 0;
        
        // 1. Moving Average Smoothing
        this.recentSpeeds.push(rawSpeed);
        if (this.recentSpeeds.length > 4) this.recentSpeeds.shift();
        let avgSpeed = this.recentSpeeds.reduce((a, b) => a + b, 0) / this.recentSpeeds.length;

        // 2. Drift Deadzone
        // If accuracy is poor (typical indoors), GPS jumps cause artificial speed.
        if (accuracy && accuracy > 12 && avgSpeed < 2.0) {
            avgSpeed = 0; 
        } else if (avgSpeed < 0.8) {
            // General deadzone for standing still (0.8 m/s = ~2.8 km/h)
            avgSpeed = 0;
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
                heading: heading ? (heading * Math.PI / 180) : 0,
                headingStability: accuracy && accuracy < 5 ? 0.8 : 0.2,
                velocity: avgSpeed,
                motionState: avgSpeed > 0 ? 'WALKING' : 'STANDING',
                baseConfidence: accuracy && accuracy < 10 ? 'HIGH' : 'MEDIUM',
                timestamp: position.timestamp
            }, this.providerRole);
        }
    }
}
