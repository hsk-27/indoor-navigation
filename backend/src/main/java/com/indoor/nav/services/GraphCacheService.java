package com.indoor.nav.services;

import com.indoor.nav.engine.model.RoutingGraph;

public interface GraphCacheService {
    /**
     * Loads the entire graph (Nodes and Edges) from the database into a highly
     * optimized in-memory structure. Called automatically on application startup.
     */
    void loadGraph();

    /**
     * Safely reloads the graph into memory by atomically swapping the active
     * RoutingGraph reference. Thread-safe — does not block concurrent routing requests.
     */
    void reloadGraph();

    /**
     * Returns the currently active, immutable RoutingGraph for routing calculations.
     * O(1) — reads an AtomicReference.
     *
     * @throws IllegalStateException if the cache has not yet been initialized.
     */
    RoutingGraph getGraph();
}
