package com.indoor.nav.engine.model;

import java.util.Collections;
import java.util.Map;

/**
 * Immutable in-memory graph representation optimized for A* routing.
 */
public class RoutingGraph {
    private Double referenceLatitude;
    private Double referenceLongitude;
    private java.util.List<double[]> geofencePolygon = new java.util.ArrayList<>();
    private final Map<Long, GraphNode> nodes;
    private final Map<Integer, Double> floorPpm;

    public RoutingGraph(Map<Long, GraphNode> nodes, Map<Integer, Double> floorPpm) {
        this.nodes = Collections.unmodifiableMap(nodes);
        this.floorPpm = Collections.unmodifiableMap(floorPpm);
    }

    public void setGeographicContext(Double lat, Double lon, java.util.List<double[]> geofence) {
        this.referenceLatitude = lat;
        this.referenceLongitude = lon;
        if (geofence != null) {
            this.geofencePolygon = new java.util.ArrayList<>(geofence);
        }
    }

    public Double getReferenceLatitude() { return referenceLatitude; }
    public Double getReferenceLongitude() { return referenceLongitude; }
    public java.util.List<double[]> getGeofencePolygon() { return geofencePolygon; }

    public double getPpm(Integer floorLevel) {
        return floorPpm.getOrDefault(floorLevel, 1.0);
    }

    /**
     * O(1) lookup for a node by its ID.
     */
    public GraphNode getNode(Long id) {
        return nodes.get(id);
    }

    public int getNodeCount() {
        return nodes.size();
    }
    
    public Map<Long, GraphNode> getAllNodes() {
        return nodes;
    }
}
