import { API_BASE_URL } from '../../config';
import { ILocalizationProvider, LocalizationEstimate } from '../providers/ILocalizationProvider';
import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';
import { NavigationSession } from '../NavigationSession';
import { GraphSnapper } from '../graph/GraphSnapper';
import { MapMatcher } from '../graph/MapMatcher';
import { RouteProgressTracker } from '../graph/RouteProgressTracker';
import { OffRouteDetector } from '../graph/OffRouteDetector';
import { RecoveryEngine } from '../graph/RecoveryEngine';
import { ConfidenceEstimator } from './ConfidenceEstimator';
import { EstimatedCartesianPosition } from '../LocalizationState';
import { GraphTransform } from '../graph/GraphTransform';
import { CorrectionPolicy, DEFAULT_CORRECTION_POLICY } from './CorrectionPolicy';

export class LocalizationController {
    private session: NavigationSession;
    private providers: ILocalizationProvider[] = [];
    private primaryProvider: ILocalizationProvider | null = null;
    
    // Graph Modules
    private snapper = new GraphSnapper();
    private mapMatcher = new MapMatcher();
    private routeTracker = new RouteProgressTracker();
    private offRouteDetector = new OffRouteDetector();
    private recoveryEngine = new RecoveryEngine(this.snapper);
    private confidenceEstimator = new ConfidenceEstimator();

    private activeNodes = new Map<number, GraphNodeData>();
    private activeEdges: GraphEdgeData[] = [];

    // Configurable Policies
    private correctionPolicy: CorrectionPolicy = DEFAULT_CORRECTION_POLICY;
    private pixelsPerMeter: number = 1.0;
    private referenceLatitude: number | null = null;
    private referenceLongitude: number | null = null;
    private geofencePolygon: [number, number][] = [];

    private isInsideGeofence(lat: number, lon: number): boolean {
        const poly = this.geofencePolygon;
        if (poly.length === 0) return true; // No geofence defined
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0], yi = poly[i][1];
            const xj = poly[j][0], yj = poly[j][1];
            
            const intersect = ((yi > lon) != (yj > lon))
                && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    private graphMetadata: any[] = [];
    
    public setReferenceLocation(lat: number, lon: number) {
        // Obsolete: Now using mathematical perspective transform.
    }

    public setGraphMetadata(metadata: any[]) {
        this.graphMetadata = metadata;
    }


    // FLP Initialization Buffers
    private initSamples: LocalizationEstimate[] = [];
    private baseAltitude: number | null = null;
    private readonly METERS_PER_FLOOR = 3.5;
    private readonly REQUIRED_INIT_SAMPLES = 5;

    constructor(onStateChange: (state: any) => void) {
        this.session = new NavigationSession(onStateChange);
        this.handleProviderEstimate = this.handleProviderEstimate.bind(this);
        
        // Setup telemetry flusher
        setInterval(() => this.flushTelemetry(), 15000);
    }

    private unmappedTelemetryBuffer: { x: number, y: number, floorId: number, timestamp: number }[] = [];

    private async flushTelemetry() {
        if (this.unmappedTelemetryBuffer.length === 0) return;
        const payload = [...this.unmappedTelemetryBuffer];
        this.unmappedTelemetryBuffer = [];
        try {
            await fetch(`${API_BASE_URL}/api/v1/telemetry/unmapped`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn("Failed to flush telemetry", e);
        }
    }

    public registerProvider(provider: ILocalizationProvider): void {
        this.providers.push(provider);
        if (provider.providerRole === 'CONTINUOUS' && !this.primaryProvider) {
            this.primaryProvider = provider;
        }
        provider.onEstimate(this.handleProviderEstimate);
    }

    public setActiveGraph(nodes: GraphNodeData[], edges: GraphEdgeData[], refLat?: number, refLon?: number, geofence?: [number, number][]): void {
        this.activeNodes.clear();
        nodes.forEach(n => this.activeNodes.set(n.id, n));
        this.activeEdges = edges;
        if (refLat !== undefined) this.referenceLatitude = refLat;
        if (refLon !== undefined) this.referenceLongitude = refLon;
        if (geofence !== undefined) this.geofencePolygon = geofence;
    }

    public setCalibration(pixelsPerMeter: number) {
        this.pixelsPerMeter = pixelsPerMeter > 0 ? pixelsPerMeter : 1.0;
    }

    public setCorrectionPolicy(policy: CorrectionPolicy) {
        this.correctionPolicy = policy;
    }

    public setActiveRoute(edgeIds: number[]) {
        this.routeTracker.setActiveRoute(edgeIds);
    }

    public startActiveNavigation(edgeIds: number[]): void {
        this.setActiveRoute(edgeIds);
        this.suspendCorrectionProviders();
        this.session.routeComputed();
    }

    public start(): void {
        this.session.startApp();
        this.session.permissionGranted();
        this.providers.forEach(p => p.start());
        // To prevent hanging if no FLP is available or if permission is denied,
        // we set a short timeout here to trigger MANUAL_INITIALIZATION_REQUIRED.
        this.initTimer = setTimeout(() => {
            if (this.session.getState().status === 'INITIALIZING_LOCATION' 
                && this.initSamples.length < this.REQUIRED_INIT_SAMPLES) {
                this.session.requireManualInitialization();
            }
        }, 10000); // 10 second timeout for GPS lock
    }

    public stop(): void {
        this.providers.forEach(p => p.stop());
        if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
        }
    }

    public pause(): void {
        this.providers.forEach(p => {
            if (p.stop) p.stop();
        });
    }

    public resume(): void {
        this.providers.forEach(p => {
            if (p.start) p.start();
        });
    }

    public suspendCorrectionProviders(): void {
        this.providers.forEach(p => {
            if (p.providerRole === 'CORRECTION' && p.suspend) {
                p.suspend();
            }
        });
    }

    private resumeCorrectionProviders(): void {
        this.providers.forEach(p => {
            if (p.providerRole === 'CORRECTION' && p.resume) {
                p.resume();
            }
        });
    }

    public triggerManualRecalibration(): void {
        this.resumeCorrectionProviders();
        this.session.requireManualInitialization();
    }

    public cancelManualRecalibration(): void {
        this.session.cancelManualInitialization();
    }

    public initializeAtFloor(floorId: number, x: number, y: number): void {
        const meta = this.graphMetadata.find(m => m.floorId === floorId);
        if (meta && meta.pixelsPerMeter) {
            this.setCalibration(meta.pixelsPerMeter);
            this.providers.forEach(p => {
                if (p.setCalibration) p.setCalibration(meta.pixelsPerMeter);
            });
        }

        this.providers.forEach(p => p.initializeAt(x, y, floorId));
        this.mapMatcher.reset();
        this.recoveryEngine.reset();
        
        const estimate: EstimatedCartesianPosition = {
            x, y, floorId, accuracy: 0, timestamp: Date.now()
        };
        
        this.session.locationInitialized(estimate);
        this.session.floorSelected({
            floorId,
            currentEdgeId: -1,
            distanceAlongEdge: 0,
            confidence: 'MEDIUM',
            routeProgress: 0,
            heading: 0,
            velocity: 0,
            motionState: 'STANDING'
        });

        // PDR is now the sole position authority. Suspend FLP to prevent flickering.
        this.suspendCorrectionProviders();
    }

    public changeFloor(floorId: number): void {
        const meta = this.graphMetadata.find(m => m.floorId === floorId);
        if (meta && meta.pixelsPerMeter) {
            this.setCalibration(meta.pixelsPerMeter);
            this.providers.forEach(p => {
                if (p.setCalibration) p.setCalibration(meta.pixelsPerMeter);
            });
        }
        this.providers.forEach(p => {
            if (p.changeFloor) p.changeFloor(floorId);
        });
        
        // Output to session but retain current state properties like x, y
        const state = this.session.getState();
        if (state.physicalPosition) {
            this.session.floorSelected({
                floorId,
                currentEdgeId: state.navigationPosition?.currentEdgeId || -1,
                distanceAlongEdge: state.navigationPosition?.distanceAlongEdge || 0,
                confidence: state.navigationPosition?.confidence || 'MEDIUM',
                routeProgress: state.navigationPosition?.routeProgress || 0,
                heading: state.navigationPosition?.heading || 0,
                velocity: state.navigationPosition?.velocity || 0,
                motionState: state.navigationPosition?.motionState || 'STANDING'
            });
        }
    }

    public initializeAtNode(nodeId: number): void {
        const node = this.activeNodes.get(nodeId);
        if (!node) {
            this.session.setError("Cannot initialize at unknown node.");
            return;
        }

        this.providers.forEach(p => p.initializeAt(node.x, node.y, node.floorId));

        this.mapMatcher.reset();
        this.recoveryEngine.reset();

        const estimate: EstimatedCartesianPosition = {
            x: node.x,
            y: node.y,
            floorId: node.floorId,
            accuracy: 0,
            timestamp: Date.now()
        };

        this.session.locationInitialized(estimate);
        
        // Push floor selected state
        this.session.floorSelected({
            floorId: node.floorId,
            currentEdgeId: null,
            distanceAlongEdge: 0,
            confidence: 'VERY_HIGH',
            routeProgress: 0
        });

        // PDR is now the sole position authority. Suspend FLP to prevent flickering.
        this.suspendCorrectionProviders();
    }

    private processInitializationSamples(): void {
        // Filter out extreme outliers in accuracy (e.g., > 100)
        const validSamples = this.initSamples.filter(s => s.position.accuracy < 100);
        
        if (validSamples.length < 3) {
            this.session.requireManualInitialization();
            return;
        }

        // Average valid samples
        const avgX = validSamples.reduce((sum, s) => sum + s.position.x, 0) / validSamples.length;
        const avgY = validSamples.reduce((sum, s) => sum + s.position.y, 0) / validSamples.length;
        
        const avgAccuracy = validSamples.reduce((sum, s) => sum + s.position.accuracy, 0) / validSamples.length;
        
        // Evaluate Altitude for Floor Inference
        const altitudeSamples = validSamples.filter(s => s.geographicPosition && s.geographicPosition.altitude !== undefined && s.geographicPosition.altitudeAccuracy !== undefined && s.geographicPosition.altitudeAccuracy < 2.0);
        
        let altitudeInferredFloorLevel: number | null = null;
        if (altitudeSamples.length >= 3) {
            const avgAltitude = altitudeSamples.reduce((sum, s) => sum + s.geographicPosition!.altitude!, 0) / altitudeSamples.length;
            if (this.baseAltitude === null) {
                // If this is the first high-accuracy altitude lock, we can't be sure it's the ground floor, but we could initialize base.
                // However, without a known base, relative altitude is tricky.
                // If base is known, we could do: floor = round((avgAltitude - this.baseAltitude) / 3.5)
            }
        }

        // Project globally onto graph

        const avgPosition = { x: avgX, y: avgY, floorId: validSamples[0].position.floorId, accuracy: avgAccuracy, timestamp: Date.now() };
        
        const candidate = this.snapper.snapToBestEdge(
            avgPosition, 
            0, // Default heading 0 for initialization
            this.activeNodes, 
            this.activeEdges,
            null,
            new Set<number>()
        );

        const distanceToEdge = candidate ? candidate.distanceToEdge : Infinity;
        const confLevel = this.confidenceEstimator.evaluateInitialization(avgAccuracy, distanceToEdge);

        if (!candidate || confLevel === 'LOW' || confLevel === 'VERY_LOW') {
            this.session.requireManualInitialization();
            return;
        }

        const snappedX = candidate.projectedX;
        const snappedY = candidate.projectedY;

        if (confLevel === 'VERY_HIGH' || confLevel === 'HIGH') {
            // Find floor from snapped edge
            const edge = this.activeEdges.find(e => e.id === candidate.edgeId);
            const sourceNode = edge ? this.activeNodes.get(edge.sourceId) : null;
            const inferredFloorId = sourceNode ? sourceNode.floorId : 1;
            
            this.initializeAtFloor(inferredFloorId, snappedX, snappedY);
        } else if (confLevel === 'MEDIUM') {
            // Ask user for floor, keep snapped coordinates
            this.session.requireFloorSelection({
                x: snappedX,
                y: snappedY,
                floorId: 1, // temporary
                accuracy: avgAccuracy,
                timestamp: Date.now()
            });
        }
    }

    private initTimer: NodeJS.Timeout | null = null;
    private lastCorrectionTimestamp: number = 0;

    private handleProviderEstimate = (estimate: LocalizationEstimate, providerRole: 'CONTINUOUS' | 'CORRECTION'): void => {
        const state = this.session.getState();

        if (providerRole === 'CORRECTION') {
            if (estimate.timestamp < this.lastCorrectionTimestamp) {
                return; // Reject stale GPS
            }
            this.lastCorrectionTimestamp = estimate.timestamp;
        }

        // If the provider gave a geographic position, convert it to cartesian using Homography!
        
        if (estimate.geographicPosition) {
            const geo = estimate.geographicPosition;
            
            // Only enforce the geofence during initial location acquisition.
            // Once the user is already positioned (manually or via GPS), don't kick them out
            // due to noisy desktop GPS drift. Also skip if accuracy is too poor to decide.
            const isAlreadyPositioned = state.status === 'POSITION_ESTABLISHED' 
                || state.status === 'WAITING_FOR_FLOOR'
                || state.status === 'LOW_CONFIDENCE_PAUSED'
                || state.status === 'FLOOR_TRANSITIONING';
            const hasLowAccuracy = geo.accuracy > 50;

            if (!isAlreadyPositioned && !hasLowAccuracy && !this.isInsideGeofence(geo.latitude, geo.longitude)) {
                if (state.status !== 'OUTSIDE_BUILDING') {
                    this.session.updateState({ status: 'OUTSIDE_BUILDING' });
                }
                return; // Block processing
            } else if (state.status === 'OUTSIDE_BUILDING') {
                this.session.updateState({ status: 'INITIALIZING_LOCATION' });
            }

            const floorId = estimate.position.floorId;
            
            // Apply per-floor pixels-per-meter calibration if available
            const meta = this.graphMetadata.find(m => m.floorId === floorId);
            if (meta && meta.pixelsPerMeter) {
                this.setCalibration(meta.pixelsPerMeter);
            }
            
            // Convert WGS84 to SVG Coordinates using mathematical projection
            if (this.referenceLatitude !== null && this.referenceLongitude !== null && meta) {
                // 1. WGS84 to Local Physical Meters (Equirectangular approximation)
                const latDiff = geo.latitude - this.referenceLatitude;
                const lonDiff = geo.longitude - this.referenceLongitude;
                // Meters per degree approximation
                const xMeters = lonDiff * 111320 * Math.cos(this.referenceLatitude * Math.PI / 180);
                const yMeters = latDiff * -110574; // negative because SVG Y is down, geographic North is up

                // 2. Physical Meters to SVG Pixels using GraphTransform
                const transform = new GraphTransform({
                    pixelsPerMeter: meta.pixelsPerMeter || this.pixelsPerMeter,
                    originX: meta.originX || 0,
                    originY: meta.originY || 0,
                    rotation: meta.northOffset || 0
                });
                const svgCoords = transform.physicalToSvg(xMeters, yMeters);
                estimate.position.x = svgCoords.x;
                estimate.position.y = svgCoords.y;
            }
        }
        
        // **INITIALIZATION PHASE**
        if (state.status === 'INITIALIZING_LOCATION' && providerRole === 'CORRECTION') {
            this.initSamples.push(estimate);
            if (this.initSamples.length >= this.REQUIRED_INIT_SAMPLES) {
                // Change status immediately to prevent re-entry
                this.session.updateState({ status: 'IDLE' });
                this.processInitializationSamples();
            }
            return;
        }

        if (state.status !== 'POSITION_ESTABLISHED' && state.status !== 'WAITING_FOR_FLOOR') return;

        const previousEdgeId = state.navigationPosition ? state.navigationPosition.currentEdgeId : null;
        const activeRouteEdgeIds = this.routeTracker.getActiveRouteEdges();

        // **SENSOR FUSION: CORRECTION PROVIDERS (FLP)**
        // After position is established, FLP is suspended. This block only fires
        // during initialization or if FLP is explicitly resumed for recalibration.
        if (providerRole === 'CORRECTION') {
            // CORRECTION providers NEVER trigger a UI update directly.
            // They are only used during the INITIALIZING_LOCATION phase (handled above).
            // Once PDR is active, FLP is suspended to prevent flickering.
            return;
        }

        // **SENSOR FUSION: CONTINUOUS PROVIDERS (PDR)**
        
        // Save the raw physical position for drift comparisons
        // (Wait, NavigationSession's locationInitialized sets physicalPosition but floorSelected does not.
        // Let's ensure we track physicalPosition continuously).
        // Since LocalizationState expects physicalPosition to update, let's patch it via a private prop or update the session.
        const updates: any = { physicalPosition: { ...estimate.position } };

        // 1. Snapping
        let candidate = this.snapper.snapToBestEdge(
            estimate.position, 
            estimate.heading, 
            this.activeNodes, 
            this.activeEdges,
            previousEdgeId,
            activeRouteEdgeIds
        );
        let isRecovering = false;
        
        // 2. Off Route Detection
        const distanceToEdge = candidate ? candidate.distanceToEdge : Infinity;
        const isOffRoute = this.offRouteDetector.checkDeviation(candidate, distanceToEdge);

        // 3. Recovery
        if (isOffRoute) {
            const recoveryResult = this.recoveryEngine.attemptRecovery(
                estimate.position, 
                this.activeNodes, 
                this.activeEdges,
                previousEdgeId,
                activeRouteEdgeIds
            );
            if (recoveryResult.recovered) {
                candidate = recoveryResult.newEdge;
                isRecovering = true;
                this.mapMatcher.reset();
            } else {
                this.session.setError("Tracking lost. Please manually recalibrate your location.");
                return;
            }
        }

        if (candidate) {
            // 4. Map Matching
            const matchedEdge = this.mapMatcher.match(candidate, this.activeEdges);

            if (!matchedEdge) {
                return;
            }

            // 5. Confidence
            const confidence = this.confidenceEstimator.evaluate(estimate, matchedEdge.distanceToEdge, isOffRoute, isRecovering);

            // 6. Output to Session
            estimate.position.x = matchedEdge.projectedX;
            estimate.position.y = matchedEdge.projectedY;
            
            // Critical Feedback Loop: Feed snapped coordinates back into PDR 
            // so its internal dead-reckoning state doesn't drift through walls
            if (this.primaryProvider) {
                this.primaryProvider.initializeAt(matchedEdge.projectedX, matchedEdge.projectedY, estimate.position.floorId);
            }

            updates.status = 'POSITION_ESTABLISHED';
            updates.navigationPosition = {
                floorId: estimate.position.floorId,
                currentEdgeId: matchedEdge.edgeId,
                distanceAlongEdge: matchedEdge.distanceAlongEdge,
                confidence: confidence,
                routeProgress: 0,
                heading: estimate.heading,
                velocity: estimate.velocity,
                motionState: estimate.motionState
            };
            this.session.updateState(updates);
        } else {
            this.session.updateState(updates);
        }
    }
}


