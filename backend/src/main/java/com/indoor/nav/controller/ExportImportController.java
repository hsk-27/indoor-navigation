package com.indoor.nav.controller;

import com.indoor.nav.dtos.BuildingPackageDTO;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.services.impl.ExportImportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class ExportImportController {

    private final ExportImportService exportImportService;

    public ExportImportController(ExportImportService exportImportService) {
        this.exportImportService = exportImportService;
    }

    @GetMapping("/export/{buildingName}")
    public ResponseEntity<BuildingPackageDTO> exportBuilding(@PathVariable String buildingName) {
        return ResponseEntity.ok(exportImportService.exportBuilding(buildingName));
    }

    @PostMapping("/import")
    public ResponseEntity<SuccessResponseDTO> importBuilding(@RequestBody BuildingPackageDTO request) {
        exportImportService.importBuilding(request);
        return ResponseEntity.ok(new SuccessResponseDTO("Building imported successfully"));
    }
}
