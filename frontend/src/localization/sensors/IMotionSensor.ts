export interface MotionData {
    acceleration: { x: number; y: number; z: number };
    accelerationIncludingGravity: { x: number; y: number; z: number };
    rotationRate: { alpha: number; beta: number; gamma: number };
    timestamp: number;
}

export interface OrientationData {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    compassHeading: number | null;
    timestamp: number;
}

export interface IMotionSensor {
    start(): void;
    stop(): void;
    onMotion(callback: (data: MotionData) => void): void;
    onOrientation(callback: (data: OrientationData) => void): void;
}
