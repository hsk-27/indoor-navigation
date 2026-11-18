export type EdgeDirection = 'BIDIRECTIONAL' | 'FORWARD' | 'REVERSE';
export type NodeType = 'ROOM' | 'LABORATORY' | 'OFFICE' | 'CLASSROOM' | 'STAIRCASE' | 'LIFT' | 'CORRIDOR' | 'CORRIDOR_INTERSECTION' | 'CORRIDOR_BEND' | 'ENTRANCE' | 'BUILDING_ENTRANCE' | 'FLOOR_ENTRANCE' | 'WASHROOM' | 'EMERGENCY_EXIT' | 'RECEPTION' | 'UTILITY';
export type TraversalType = 'NORMAL' | 'STAIRS' | 'LIFT' | 'RAMP';

export interface GraphNodeData {
    id: number;
    name?: string;
    internalName?: string;
    description?: string;
    x: number;
    y: number;
    type: NodeType;
    floorId: number;
    qrId?: string;
    isEnabled?: boolean;
    routeVisibility?: boolean;
    isAccessible?: boolean;
    isSearchable?: boolean;
}

export interface GraphEdgeData {
    id: number;
    sourceId: number;
    destinationId: number;
    distance: number;
    direction?: EdgeDirection;
    isEnabled?: boolean;
    isFloorTransition?: boolean;
    traversalType?: TraversalType;
}

export interface GraphMetadataData {
    id?: number;
    buildingName?: string;
    campusName?: string;
    floorId?: number;
    svgWidth?: number;
    svgHeight?: number;
    pixelsPerMeter?: number;
    originX?: number;
    originY?: number;
    rotation?: number;
    northOffset?: number;
    graphVersion?: number;
    createdTimestamp?: number;
    modifiedTimestamp?: number;
}
