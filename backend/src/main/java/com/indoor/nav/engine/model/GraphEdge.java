package com.indoor.nav.engine.model;

public class GraphEdge {
    private final Long id;
    private final Long targetNodeId;
    private final Double distance;

    public GraphEdge(Long id, Long targetNodeId, Double distance) {
        this.id = id;
        this.targetNodeId = targetNodeId;
        this.distance = distance;
    }

    public Long getId() {
        return id;
    }

    public Long getTargetNodeId() {
        return targetNodeId;
    }

    public Double getDistance() {
        return distance;
    }
}
