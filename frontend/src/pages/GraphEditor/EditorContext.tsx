import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { GraphNodeData, GraphEdgeData, GraphMetadataData, NodeType, TraversalType, EdgeDirection } from '../../localization/types/GraphTypes';

export type EditorMode = 'SELECT' | 'CREATE_NODE' | 'CREATE_EDGE' | 'MEASURE' | 'CALIBRATE';

// Undo/Redo Action Types
export type EditorAction = 
    | { type: 'SET_NODES'; payload: GraphNodeData[] }
    | { type: 'SET_EDGES'; payload: GraphEdgeData[] }
    | { type: 'ADD_NODE'; payload: GraphNodeData }
    | { type: 'UPDATE_NODE'; payload: GraphNodeData }
    | { type: 'DELETE_NODES'; payload: number[] }
    | { type: 'ADD_EDGE'; payload: GraphEdgeData }
    | { type: 'UPDATE_EDGE'; payload: GraphEdgeData }
    | { type: 'DELETE_EDGES'; payload: number[] }
    | { type: 'MOVE_NODES'; payload: { id: number, x: number, y: number }[] }
    | { type: 'UNDO' }
    | { type: 'REDO' };

export interface EditorState {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
    metadata: GraphMetadataData | null;
    
    selectedBuildingId: number | null;
    selectedFloorId: number | null;
    
    mode: EditorMode;
    selectedNodeIds: number[];
    selectedEdgeIds: number[];
    
    transform: { x: number, y: number, scale: number };
    
    history: { nodes: GraphNodeData[], edges: GraphEdgeData[] }[];
    historyIndex: number;
}

const initialState: EditorState = {
    nodes: [],
    edges: [],
    metadata: null,
    selectedBuildingId: null,
    selectedFloorId: null,
    mode: 'SELECT',
    selectedNodeIds: [],
    selectedEdgeIds: [],
    transform: { x: 0, y: 0, scale: 1 },
    history: [],
    historyIndex: -1
};

// ... Context and Reducer implementation will go here if needed.
