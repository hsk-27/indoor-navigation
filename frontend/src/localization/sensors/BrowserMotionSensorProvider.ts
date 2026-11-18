import { IMotionSensor, MotionData, OrientationData } from './IMotionSensor';

export class BrowserMotionSensorProvider implements IMotionSensor {
    private motionCallbacks: ((data: MotionData) => void)[] = [];
    private orientationCallbacks: ((data: OrientationData) => void)[] = [];
    
    private isRunning = false;

    constructor() {
        this.handleMotion = this.handleMotion.bind(this);
        this.handleOrientation = this.handleOrientation.bind(this);
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        const win = window as any;
        
        // Request permission if necessary (iOS 13+)
        if (typeof win.DeviceMotionEvent !== 'undefined' && typeof win.DeviceMotionEvent.requestPermission === 'function') {
            win.DeviceMotionEvent.requestPermission()
                .then((state: string) => {
                    if (state === 'granted') {
                        this.attachListeners(win);
                    } else {
                        console.error('Permission to access device motion was denied');
                    }
                })
                .catch(console.error);
        } else {
            this.attachListeners(win);
        }
    }

    private attachListeners(win: any): void {
        win.addEventListener('devicemotion', this.handleMotion);
        
        if ('ondeviceorientationabsolute' in win) {
            win.addEventListener('deviceorientationabsolute', this.handleOrientation);
        } else {
            win.addEventListener('deviceorientation', this.handleOrientation);
        }
    }

    public stop(): void {
        this.isRunning = false;
        const win = window as any;
        win.removeEventListener('devicemotion', this.handleMotion);
        
        if ('ondeviceorientationabsolute' in win) {
            win.removeEventListener('deviceorientationabsolute', this.handleOrientation);
        } else {
            win.removeEventListener('deviceorientation', this.handleOrientation);
        }
    }

    public onMotion(callback: (data: MotionData) => void): void {
        if (!this.motionCallbacks.includes(callback)) {
            this.motionCallbacks.push(callback);
        }
    }

    public onOrientation(callback: (data: OrientationData) => void): void {
        if (!this.orientationCallbacks.includes(callback)) {
            this.orientationCallbacks.push(callback);
        }
    }

    private handleMotion(event: DeviceMotionEvent): void {
        const acc = event.acceleration || { x: 0, y: 0, z: 0 };
        const accG = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
        const rot = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };

        const data: MotionData = {
            acceleration: { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 },
            accelerationIncludingGravity: { x: accG.x || 0, y: accG.y || 0, z: accG.z || 0 },
            rotationRate: { alpha: rot.alpha || 0, beta: rot.beta || 0, gamma: rot.gamma || 0 },
            timestamp: Date.now()
        };

        for (const cb of this.motionCallbacks) {
            cb(data);
        }
    }

    private handleOrientation(event: DeviceOrientationEvent): void {
        const data: OrientationData = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            compassHeading: (event as any).webkitCompassHeading ?? null,
            timestamp: Date.now()
        };

        for (const cb of this.orientationCallbacks) {
            cb(data);
        }
    }
}
