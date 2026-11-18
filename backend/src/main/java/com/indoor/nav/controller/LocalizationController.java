package com.indoor.nav.controller;

import com.indoor.nav.dtos.FloorDTO;
import com.indoor.nav.dtos.BuildingDTO;
import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.services.GraphCacheService;
import com.indoor.nav.services.impl.FloorManagementService;
import com.indoor.nav.services.impl.BuildingService;
import com.indoor.nav.repositories.GraphMetadataRepository;
import com.indoor.nav.models.GraphMetadata;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/localization")
public class LocalizationController {

    private final GraphCacheService graphCacheService;
    private final FloorManagementService floorService;
    private final GraphMetadataRepository metadataRepository;
    private final BuildingService buildingService;

    @Autowired
    public LocalizationController(GraphCacheService graphCacheService, FloorManagementService floorService, GraphMetadataRepository metadataRepository, BuildingService buildingService) {
        this.graphCacheService = graphCacheService;
        this.floorService = floorService;
        this.metadataRepository = metadataRepository;
        this.buildingService = buildingService;
    }

    @GetMapping("/graph")
    public ResponseEntity<RoutingGraph> getActiveGraph() {
        return ResponseEntity.ok(graphCacheService.getGraph());
    }

    @GetMapping("/buildings")
    public ResponseEntity<List<BuildingDTO>> getAllBuildings() {
        return ResponseEntity.ok(buildingService.getAllBuildings());
    }

    @GetMapping("/buildings/{buildingId}/floors")
    public ResponseEntity<List<FloorDTO>> getFloors(@PathVariable Long buildingId) {
        return ResponseEntity.ok(floorService.getFloorsByBuilding(buildingId));
    }

    @GetMapping("/metadata/{floorId}")
    public ResponseEntity<GraphMetadata> getMetadata(@PathVariable Long floorId) {
        return ResponseEntity.ok(metadataRepository.findByFloorId(floorId).orElse(null));
    }
}
