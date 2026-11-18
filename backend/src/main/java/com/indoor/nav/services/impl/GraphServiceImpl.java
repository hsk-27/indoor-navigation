package com.indoor.nav.services.impl;

import com.indoor.nav.dtos.NodeResponse;
import com.indoor.nav.exceptions.ResourceNotFoundException;
import com.indoor.nav.models.Node;
import com.indoor.nav.models.NodeType;
import com.indoor.nav.repositories.NodeRepository;
import com.indoor.nav.services.GraphService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class GraphServiceImpl implements GraphService {

    private final NodeRepository nodeRepository;

    public GraphServiceImpl(NodeRepository nodeRepository) {
        this.nodeRepository = nodeRepository;
    }

    @Override
    public List<NodeResponse> getAllNodes() {
        return nodeRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<NodeResponse> getNodesByFloor(Long floorId) {
        return nodeRepository.findByFloorId(floorId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Resolves a QR code string to its Node. Uses the indexed findByQrId repository
     * method for O(1) database lookup instead of a full table scan.
     */
    @Override
    public NodeResponse getNodeByQrId(String qrId) {
        return nodeRepository.findByQrId(qrId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new ResourceNotFoundException("QR code not found: " + qrId));
    }

    @Override
    public NodeResponse getNodeById(Long id) {
        return nodeRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Node not found: ID " + id));
    }

    /**
     * Searches nodes by name. Returns only navigatable destination types
     * (ROOM, LAB, ENTRANCE). Corridors, staircases, and lifts are internal
     * graph nodes — not valid user-selectable destinations.
     */
    @Override
    public List<NodeResponse> searchNodes(String query) {
        if (query == null || query.trim().length() < 1) {
            return Collections.emptyList();
        }
        
        // Use database-level LIKE query instead of loading entire table into memory
        return nodeRepository.findByNameContainingIgnoreCase(query.trim()).stream()
                .filter(node -> Boolean.TRUE.equals(node.getIsSearchable()))
                .filter(node -> {
                    NodeType t = node.getType();
                    return t == NodeType.ROOM || t == NodeType.LABORATORY || t == NodeType.OFFICE || 
                           t == NodeType.CLASSROOM || t == NodeType.WASHROOM || t == NodeType.RECEPTION || 
                           t == NodeType.ENTRANCE || t == NodeType.DESTINATION;
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private NodeResponse mapToResponse(Node node) {
        NodeResponse response = new NodeResponse();
        response.setId(node.getId());
        response.setName(node.getName());
        response.setType(node.getType().name());
        response.setX(node.getX());
        response.setY(node.getY());
        if (node.getFloor() != null) {
            response.setFloorId(node.getFloor().getId());
            response.setFloorName(node.getFloor().getName());
        }
        if (node.getDepartment() != null) {
            response.setDepartmentName(node.getDepartment().getName());
        }
        response.setQrId(node.getQrId());
        return response;
    }
}
