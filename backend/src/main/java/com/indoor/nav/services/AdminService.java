package com.indoor.nav.services;

import com.indoor.nav.dtos.AdminEdgeRequest;
import com.indoor.nav.dtos.AdminNodeRequest;
import com.indoor.nav.dtos.EdgeResponse;

import java.util.List;

import com.indoor.nav.models.Node;

public interface AdminService {
    Node addNode(AdminNodeRequest request);
    com.indoor.nav.models.Edge addEdge(AdminEdgeRequest request);
    void deleteNode(Long id);
    void deleteEdge(Long id);
    List<EdgeResponse> getAllEdges(Long floorId);
    List<Node> getAllNodes(Long floorId);
    void recalculateEdgeLengths(Long floorId);

    /**
     * Triggers an atomic reload of the in-memory routing graph from the database.
     * Should be called after all graph mutations are committed.
     */
    void saveGraph();

    void syncGraphPackage(com.indoor.nav.dtos.GraphPackageDTO request);
}
