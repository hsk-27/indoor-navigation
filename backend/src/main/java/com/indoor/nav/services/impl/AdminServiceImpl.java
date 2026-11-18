package com.indoor.nav.services.impl;

import com.indoor.nav.dtos.AdminEdgeRequest;
import com.indoor.nav.dtos.AdminNodeRequest;
import com.indoor.nav.dtos.EdgeResponse;
import com.indoor.nav.exceptions.ResourceNotFoundException;
import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Floor;
import com.indoor.nav.models.Node;
import com.indoor.nav.models.NodeType;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.NodeRepository;
import com.indoor.nav.services.AdminService;
import com.indoor.nav.services.GraphCacheService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminServiceImpl implements AdminService {

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final FloorRepository floorRepository;
    private final GraphCacheService graphCacheService;
    private final com.indoor.nav.repositories.GraphMetadataRepository metadataRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final com.indoor.nav.engine.core.GraphLoader graphLoader;

    public AdminServiceImpl(NodeRepository nodeRepository, EdgeRepository edgeRepository,
                            FloorRepository floorRepository, GraphCacheService graphCacheService,
                            com.indoor.nav.repositories.GraphMetadataRepository metadataRepository,
                            ApplicationEventPublisher eventPublisher,
                            com.indoor.nav.engine.core.GraphLoader graphLoader) {
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.floorRepository = floorRepository;
        this.graphCacheService = graphCacheService;
        this.metadataRepository = metadataRepository;
        this.eventPublisher = eventPublisher;
        this.graphLoader = graphLoader;
    }

    @Override
    @Transactional
    public Node addNode(AdminNodeRequest request) {
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Node name cannot be empty");
        }
        if (request.getType() == null || request.getType().trim().isEmpty()) {
            throw new IllegalArgumentException("Node type cannot be empty");
        }
        if (request.getFloorId() == null) {
            throw new IllegalArgumentException("Floor ID is required");
        }

        Floor floor = floorRepository.findById(request.getFloorId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid floor ID: " + request.getFloorId()));

        // Validate duplicate node name on the same floor
        boolean duplicateName = nodeRepository.findByFloorId(request.getFloorId()).stream()
                .anyMatch(n -> request.getName().equalsIgnoreCase(n.getName()) && (request.getId() == null || !n.getId().equals(request.getId())));
        if (duplicateName) {
            throw new IllegalArgumentException("A node named '" + request.getName() + "' already exists on this floor");
        }

        // Validate duplicate QR ID using the indexed findByQrId query (avoids full table scan)
        if (request.getQrId() != null && !request.getQrId().trim().isEmpty()) {
            if (nodeRepository.findByQrId(request.getQrId())
                    .filter(n -> request.getId() == null || !n.getId().equals(request.getId()))
                    .isPresent()) {
                throw new IllegalArgumentException("QR ID '" + request.getQrId() + "' is already assigned to another node");
            }
        }

        // Validate that type string maps to a known NodeType enum value
        NodeType nodeType;
        try {
            nodeType = NodeType.valueOf(request.getType());
        } catch (IllegalArgumentException e) {
            String validTypes = java.util.Arrays.stream(NodeType.values())
                                    .map(Enum::name)
                                    .collect(java.util.stream.Collectors.joining(", "));
            throw new IllegalArgumentException("Unknown node type: '" + request.getType() + "'. Valid types: " + validTypes);
        }

        Node node;
        if (request.getId() != null) {
            node = nodeRepository.findById(request.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Node not found: ID " + request.getId()));
        } else {
            node = new Node();
        }
        
        node.setFloor(floor);
        node.setType(nodeType);
        node.setName(request.getName().trim());
        node.setQrId(request.getQrId() != null ? request.getQrId().trim() : null);
        node.setInternalName(request.getInternalName());
        node.setDescription(request.getDescription());
        node.setIsEnabled(request.getIsEnabled() != null ? request.getIsEnabled() : true);
        node.setRouteVisibility(request.getRouteVisibility() != null ? request.getRouteVisibility() : true);
        node.setIsAccessible(request.getIsAccessible() != null ? request.getIsAccessible() : true);
        node.setIsSearchable(request.getIsSearchable() != null ? request.getIsSearchable() : true);

        boolean coordinatesChanged = false;
        if (request.getId() != null) {
            if (node.getX() != null && node.getY() != null && 
                (!node.getX().equals(request.getX()) || !node.getY().equals(request.getY()))) {
                coordinatesChanged = true;
            }
        }
        
        node.setX(request.getX());
        node.setY(request.getY());

        node = nodeRepository.save(node);

        if (coordinatesChanged) {
            recalculateEdgesForNode(node);
        }

        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
        return node;
    }

    private void recalculateEdgesForNode(Node node) {
        List<Edge> edges = edgeRepository.findBySourceIdOrDestinationId(node.getId());

        if (edges.isEmpty()) return;

        double ppm = metadataRepository.findByFloorId(node.getFloor().getId())
                .map(m -> m.getPixelsPerMeter() != null && m.getPixelsPerMeter() > 0 ? m.getPixelsPerMeter() : 1.0)
                .orElse(1.0);

        for (Edge edge : edges) {
            double dx = edge.getSource().getX() - edge.getDestination().getX();
            double dy = edge.getSource().getY() - edge.getDestination().getY();
            double distance = Math.sqrt(dx * dx + dy * dy) / ppm;
            if (edge.getIsFloorTransition() != null && edge.getIsFloorTransition()) {
                double floorDiff = Math.abs(edge.getSource().getFloor().getLevel() - edge.getDestination().getFloor().getLevel());
                distance += Math.max(10.0, floorDiff * 4.0);
            }
            edge.setDistance(distance);
            edgeRepository.save(edge);
        }
    }

    @Override
    @Transactional
    public Edge addEdge(AdminEdgeRequest request) {
        if (request.getSourceId() == null || request.getDestinationId() == null) {
            throw new IllegalArgumentException("Source and destination IDs are required");
        }
        if (request.getSourceId().equals(request.getDestinationId())) {
            throw new IllegalArgumentException("Self-loops are not allowed: source and destination cannot be the same node");
        }

        Node src = nodeRepository.findById(request.getSourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Source node not found: ID " + request.getSourceId()));
        Node dest = nodeRepository.findById(request.getDestinationId())
                .orElseThrow(() -> new ResourceNotFoundException("Destination node not found: ID " + request.getDestinationId()));

        // Automatically compute weight via Euclidean distance as per requirements
        double dx = src.getX() - dest.getX();
        double dy = src.getY() - dest.getY();
        double pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Convert to physical metres using calibration
        double ppm = metadataRepository.findByFloorId(src.getFloor().getId())
                .map(m -> m.getPixelsPerMeter() != null && m.getPixelsPerMeter() > 0 ? m.getPixelsPerMeter() : 1.0)
                .orElse(1.0);
        double distance = pixelDistance / ppm;
        
        if (request.getIsFloorTransition() != null && request.getIsFloorTransition()) {
            double floorDiff = Math.abs(src.getFloor().getLevel() - dest.getFloor().getLevel());
            // Cross-floor distance is strictly vertical (ignoring unaligned SVG pixel offsets)
            distance = Math.max(10.0, floorDiff * 4.0);
        }

        // Validate duplicate edge ONLY if we are creating a new edge (request.getId() == null)
        if (request.getId() == null) {
            boolean duplicateEdge = edgeRepository.findBySourceIdAndDestinationId(src.getId(), dest.getId()).isPresent() ||
                                    edgeRepository.findBySourceIdAndDestinationId(dest.getId(), src.getId()).isPresent();
            if (duplicateEdge) {
                throw new IllegalArgumentException("An edge already exists between these two nodes");
            }
        }

        com.indoor.nav.models.EdgeDirection direction = com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL;
        if (request.getDirection() != null) {
            try {
                direction = com.indoor.nav.models.EdgeDirection.valueOf(request.getDirection().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid edge direction");
            }
        }

        Edge edge;
        if (request.getId() != null) {
            edge = edgeRepository.findById(request.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Edge not found: ID " + request.getId()));
        } else {
            edge = new Edge();
        }
        
        com.indoor.nav.models.TraversalType traversalType = com.indoor.nav.models.TraversalType.NORMAL;
        if (request.getTraversalType() != null) {
            try {
                traversalType = com.indoor.nav.models.TraversalType.valueOf(request.getTraversalType().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid traversal type");
            }
        }

        edge.setSource(src);
        edge.setDestination(dest);
        edge.setDistance(distance);
        edge.setDirection(direction);
        edge.setTraversalType(traversalType);
        edge.setIsEnabled(request.getIsEnabled() != null ? request.getIsEnabled() : true);
        edge.setIsFloorTransition(request.getIsFloorTransition() != null ? request.getIsFloorTransition() : false);

        edgeRepository.save(edge);
        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
        return edge;
    }

    @Override
    @Transactional
    public void deleteNode(Long id) {
        if (!nodeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Node not found: ID " + id);
        }
        nodeRepository.deleteById(id);
        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
    }

    @Override
    @Transactional
    public void deleteEdge(Long id) {
        if (!edgeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Edge not found: ID " + id);
        }
        edgeRepository.deleteById(id);
        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
    }

    @Transactional(readOnly = true)
    public List<EdgeResponse> getAllEdges(Long floorId) {
        List<Edge> edges;
        if (floorId != null) {
            edges = edgeRepository.findEdgesByFloorId(floorId);
        } else {
            edges = edgeRepository.findAll();
        }
        return edges.stream()
                .map(e -> new EdgeResponse(
                        e.getId(),
                        e.getSource().getId(),
                        e.getDestination().getId(),
                        e.getDistance(),
                        e.getDirection() != null ? e.getDirection().name() : "BIDIRECTIONAL",
                        e.getIsEnabled() != null ? e.getIsEnabled() : true,
                        e.getIsFloorTransition() != null ? e.getIsFloorTransition() : false,
                        e.getTraversalType() != null ? e.getTraversalType().name() : "NORMAL"))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Node> getAllNodes(Long floorId) {
        List<Node> nodes;
        if (floorId != null) {
            nodes = nodeRepository.findByFloorId(floorId);
        } else {
            nodes = nodeRepository.findAll();
        }
        for (Node n : nodes) {
            if (n.getFloor() != null) org.hibernate.Hibernate.initialize(n.getFloor());
            if (n.getDepartment() != null) org.hibernate.Hibernate.initialize(n.getDepartment());
        }
        return nodes;
    }

    /**
     * Triggers a graph cache reload. Called after admin mutations to ensure the
     * in-memory routing graph reflects the latest database state.
     *
     * IMPORTANT: This method must be called after the calling transaction has committed.
     * It is designed to be invoked as a separate REST call from the frontend
     * (POST /api/v1/admin/graph/save) rather than from within a mutation transaction.
     */
    @Override
    public void saveGraph() {
        graphCacheService.reloadGraph();
    }
    
    @Transactional
    public void recalculateEdgeLengths(Long floorId) {
        double ppm = metadataRepository.findByFloorId(floorId)
                .map(m -> m.getPixelsPerMeter() != null && m.getPixelsPerMeter() > 0 ? m.getPixelsPerMeter() : 1.0)
                .orElse(1.0);
                
        List<Edge> edges = edgeRepository.findEdgesByFloorId(floorId);
                
        for (Edge e : edges) {
            double dx = e.getSource().getX() - e.getDestination().getX();
            double dy = e.getSource().getY() - e.getDestination().getY();
            double pixelDist = Math.sqrt(dx * dx + dy * dy);
            double distance = pixelDist / ppm;
            if (e.getIsFloorTransition() != null && e.getIsFloorTransition()) {
                double floorDiff = Math.abs(e.getSource().getFloor().getLevel() - e.getDestination().getFloor().getLevel());
                // Cross-floor distance is strictly vertical (ignoring unaligned SVG pixel offsets)
                distance = Math.max(10.0, floorDiff * 4.0);
            }
            e.setDistance(distance);
        }
        edgeRepository.saveAll(edges);
        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
    }

    @Override
    @Transactional
    public void syncGraphPackage(com.indoor.nav.dtos.GraphPackageDTO request) {
        Long floorId = request.getFloorId();
        if (floorId == null) throw new IllegalArgumentException("Floor ID is required");

        Floor floor = floorRepository.findById(floorId)
            .orElseThrow(() -> new IllegalArgumentException("Floor not found"));

        // 1. Sync Metadata
        if (request.getMetadata() != null) {
            com.indoor.nav.models.GraphMetadata currentMeta = metadataRepository.findByFloorId(floorId).orElse(new com.indoor.nav.models.GraphMetadata());
            com.indoor.nav.models.GraphMetadata incomingMeta = request.getMetadata();
            currentMeta.setFloorId(floorId);
            currentMeta.setBuildingName(incomingMeta.getBuildingName());
            currentMeta.setCampusName(incomingMeta.getCampusName());
            currentMeta.setSvgWidth(incomingMeta.getSvgWidth());
            currentMeta.setSvgHeight(incomingMeta.getSvgHeight());
            currentMeta.setPixelsPerMeter(incomingMeta.getPixelsPerMeter());
            currentMeta.setOriginX(incomingMeta.getOriginX());
            currentMeta.setOriginY(incomingMeta.getOriginY());
            currentMeta.setRotation(incomingMeta.getRotation());
            currentMeta.setNorthOffset(incomingMeta.getNorthOffset());
            currentMeta.setGraphVersion(incomingMeta.getGraphVersion() != null ? incomingMeta.getGraphVersion() : 1);
            currentMeta.setModifiedTimestamp(System.currentTimeMillis());
            if (currentMeta.getCreatedTimestamp() == null) currentMeta.setCreatedTimestamp(System.currentTimeMillis());
            metadataRepository.save(currentMeta);
        }

        // 2. Sync Nodes
        List<Node> existingNodes = nodeRepository.findByFloorId(floorId);
        java.util.Map<Long, Node> existingNodeMap = existingNodes.stream().collect(Collectors.toMap(Node::getId, n -> n));
        java.util.Set<Long> incomingNodeIds = new java.util.HashSet<>();
        java.util.Map<Long, Long> idMapping = new java.util.HashMap<>();
        long tempIdCounter = -1;
        if (request.getNodes() != null) {
            for (AdminNodeRequest nReq : request.getNodes()) {
                if (nReq.getId() != null && nReq.getId() <= tempIdCounter) {
                    tempIdCounter = nReq.getId() - 1;
                }
            }
        }
        
        if (request.getNodes() != null) {
            for (AdminNodeRequest nReq : request.getNodes()) {
                if (nReq.getId() != null && nReq.getId() > 0) {
                    incomingNodeIds.add(nReq.getId());
                    Node existing = existingNodeMap.get(nReq.getId());
                    if (existing != null) {
                        existing.setName(nReq.getName());
                        existing.setType(NodeType.valueOf(nReq.getType()));
                        existing.setQrId(nReq.getQrId());
                        existing.setX(nReq.getX());
                        existing.setY(nReq.getY());
                        existing.setInternalName(nReq.getInternalName());
                        existing.setDescription(nReq.getDescription());
                        existing.setIsEnabled(nReq.getIsEnabled() != null ? nReq.getIsEnabled() : true);
                        existing.setRouteVisibility(nReq.getRouteVisibility() != null ? nReq.getRouteVisibility() : true);
                        existing.setIsAccessible(nReq.getIsAccessible() != null ? nReq.getIsAccessible() : true);
                        existing.setIsSearchable(nReq.getIsSearchable() != null ? nReq.getIsSearchable() : true);
                        nodeRepository.save(existing);
                    } else {
                        throw new IllegalArgumentException("Node ID " + nReq.getId() + " not found on this floor");
                    }
                } else {
                    Node newNode = new Node();
                    newNode.setFloor(floor);
                    newNode.setName(nReq.getName());
                    newNode.setType(NodeType.valueOf(nReq.getType()));
                    newNode.setQrId(nReq.getQrId());
                    newNode.setX(nReq.getX());
                    newNode.setY(nReq.getY());
                    newNode.setInternalName(nReq.getInternalName());
                    newNode.setDescription(nReq.getDescription());
                    newNode.setIsEnabled(nReq.getIsEnabled() != null ? nReq.getIsEnabled() : true);
                    newNode.setRouteVisibility(nReq.getRouteVisibility() != null ? nReq.getRouteVisibility() : true);
                    newNode.setIsAccessible(nReq.getIsAccessible() != null ? nReq.getIsAccessible() : true);
                    newNode.setIsSearchable(nReq.getIsSearchable() != null ? nReq.getIsSearchable() : true);
                    nodeRepository.save(newNode);
                    Long mappingKey = nReq.getId() != null ? nReq.getId() : tempIdCounter--;
                    idMapping.put(mappingKey, newNode.getId());
                }
            }
        }
        
        // Remove missing nodes (Edges must be handled carefully, so we'll delete missing edges first!)
        
        // 3. Sync Edges
        List<Edge> existingEdges = edgeRepository.findEdgesByFloorId(floorId);
        java.util.Map<Long, Edge> existingEdgeMap = existingEdges.stream().collect(Collectors.toMap(Edge::getId, e -> e));
        java.util.Set<Long> incomingEdgeIds = new java.util.HashSet<>();

        if (request.getEdges() != null) {
            for (AdminEdgeRequest eReq : request.getEdges()) {
                Long mappedSourceId = idMapping.getOrDefault(eReq.getSourceId(), eReq.getSourceId());
                Long mappedDestId = idMapping.getOrDefault(eReq.getDestinationId(), eReq.getDestinationId());
                
                if (eReq.getId() != null && eReq.getId() > 0) {
                    incomingEdgeIds.add(eReq.getId());
                    Edge existing = existingEdgeMap.get(eReq.getId());
                    if (existing != null) {
                        existing.setDistance(eReq.getDistance());
                        existing.setDirection(eReq.getDirection() != null ? com.indoor.nav.models.EdgeDirection.valueOf(eReq.getDirection()) : com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL);
                        existing.setTraversalType(eReq.getTraversalType() != null ? com.indoor.nav.models.TraversalType.valueOf(eReq.getTraversalType()) : com.indoor.nav.models.TraversalType.NORMAL);
                        existing.setIsEnabled(eReq.getIsEnabled() != null ? eReq.getIsEnabled() : true);
                        existing.setIsFloorTransition(eReq.getIsFloorTransition() != null ? eReq.getIsFloorTransition() : false);
                        edgeRepository.save(existing);
                    }
                } else {
                    Edge newEdge = new Edge();
                    newEdge.setSource(nodeRepository.findById(mappedSourceId).orElseThrow(() -> new IllegalArgumentException("Source missing")));
                    newEdge.setDestination(nodeRepository.findById(mappedDestId).orElseThrow(() -> new IllegalArgumentException("Dest missing")));
                    newEdge.setDistance(eReq.getDistance());
                    newEdge.setDirection(eReq.getDirection() != null ? com.indoor.nav.models.EdgeDirection.valueOf(eReq.getDirection()) : com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL);
                    newEdge.setTraversalType(eReq.getTraversalType() != null ? com.indoor.nav.models.TraversalType.valueOf(eReq.getTraversalType()) : com.indoor.nav.models.TraversalType.NORMAL);
                    newEdge.setIsEnabled(eReq.getIsEnabled() != null ? eReq.getIsEnabled() : true);
                    newEdge.setIsFloorTransition(eReq.getIsFloorTransition() != null ? eReq.getIsFloorTransition() : false);
                    edgeRepository.save(newEdge);
                }
            }
        }
        
        // Remove missing edges (but protect cross-floor transition edges that the 2D editor doesn't manage)
        for (Edge e : existingEdges) {
            boolean isCrossFloor = e.getSource().getFloor() != null && e.getDestination().getFloor() != null &&
                                   !e.getSource().getFloor().getId().equals(e.getDestination().getFloor().getId());
            if (!isCrossFloor && !incomingEdgeIds.contains(e.getId())) {
                edgeRepository.delete(e);
            }
        }
        
        // Remove missing nodes NOW, since associated edges are deleted
        for (Node n : existingNodes) {
            if (!incomingNodeIds.contains(n.getId())) {
                nodeRepository.delete(n);
            }
        }
        
        recalculateEdgeLengths(floorId);

        // 4. Validate before commit
        // This will load the graph from the uncommitted transaction state.
        // If the graph is fundamentally corrupted, this will throw an exception and rollback the transaction.
        graphLoader.loadAndValidate();
        eventPublisher.publishEvent(new com.indoor.nav.engine.core.GraphUpdatedEvent(this));
    }
}
