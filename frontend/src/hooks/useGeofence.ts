import { useState, useEffect } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface GeofenceConfig {
    buildingLat: number;
    buildingLng: number;
    radiusInMeters: number;
}

export const useGeofence = (config: GeofenceConfig | null) => {
    const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
    const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState<boolean>(false);

    // Haversine formula to calculate distance between two lat/long points in meters
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    useEffect(() => {
        let watchId: string | null = null;

        const startTracking = async () => {
            try {
                // Request permissions (important for native apps)
                const permissions = await Geolocation.checkPermissions();
                if (permissions.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        setError('Location permission denied.');
                        return;
                    }
                }

                setIsTracking(true);
                watchId = await Geolocation.watchPosition(
                    { enableHighAccuracy: true, maximumAge: 0 },
                    (position, err) => {
                        if (err) {
                            setError(err.message);
                            return;
                        }
                        if (position) {
                            setCurrentPosition(position);
                            
                            if (config && config.buildingLat && config.buildingLng) {
                                const distance = calculateDistance(
                                    position.coords.latitude,
                                    position.coords.longitude,
                                    config.buildingLat,
                                    config.buildingLng
                                );
                                
                                // Default to 200 meters if no radius is specified
                                const radius = config.radiusInMeters || 200;
                                setIsInsideGeofence(distance <= radius);
                            }
                        }
                    }
                );
            } catch (e: any) {
                setError(e.message || 'Failed to start geolocation tracking');
            }
        };

        if (config) {
            startTracking();
        }

        return () => {
            if (watchId) {
                Geolocation.clearWatch({ id: watchId });
            }
            setIsTracking(false);
        };
    }, [config]);

    return {
        currentPosition,
        isInsideGeofence,
        error,
        isTracking
    };
};
