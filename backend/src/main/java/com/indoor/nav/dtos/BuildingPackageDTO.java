package com.indoor.nav.dtos;

import com.indoor.nav.models.Floor;
import com.indoor.nav.models.GraphMetadata;
import com.indoor.nav.models.Node;

import java.util.List;

public class BuildingPackageDTO {
    private String buildingName;
    private List<FloorData> floors;

    public static class FloorData {
        private Floor floor;
        private GraphMetadata metadata;
        private List<Node> nodes;
        private List<EdgeData> edges; // Using EdgeData instead of Edge to avoid circular refs in JSON if needed, but since we are exporting, we can simplify.

        public Floor getFloor() { return floor; }
        public void setFloor(Floor floor) { this.floor = floor; }

        public GraphMetadata getMetadata() { return metadata; }
        public void setMetadata(GraphMetadata metadata) { this.metadata = metadata; }

        public List<Node> getNodes() { return nodes; }
        public void setNodes(List<Node> nodes) { this.nodes = nodes; }

        public List<EdgeData> getEdges() { return edges; }
        public void setEdges(List<EdgeData> edges) { this.edges = edges; }
    }

    public static class EdgeData {
        private Long id;
        private Long sourceNodeId;
        private Long destinationNodeId;
        private Double distance;
        private String direction;
        private Boolean isEnabled;
        private Boolean isFloorTransition;

        // Getters and Setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getSourceNodeId() { return sourceNodeId; }
        public void setSourceNodeId(Long sourceNodeId) { this.sourceNodeId = sourceNodeId; }
        public Long getDestinationNodeId() { return destinationNodeId; }
        public void setDestinationNodeId(Long destinationNodeId) { this.destinationNodeId = destinationNodeId; }
        public Double getDistance() { return distance; }
        public void setDistance(Double distance) { this.distance = distance; }
        public String getDirection() { return direction; }
        public void setDirection(String direction) { this.direction = direction; }
        public Boolean getIsEnabled() { return isEnabled; }
        public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }
        public Boolean getIsFloorTransition() { return isFloorTransition; }
        public void setIsFloorTransition(Boolean isFloorTransition) { this.isFloorTransition = isFloorTransition; }
    }

    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }

    public List<FloorData> getFloors() { return floors; }
    public void setFloors(List<FloorData> floors) { this.floors = floors; }
}
