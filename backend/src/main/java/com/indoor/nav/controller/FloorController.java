package com.indoor.nav.controller;

import com.indoor.nav.dtos.FloorDTO;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.services.impl.FloorManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
public class FloorController {

    private final FloorManagementService floorService;

    public FloorController(FloorManagementService floorService) {
        this.floorService = floorService;
    }

    @GetMapping("/buildings/{buildingId}/floors")
    public ResponseEntity<List<FloorDTO>> getFloors(@PathVariable Long buildingId) {
        return ResponseEntity.ok(floorService.getFloorsByBuilding(buildingId));
    }

    @PostMapping("/buildings/{buildingId}/floors")
    public ResponseEntity<FloorDTO> createFloor(
            @PathVariable Long buildingId,
            @RequestParam("name") String name,
            @RequestParam(value = "level", required = false) Integer level,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("svgFile") MultipartFile svgFile) {
        return ResponseEntity.ok(floorService.createFloorWithSvg(buildingId, name, level, description, svgFile));
    }

    @PutMapping("/floors/{floorId}")
    public ResponseEntity<FloorDTO> updateFloor(@PathVariable Long floorId, @RequestBody FloorDTO request) {
        return ResponseEntity.ok(floorService.updateFloor(floorId, request));
    }

    @DeleteMapping("/floors/{floorId}")
    public ResponseEntity<SuccessResponseDTO> deleteFloor(@PathVariable Long floorId) {
        floorService.deleteFloor(floorId);
        return ResponseEntity.ok(new SuccessResponseDTO("Floor deleted successfully"));
    }

    @PostMapping("/floors/{floorId}/duplicate")
    public ResponseEntity<FloorDTO> duplicateFloor(@PathVariable Long floorId) {
        return ResponseEntity.ok(floorService.duplicateFloor(floorId));
    }
}
