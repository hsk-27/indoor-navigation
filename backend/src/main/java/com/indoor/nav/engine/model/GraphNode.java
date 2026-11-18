package com.indoor.nav.engine.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class GraphNode {
    private final Long id;
    private final Double x;
    private final Double y;
    private final Integer floorLevel;
    private final Long floorId;
    private final String type;
    private final String name;
    private final String qrId;
    private final List<GraphEdge> edges;

    public GraphNode(Long id, Double x, Double y, Integer floorLevel, Long floorId, String type, String name, String qrId) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.floorLevel = floorLevel;
        this.floorId = floorId;
        this.type = type;
        this.name = name;
        this.qrId = qrId;
        this.edges = new ArrayList<>();
    }

    public void addEdge(GraphEdge edge) {
        this.edges.add(edge);
    }

    public Long getId() { return id; }
    public Double getX() { return x; }
    public Double getY() { return y; }
    public Integer getFloorLevel() { return floorLevel; }
    public Long getFloorId() { return floorId; }
    public String getType() { return type; }
    public String getName() { return name; }
    public String getQrId() { return qrId; }

    public List<GraphEdge> getEdges() {
        return Collections.unmodifiableList(edges);
    }
}
