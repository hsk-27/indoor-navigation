package com.indoor.nav.controller;

import com.indoor.nav.dtos.NodeResponse;
import com.indoor.nav.services.GraphService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final GraphService graphService;

    @Autowired
    public SearchController(GraphService graphService) {
        this.graphService = graphService;
    }

    @GetMapping
    public ResponseEntity<List<NodeResponse>> searchNodes(@RequestParam("query") String query) {
        if (query == null || query.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        
        List<NodeResponse> results = graphService.searchNodes(query);

        return ResponseEntity.ok(results);
    }
}
