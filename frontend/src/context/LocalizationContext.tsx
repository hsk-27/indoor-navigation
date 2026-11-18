import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { LocalizationState } from '../localization/LocalizationState';
import { LocalizationController } from '../localization/core/LocalizationController';
import { PDRProvider } from '../localization/providers/PDRProvider';
import { AndroidFLPProvider } from '../localization/providers/AndroidFLPProvider';
import { IOSCoreLocationProvider } from '../localization/providers/IOSCoreLocationProvider';
import { WebGeolocationProvider } from '../localization/providers/WebGeolocationProvider';
import { GraphNodeData, GraphEdgeData } from '../localization/types/GraphTypes';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { API_BASE_URL } from '../config';

interface LocalizationContextType {
    state: LocalizationState;
    engine: LocalizationController;
    activeGraph: { nodes: GraphNodeData[], edges: GraphEdgeData[] } | null;
    refreshGraph: () => Promise<void>;
}

const defaultState: LocalizationState = {
    status: 'IDLE',
    physicalPosition: null,
    navigationPosition: null
};

// Create a singleton instance of the controller
const engine = new LocalizationController(() => {}); // Initial empty callback
// Register the primary provider (PDR)
engine.registerProvider(new PDRProvider());

const platform = Capacitor.getPlatform();
if (platform === 'android') {
    engine.registerProvider(new AndroidFLPProvider());
} else if (platform === 'ios') {
    engine.registerProvider(new IOSCoreLocationProvider());
} else {
    engine.registerProvider(new WebGeolocationProvider());
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LocalizationState>(defaultState);
    const [activeGraph, setActiveGraph] = useState<{ nodes: GraphNodeData[], edges: GraphEdgeData[] } | null>(null);

    const processGraphData = useCallback((data: any) => {
        const nodes: GraphNodeData[] = Object.values(data.allNodes || {}).map((n: any) => ({
            id: n.id,
            x: n.x,
            y: n.y,
            type: n.type,
            floorId: n.floorId,
            name: n.name,
            isSearchable: n.isSearchable
        }));

        const edges: GraphEdgeData[] = [];
        Object.values(data.allNodes || {}).forEach((n: any) => {
            (n.edges || []).forEach((e: any) => {
                edges.push({
                    id: e.id, 
                    sourceId: n.id,
                    destinationId: e.targetNodeId,
                    distance: e.distance
                });
            });
        });

        const graph = { nodes, edges };
        setActiveGraph(graph);
        engine.setActiveGraph(
            graph.nodes, 
            graph.edges, 
            data.referenceLatitude, 
            data.referenceLongitude, 
            data.geofencePolygon
        );
        if (data.metadata) {
            engine.setGraphMetadata(data.metadata);
        }
    }, []);

    const fetchGraph = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/localization/graph`, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                
                // Cache the JSON for offline use
                try {
                    localStorage.setItem('cached_routing_graph', JSON.stringify(data));
                } catch (e) {
                    console.warn("Could not cache routing graph", e);
                }

                processGraphData(data);
            } else {
                throw new Error("Server returned non-200 status");
            }
        } catch (err) {
            console.warn("Failed to load active graph from network, attempting to load from cache...", err);
            const cached = localStorage.getItem('cached_routing_graph');
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    console.log("Successfully loaded graph from offline cache.");
                    processGraphData(data);
                } catch (e) {
                    console.error("Failed to parse cached graph", e);
                }
            } else {
                console.error("No cached graph available and network failed.");
            }
        }
    }, [processGraphData]);

    useEffect(() => {
        fetchGraph();

        const bc = new BroadcastChannel('graph_sync');
        bc.onmessage = (event) => {
            if (event.data === 'REFRESH_GRAPH') {
                fetchGraph();
            }
        };

        const onStateChange = (newState: LocalizationState) => {
            setState({ ...newState });
        };
        (engine as any).session.onStateChange = onStateChange;

        engine.start();

        // Prevent background battery drain and overheating
        const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                engine.resume();
            } else {
                engine.pause();
            }
        });

        return () => {
            bc.close();
            (engine as any).session.onStateChange = () => {};
            engine.stop();
            appStateListener.then(listener => listener.remove());
        };
    }, []);

    const contextValue = React.useMemo(() => ({
        state, engine, activeGraph, refreshGraph: fetchGraph
    }), [state, engine, activeGraph, fetchGraph]);

    return (
        <LocalizationContext.Provider value={contextValue}>
            {children}
        </LocalizationContext.Provider>
    );
};

export const useLocalization = () => {
    const context = useContext(LocalizationContext);
    if (!context) {
        throw new Error("useLocalization must be used within a LocalizationProvider");
    }
    return context;
};
