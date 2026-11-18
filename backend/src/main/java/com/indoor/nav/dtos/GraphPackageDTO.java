package com.indoor.nav.dtos;

import java.util.List;
import com.indoor.nav.models.GraphMetadata;

public class GraphPackageDTO {
    private GraphMetadata metadata;
    private List<AdminNodeRequest> nodes;
    private List<AdminEdgeRequest> edges;
    private Long floorId;

    public GraphPackageDTO() {}

    public GraphMetadata getMetadata() { return metadata; }
    public void setMetadata(GraphMetadata metadata) { this.metadata = metadata; }

    public List<AdminNodeRequest> getNodes() { return nodes; }
    public void setNodes(List<AdminNodeRequest> nodes) { this.nodes = nodes; }

    public List<AdminEdgeRequest> getEdges() { return edges; }
    public void setEdges(List<AdminEdgeRequest> edges) { this.edges = edges; }

    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }
}
