package com.indoor.nav.services.impl;

import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Floor;
import com.indoor.nav.models.Node;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.GraphMetadataRepository;
import com.indoor.nav.repositories.NodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StartupIntegrityService {
    private static final Logger log = LoggerFactory.getLogger(StartupIntegrityService.class);

    private final FloorRepository floorRepository;
    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final GraphMetadataRepository metadataRepository;

    public StartupIntegrityService(FloorRepository floorRepository, NodeRepository nodeRepository,
                                   EdgeRepository edgeRepository, GraphMetadataRepository metadataRepository) {
        this.floorRepository = floorRepository;
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.metadataRepository = metadataRepository;
    }

    // Run this BEFORE the GraphCacheLoader which does not have an explicit order but runs on the same event
    @EventListener(ApplicationReadyEvent.class)
    @Order(10)
    @Transactional
    public void runIntegrityChecks() {
        log.info("================ INTEGRITY REPORT ================");
        
        List<Floor> floors = floorRepository.findAll();
        if (floors.isEmpty()) {
            log.warn("INTEGRITY ISSUE: No floors found in the database. The system is empty.");
        } else {
            log.info("Total Floors: {}", floors.size());
            
            for (Floor floor : floors) {
                if (floor.getSvgMapUrl() == null || floor.getSvgMapUrl().isEmpty()) {
                    log.warn("INTEGRITY ISSUE: Floor '{}' (ID: {}) is missing SVG map URL.", floor.getName(), floor.getId());
                }
                
                if (metadataRepository.findByFloorId(floor.getId()).isEmpty()) {
                    log.warn("INTEGRITY ISSUE: Floor '{}' (ID: {}) is missing GraphMetadata.", floor.getName(), floor.getId());
                }
                
                List<Node> floorNodes = nodeRepository.findByFloorId(floor.getId());
                Set<String> qrIds = floorNodes.stream()
                        .filter(n -> n.getQrId() != null && !n.getQrId().isEmpty())
                        .map(Node::getQrId).collect(Collectors.toSet());
                if (qrIds.size() < floorNodes.stream().filter(n -> n.getQrId() != null && !n.getQrId().isEmpty()).count()) {
                    log.warn("INTEGRITY ISSUE: Floor '{}' (ID: {}) contains duplicate QR IDs.", floor.getName(), floor.getId());
                }
            }
        }

        List<Node> nodes = nodeRepository.findAll();
        log.info("Total Nodes: {}", nodes.size());

        List<Edge> edges = edgeRepository.findAll();
        log.info("Total Edges: {}", edges.size());

        int orphanNodes = 0;
        for (Node node : nodes) {
            boolean hasEdges = edges.stream().anyMatch(e -> 
                e.getSource().getId().equals(node.getId()) || e.getDestination().getId().equals(node.getId())
            );
            if (!hasEdges) {
                orphanNodes++;
                log.warn("INTEGRITY ISSUE: Orphan node detected (ID: {}, Name: {})", node.getId(), node.getName());
            }
        }

        for (Edge edge : edges) {
            if (!edge.getSource().getFloor().getId().equals(edge.getDestination().getFloor().getId())) {
                if (edge.getIsFloorTransition() == null || !edge.getIsFloorTransition()) {
                    log.warn("INTEGRITY ISSUE: Edge {} connects different floors but is not marked as floor transition.", edge.getId());
                }
            }
        }

        log.info("Integrity check complete. Found {} orphan nodes.", orphanNodes);
        log.info("==================================================");
    }
}
