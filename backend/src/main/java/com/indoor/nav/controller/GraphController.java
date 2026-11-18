package com.indoor.nav.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.dtos.NodeResponse;
import com.indoor.nav.services.GraphCacheService;
import com.indoor.nav.services.GraphService;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/v1/graph")
public class GraphController {

    private final GraphCacheService graphCacheService;
    private final GraphService graphService;

    @Autowired
    public GraphController(GraphCacheService graphCacheService, GraphService graphService) {
        this.graphCacheService = graphCacheService;
        this.graphService = graphService;
    }

    @PostMapping("/reload")
    public ResponseEntity<SuccessResponseDTO> reloadGraphCache() {
        graphCacheService.reloadGraph();
        return ResponseEntity.ok(new SuccessResponseDTO("Graph successfully reloaded into memory."));
    }

    @GetMapping("/nodes/qr/{qrId}")
    public ResponseEntity<NodeResponse> getNodeByQrId(@PathVariable String qrId) {
        return ResponseEntity.ok(graphService.getNodeByQrId(qrId));
    }
}
