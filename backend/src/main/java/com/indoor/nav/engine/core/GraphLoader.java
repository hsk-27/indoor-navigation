package com.indoor.nav.engine.core;

import com.indoor.nav.engine.model.GraphEdge;
import com.indoor.nav.engine.model.GraphNode;
import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Node;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.NodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.GraphMetadataRepository;
import com.indoor.nav.models.Floor;
import com.indoor.nav.repositories.BuildingRepository;
import com.indoor.nav.models.Building;

@Component
public class GraphLoader {
    private static final Logger log = LoggerFactory.getLogger(GraphLoader.class);

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final FloorRepository floorRepository;
    private final GraphMetadataRepository metadataRepository;
    private final BuildingRepository buildingRepository;

    public GraphLoader(NodeRepository nodeRepository, EdgeRepository edgeRepository,
                       FloorRepository floorRepository, GraphMetadataRepository metadataRepository, BuildingRepository buildingRepository) {
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.floorRepository = floorRepository;
        this.metadataRepository = metadataRepository;
        this.buildingRepository = buildingRepository;
    }

    public RoutingGraph loadAndValidate() {
        log.info("Starting Graph Load from PostgreSQL...");
        List<Node> dbNodes = nodeRepository.findAll();
        List<Edge> dbEdges = edgeRepository.findAll();

        Map<Long, GraphNode> memoryNodes = new HashMap<>();

        // 1. Build Nodes
        for (Node n : dbNodes) {
            if (n.getIsEnabled() != null && !n.getIsEnabled()) {
                continue; // Skip disabled nodes in routing
            }
            if (n.getType() == null) {
                log.warn("Validation Warning: Node ID {} has null type, skipping from routing graph.", n.getId());
                continue;
            }
            Integer level = n.getFloor() != null ? n.getFloor().getLevel() : 0;
            Long floorId = n.getFloor() != null ? n.getFloor().getId() : 0L;
            GraphNode gn = new GraphNode(n.getId(), n.getX(), n.getY(), level, floorId, n.getType().name(), n.getName(), n.getQrId());
            memoryNodes.put(gn.getId(), gn);
        }

        // 2. Build Edges & Validate
        int edgeCount = 0;
        for (Edge e : dbEdges) {
            if (e.getIsEnabled() != null && !e.getIsEnabled()) {
                continue; // Skip disabled edges
            }

            Long srcId = e.getSource().getId();
            Long destId = e.getDestination().getId();

            if (srcId.equals(destId)) {
                log.warn("Validation Warning: Self-loop detected on Node ID {}", srcId);
                continue; // Skip self loops
            }

            GraphNode src = memoryNodes.get(srcId);
            GraphNode dest = memoryNodes.get(destId);

            if (src == null || dest == null) {
                log.debug("Validation Note: Disconnected or disabled edge detected {} -> {}", srcId, destId);
                continue;
            }

            // Validate multi-floor transitions
            if (!src.getFloorLevel().equals(dest.getFloorLevel())) {
                boolean isValidMultiFloor = isVerticalTransit(src) || isVerticalTransit(dest);
                if (!isValidMultiFloor && (e.getIsFloorTransition() == null || !e.getIsFloorTransition())) {
                    log.warn("Validation Warning: Invalid multi-floor edge between non-transit nodes: {} -> {}", srcId, destId);
                }
            }

            // Direction Logic
            com.indoor.nav.models.EdgeDirection dir = e.getDirection() != null ? e.getDirection() : com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL;

            if (dir == com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL || dir == com.indoor.nav.models.EdgeDirection.FORWARD) {
                boolean isDuplicateFwd = src.getEdges().stream().anyMatch(existing -> existing.getTargetNodeId().equals(destId));
                if (!isDuplicateFwd) {
                    src.addEdge(new GraphEdge(e.getId(), destId, e.getDistance()));
                    edgeCount++;
                } else {
                    log.warn("Validation Warning: Duplicate FORWARD edge detected {} -> {}", srcId, destId);
                }
            }

            if (dir == com.indoor.nav.models.EdgeDirection.BIDIRECTIONAL || dir == com.indoor.nav.models.EdgeDirection.REVERSE) {
                boolean isDuplicateRev = dest.getEdges().stream().anyMatch(existing -> existing.getTargetNodeId().equals(srcId));
                if (!isDuplicateRev) {
                    dest.addEdge(new GraphEdge(e.getId(), srcId, e.getDistance()));
                    edgeCount++;
                } else {
                    log.warn("Validation Warning: Duplicate REVERSE edge detected {} -> {}", destId, srcId);
                }
            }
        }

        // 3. Detect Orphans
        int orphanCount = 0;
        for (GraphNode gn : memoryNodes.values()) {
            if (gn.getEdges().isEmpty()) {
                log.debug("Validation Note: Orphan node detected (No outgoing edges): ID {}", gn.getId());
                orphanCount++;
            }
        }
        
        // 4. Load Floor PPM mappings
        Map<Integer, Double> floorPpm = new HashMap<>();
        for (Floor f : floorRepository.findAll()) {
            double ppm = metadataRepository.findByFloorId(f.getId())
                .map(m -> m.getPixelsPerMeter() != null && m.getPixelsPerMeter() > 0 ? m.getPixelsPerMeter() : 1.0)
                .orElse(1.0);
            floorPpm.put(f.getLevel(), ppm);
        }

        RoutingGraph graph = new RoutingGraph(memoryNodes, floorPpm);

        // Map building geographic context to the routing graph
        buildingRepository.findAll().stream().findFirst().ifPresent(building -> {
            java.util.List<double[]> geofence = new java.util.ArrayList<>();
            // Expose the authoritative GHRCE WGS84 corners
            geofence.add(new double[]{21.105848, 79.003681}); // TL
            geofence.add(new double[]{21.104549, 79.004146}); // TR
            geofence.add(new double[]{21.104297, 79.003373}); // BR
            geofence.add(new double[]{21.105676, 79.002871}); // BL
            graph.setGeographicContext(
                building.getLatitude() != null ? building.getLatitude() : 21.105848,
                building.getLongitude() != null ? building.getLongitude() : 79.003681,
                geofence
            );
        });

        log.info("Graph Validation Complete: {} nodes ({} orphans), {} valid edges", memoryNodes.size(), orphanCount, edgeCount);
        return graph;
    }

    private boolean isVerticalTransit(GraphNode node) {
        return "STAIRCASE".equals(node.getType()) || "LIFT".equals(node.getType());
    }
}
