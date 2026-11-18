package com.indoor.nav.dtos;

public class AdminEdgeRequest {
    private Long id;
    private Long sourceId;
    private Long destinationId;
    private Double distance;
    private String direction;
    private Boolean isEnabled;
    private Boolean isFloorTransition;
    private String traversalType;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }

    public Long getDestinationId() { return destinationId; }
    public void setDestinationId(Long destinationId) { this.destinationId = destinationId; }

    public Double getDistance() { return distance; }
    public void setDistance(Double distance) { this.distance = distance; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }

    public Boolean getIsFloorTransition() { return isFloorTransition; }
    public void setIsFloorTransition(Boolean isFloorTransition) { this.isFloorTransition = isFloorTransition; }

    public String getTraversalType() { return traversalType; }
    public void setTraversalType(String traversalType) { this.traversalType = traversalType; }
}
