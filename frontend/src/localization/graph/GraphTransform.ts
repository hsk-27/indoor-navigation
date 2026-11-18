export interface TransformConfig {
    pixelsPerMeter: number;
    originX: number;
    originY: number;
    rotation: number;
    northOffset?: number;
}

export class GraphTransform {
    private config: TransformConfig;

    constructor(config: TransformConfig) {
        this.config = {
            pixelsPerMeter: config.pixelsPerMeter || 1.0,
            originX: config.originX || 0,
            originY: config.originY || 0,
            rotation: config.rotation || 0,
            northOffset: config.northOffset || 0
        };
    }

    public updateConfig(config: Partial<TransformConfig>) {
        this.config = { ...this.config, ...config };
        if (this.config.pixelsPerMeter <= 0) {
            this.config.pixelsPerMeter = 1.0;
        }
    }

    public getConfig(): TransformConfig {
        return this.config;
    }

    /**
     * Converts a raw SVG coordinate into real-world physical metres relative to the origin.
     */
    public svgToPhysical(svgX: number, svgY: number): { x: number, y: number } {
        // 1. Translate relative to origin
        const tx = svgX - this.config.originX;
        const ty = svgY - this.config.originY;

        // 2. Rotate (inverse rotation to get physical coordinates)
        const rad = -this.config.rotation * (Math.PI / 180.0);
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        const rx = tx * cosR - ty * sinR;
        const ry = tx * sinR + ty * cosR;

        // 3. Scale to metres
        return {
            x: rx / this.config.pixelsPerMeter,
            y: ry / this.config.pixelsPerMeter
        };
    }

    /**
     * Converts real-world physical metres into a raw SVG coordinate.
     */
    public physicalToSvg(physX: number, physY: number): { x: number, y: number } {
        // 1. Scale to pixels
        const px = physX * this.config.pixelsPerMeter;
        const py = physY * this.config.pixelsPerMeter;

        // 2. Rotate
        const rad = this.config.rotation * (Math.PI / 180.0);
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        const rx = px * cosR - py * sinR;
        const ry = px * sinR + py * cosR;

        // 3. Translate to origin
        return {
            x: rx + this.config.originX,
            y: ry + this.config.originY
        };
    }

    /**
     * Scales a physical distance (metres) to SVG pixels.
     */
    public metresToPixels(metres: number): number {
        return metres * this.config.pixelsPerMeter;
    }

    /**
     * Scales a pixel distance to physical metres.
     */
    public pixelsToMetres(pixels: number): number {
        return pixels / this.config.pixelsPerMeter;
    }

    /**
     * Computes the real-world distance between two SVG coordinates.
     */
    public computePhysicalDistance(svgX1: number, svgY1: number, svgX2: number, svgY2: number): number {
        const dx = svgX2 - svgX1;
        const dy = svgY2 - svgY1;
        const pixelDist = Math.hypot(dx, dy);
        return this.pixelsToMetres(pixelDist);
    }
}
