package com.indoor.nav.controller;

import com.indoor.nav.dtos.BuildingDTO;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.services.impl.BuildingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/buildings")
public class BuildingController {

    private final BuildingService buildingService;

    public BuildingController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @GetMapping
    public ResponseEntity<List<BuildingDTO>> getAllBuildings() {
        return ResponseEntity.ok(buildingService.getAllBuildings());
    }

    @GetMapping("/{id}")
    public ResponseEntity<BuildingDTO> getBuilding(@PathVariable Long id) {
        return ResponseEntity.ok(buildingService.getBuilding(id));
    }

    @PostMapping
    public ResponseEntity<BuildingDTO> createBuilding(@RequestBody BuildingDTO request) {
        return ResponseEntity.ok(buildingService.createBuilding(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BuildingDTO> updateBuilding(@PathVariable Long id, @RequestBody BuildingDTO request) {
        return ResponseEntity.ok(buildingService.updateBuilding(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<SuccessResponseDTO> deleteBuilding(@PathVariable Long id) {
        buildingService.deleteBuilding(id);
        return ResponseEntity.ok(new SuccessResponseDTO("Building deleted successfully"));
    }
}
