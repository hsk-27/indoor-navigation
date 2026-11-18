package com.indoor.nav.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.dtos.AdminNodeRequest;
import com.indoor.nav.dtos.AdminEdgeRequest;
import com.indoor.nav.services.AdminService;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;
    private final com.indoor.nav.repositories.GraphMetadataRepository metadataRepository;

    @Autowired
    public AdminController(AdminService adminService, com.indoor.nav.repositories.GraphMetadataRepository metadataRepository) {
        this.adminService = adminService;
        this.metadataRepository = metadataRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<SuccessResponseDTO> mockAdminAction() {
        return ResponseEntity.ok(new SuccessResponseDTO("Admin action registered"));
    }

    @PostMapping("/nodes")
    public ResponseEntity<com.indoor.nav.models.Node> addNode(@RequestBody AdminNodeRequest request) {
        return ResponseEntity.ok(adminService.addNode(request));
    }

    @PostMapping("/edges")
    public ResponseEntity<com.indoor.nav.dtos.EdgeResponse> addEdge(@RequestBody AdminEdgeRequest request) {
        com.indoor.nav.models.Edge e = adminService.addEdge(request);
        return ResponseEntity.ok(new com.indoor.nav.dtos.EdgeResponse(
            e.getId(), e.getSource().getId(), e.getDestination().getId(), e.getDistance(), 
            e.getDirection() != null ? e.getDirection().name() : "BIDIRECTIONAL", 
            e.getIsEnabled() != null ? e.getIsEnabled() : true, 
            e.getIsFloorTransition() != null ? e.getIsFloorTransition() : false,
            e.getTraversalType() != null ? e.getTraversalType().name() : "NORMAL"));
    }

    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<SuccessResponseDTO> deleteNode(@PathVariable Long id) {
        adminService.deleteNode(id);
        return ResponseEntity.ok(new SuccessResponseDTO("Node deleted"));
    }

    @DeleteMapping("/edges/{id}")
    public ResponseEntity<SuccessResponseDTO> deleteEdge(@PathVariable Long id) {
        adminService.deleteEdge(id);
        return ResponseEntity.ok(new SuccessResponseDTO("Edge deleted"));
    }

    @GetMapping("/nodes")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.List<com.indoor.nav.dtos.AdminNodeRequest>> getNodes(@RequestParam(required = false) Long floorId) {
        return ResponseEntity.ok(adminService.getAllNodes(floorId).stream()
            .map(n -> {
                com.indoor.nav.dtos.AdminNodeRequest dto = new com.indoor.nav.dtos.AdminNodeRequest();
                dto.setId(n.getId());
                dto.setFloorId(n.getFloor() != null ? n.getFloor().getId() : null);
                dto.setDepartmentId(n.getDepartment() != null ? n.getDepartment().getId() : null);
                dto.setType(n.getType() != null ? n.getType().name() : null);
                dto.setName(n.getName());
                dto.setQrId(n.getQrId());
                dto.setX(n.getX());
                dto.setY(n.getY());
                dto.setInternalName(n.getInternalName());
                dto.setDescription(n.getDescription());
                dto.setIsEnabled(n.getIsEnabled());
                dto.setRouteVisibility(n.getRouteVisibility());
                dto.setIsAccessible(n.getIsAccessible());
                dto.setIsSearchable(n.getIsSearchable());
                return dto;
            }).collect(java.util.stream.Collectors.toList()));
    }

    @GetMapping("/edges")
    public ResponseEntity<java.util.List<com.indoor.nav.dtos.EdgeResponse>> getEdges(@RequestParam(required = false) Long floorId) {
        return ResponseEntity.ok(adminService.getAllEdges(floorId));
    }

    @GetMapping("/metadata/{floorId}")
    public ResponseEntity<com.indoor.nav.models.GraphMetadata> getMetadata(@PathVariable Long floorId) {
        return ResponseEntity.ok(metadataRepository.findByFloorId(floorId).orElseGet(() -> {
            com.indoor.nav.models.GraphMetadata meta = new com.indoor.nav.models.GraphMetadata();
            meta.setFloorId(floorId);
            meta.setGraphVersion(1);
            meta.setPixelsPerMeter(1.0);
            return metadataRepository.save(meta);
        }));
    }

    @PutMapping("/metadata/{floorId}")
    @Transactional
    public ResponseEntity<com.indoor.nav.models.GraphMetadata> updateMetadata(@PathVariable Long floorId, @RequestBody com.indoor.nav.models.GraphMetadata request) {
        com.indoor.nav.models.GraphMetadata meta = metadataRepository.findByFloorId(floorId).orElse(new com.indoor.nav.models.GraphMetadata());
        meta.setFloorId(floorId);
        meta.setBuildingName(request.getBuildingName());
        meta.setCampusName(request.getCampusName());
        meta.setSvgWidth(request.getSvgWidth());
        meta.setSvgHeight(request.getSvgHeight());
        meta.setPixelsPerMeter(request.getPixelsPerMeter());
        meta.setOriginX(request.getOriginX());
        meta.setOriginY(request.getOriginY());
        meta.setRotation(request.getRotation());
        meta.setNorthOffset(request.getNorthOffset());
        meta.setGraphVersion(request.getGraphVersion() != null ? request.getGraphVersion() : 1);
        meta.setModifiedTimestamp(System.currentTimeMillis());
        if (meta.getCreatedTimestamp() == null) {
            meta.setCreatedTimestamp(System.currentTimeMillis());
        }
        
        com.indoor.nav.models.GraphMetadata saved = metadataRepository.save(meta);
        
        // Trigger edge recalculation when metadata changes
        adminService.recalculateEdgeLengths(floorId);
        
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/graph/import")
    public ResponseEntity<SuccessResponseDTO> importGraphPackage(@RequestBody com.indoor.nav.dtos.GraphPackageDTO request) {
        adminService.syncGraphPackage(request);
        return ResponseEntity.ok(new SuccessResponseDTO("Graph synchronized successfully"));
    }
}
